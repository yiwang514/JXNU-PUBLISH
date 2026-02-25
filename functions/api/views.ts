/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
}

const MAX_IDS = 100;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const idsParam = url.searchParams.get('ids') || '';

  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return Response.json(
      {},
      { headers: { 'Cache-Control': 'public, max-age=60' } }
    );
  }

  const placeholders = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT guid, views FROM view_counts WHERE guid IN (${placeholders})`
  )
    .bind(...ids)
    .all<{ guid: string; views: number }>();

  const counts: Record<string, number> = {};
  for (const row of results) {
    counts[row.guid] = row.views;
  }

  return Response.json(counts, {
    headers: { 'Cache-Control': 'public, max-age=60' },
  });
};
