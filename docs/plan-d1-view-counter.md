# 卡片浏览计数功能 — Cloudflare D1

## Context

项目当前是纯静态 SPA 部署在 Cloudflare Pages，没有任何服务端逻辑。用户希望给每张卡片加浏览计数，利用 Cloudflare Pages Functions + D1 实现。前端已预留了 `popular` 排序选项（当前 disabled），本次同时启用。

## 架构概览

```
用户点击卡片 → fire-and-forget POST /api/view → Pages Function → IP去重 → D1 计数+1
页面加载时   → GET /api/views?ids=...        → Pages Function → D1 SELECT → 返回计数
```

## 一次性基础设施（手动执行，不在 CI 中）

```bash
wrangler d1 create jxnu-views
wrangler d1 execute jxnu-views --command "
  CREATE TABLE IF NOT EXISTS view_counts (
    guid TEXT PRIMARY KEY,
    views INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS view_logs (
    ip_hash TEXT NOT NULL,
    guid TEXT NOT NULL,
    ts INTEGER NOT NULL,
    PRIMARY KEY (ip_hash, guid)
  );
"
# Cloudflare Dashboard → Pages → Settings → Functions → D1 bindings → 添加 DB = jxnu-views
```

## 防刷策略：服务端 IP 去重

- `CF-Connecting-IP` header 获取真实 IP（Cloudflare 自动注入，不可伪造）
- SHA-256 哈希后存入 `view_logs` 表（不存明文 IP，隐私友好）
- 同一 IP + guid 在 1 小时内只算 1 次浏览
- 对用户完全透明，零感知，不涉及 cookie/客户端存储
- 定期清理过期 log（可选：D1 定时任务或在写入时顺带清理 24h 前的记录）

### POST /api/view 去重逻辑

```
1. 从 CF-Connecting-IP 取 IP，SHA-256 哈希
2. 查 view_logs: SELECT 1 FROM view_logs WHERE ip_hash=? AND guid=? AND ts > (now - 3600)
3. 如果已存在 → 返回 { ok: true, dup: true }，不计数
4. 如果不存在 → UPSERT view_logs + UPSERT view_counts (views + 1)
5. 顺带清理: DELETE FROM view_logs WHERE ts < (now - 86400)
```

- 

## 代码变更

### 1. 新建 `functions/api/view.ts` — POST 记录浏览（含 IP 去重）

- `POST /api/view` body: `{ guid: "20250924-ai-01" }`
- 校验 guid 格式 `/^\d{8}-[a-z0-9-]+-\d{2,3}$/`
- 从 `request.headers.get('CF-Connecting-IP')` 取 IP，SHA-256 哈希
- 查 `view_logs` 判断 1 小时内是否已记录
- 未记录 → UPSERT `view_logs` + UPSERT `view_counts` (views + 1)
- 已记录 → 跳过计数，返回 `{ ok: true }`
- 顺带 `DELETE FROM view_logs WHERE ts < ?` 清理 24h 前的过期记录

### 2. 新建 `functions/api/views.ts` — GET 批量查询

- `GET /api/views?ids=guid1,guid2,...` (上限 100 个)
- D1 `SELECT guid, views FROM view_counts WHERE guid IN (...)`
- 返回 `{ "guid1": 42, "guid2": 7 }`
- `Cache-Control: public, max-age=60` 让 CDN 缓存

### 3. 新建 `public/_routes.json` — 路由隔离

```json
{ "version": 1, "include": ["/api/*"], "exclude": [] }
```

告诉 Cloudflare 只有 `/api/*` 走 Functions，其余走静态。

### 4. 修改 `public/_redirects` — 防止 SPA fallback 吞 API

在 `/* /index.html 200` 前加一行 `/api/* /api/:splat 200`。

### 5. 新建 `wrangler.toml` — 本地开发用

```toml
name = "jxnu-publish"
compatibility_date = "2024-09-01"
[[d1_databases]]
binding = "DB"
database_name = "jxnu-views"
database_id = "<从 d1 create 获取>"
```

### 6. 修改 `hooks/use-article-navigation.ts` — 发送浏览计数

在 `handleArticleSelect` 末尾添加 fire-and-forget:
```ts
fetch('/api/view', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ guid: article.guid }),
}).catch(() => {});
```

### 7. 新建 `hooks/use-view-counts.ts` — 批量获取计数

- 接收 `guids: string[]`，返回 `Record<string, number>`
- 内存缓存已获取的 guid，只请求未缓存的
- fetch 失败静默降级（返回空对象）

### 8. 修改 `components/ArticleList.tsx` — 调用 hook 传递计数

- 从 `paginatedArticles` 提取 guids 传入 `useViewCounts`
- 将 `viewCount` 作为 prop 传给每个 `ArticleCard`

### 9. 修改 `components/ArticleCard.tsx` — 显示浏览数

- 新增 `viewCount?: number` prop
- 在 CardFooter 日期行，`<time>` 后面显示 `Eye` 图标 + 数字
- 只在 `viewCount > 0` 时显示

### 10. 修改 `lib/sort-articles.ts` + `ArticleList.tsx` — 启用热门排序

- `sortArticles` 接收 `viewCounts?: Record<string, number>` 参数
- `popular` 排序: 按 views 降序，views 相同按 pubDate 降序
- `ArticleList.tsx` 去掉 `popular` 选项的 `disabled`

### 11. 修改 `.github/workflows/deploy-main.yml` + `deploy.yml`

- paths trigger 添加 `"functions/**"`

## 文件清单

| 操作 | 文件 |
|------|------|
| 新建 | `functions/api/view.ts` |
| 新建 | `functions/api/views.ts` |
| 新建 | `public/_routes.json` |
| 新建 | `wrangler.toml` |
| 新建 | `hooks/use-view-counts.ts` |
| 修改 | `public/_redirects` |
| 修改 | `hooks/use-article-navigation.ts` |
| 修改 | `components/ArticleList.tsx` |
| 修改 | `components/ArticleCard.tsx` |
| 修改 | `lib/sort-articles.ts` |
| 修改 | `.github/workflows/deploy-main.yml` |
| 修改 | `.github/workflows/deploy.yml` |

## 验证

1. 本地: `wrangler pages dev dist --d1 DB=jxnu-views` 启动，点击卡片，检查 D1 本地数据库有计数
2. `curl -X POST localhost:8788/api/view -d '{"guid":"test-01"}' -H 'Content-Type: application/json'`
3. `curl 'localhost:8788/api/views?ids=test-01'` 返回 `{"test-01": 1}`
4. 再次 POST 同一 guid → 计数不变（IP 去重生效）
5. 页面上卡片应显示 Eye 图标 + 数字
6. `pnpm run build` 确认前端编译无错
