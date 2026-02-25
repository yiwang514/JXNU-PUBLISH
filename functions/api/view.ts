/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
}

const GUID_RE = /^\d{8}-[a-z0-9-]+-\d{2,3}$/;
const HOUR_S = 3600;
const DAY_S = 86400;

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let guid: string;
  try {
    const body = (await request.json()) as { guid?: string };
    guid = String(body?.guid ?? '');
  } catch {
    return Response.json({ ok: false, error: 'invalid body' }, { status: 400 });
  }

  if (!GUID_RE.test(guid)) {
    return Response.json({ ok: false, error: 'invalid guid' }, { status: 400 });
  }

  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ipHash = await sha256(ip);
  const now = Math.floor(Date.now() / 1000);

  const db = env.DB;

  // Check if this IP already viewed this guid within the last hour
  const existing = await db
    .prepare('SELECT 1 FROM view_logs WHERE ip_hash = ? AND guid = ? AND ts > ?')
    .bind(ipHash, guid, now - HOUR_S)
    .first();

  if (existing) {
    return Response.json({ ok: true, dup: true });
  }

  // UPSERT view log and increment view count in a batch
  await db.batch([
    db
      .prepare(
        'INSERT INTO view_logs (ip_hash, guid, ts) VALUES (?, ?, ?) ON CONFLICT (ip_hash, guid) DO UPDATE SET ts = excluded.ts'
      )
      .bind(ipHash, guid, now),
    db
      .prepare(
        'INSERT INTO view_counts (guid, views) VALUES (?, 1) ON CONFLICT (guid) DO UPDATE SET views = views + 1'
      )
      .bind(guid),
  ]);

  // Opportunistic cleanup: remove logs older than 24h (non-blocking for response)
  context.waitUntil(
    db.prepare('DELETE FROM view_logs WHERE ts < ?').bind(now - DAY_S).run()
  );

  return Response.json({ ok: true });
};
