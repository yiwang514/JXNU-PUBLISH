# JXNU-PUBLISH 全面代码审计报告

> 审计日期：2026-03-19
> 审计范围：前端 React 代码、构建脚本、Bot Skills、CI/CD 流水线、内容数据完整性
> 审计方法：4 个并行探针全量扫描，覆盖所有源码文件

---

## 总览

| 模块 | 致命 | 严重 | 中等 | 低 | 状态 |
|------|------|------|------|-----|------|
| 前端 React | 1 | 4 | 5 | 4 | 需要修复 |
| 构建脚本 | 2 | 4 | 5 | 3 | 需要修复 |
| Bot Skills / CI/CD | 2 | 2 | 3 | 2 | 需要修复 |
| 内容数据 | 0 | 0 | 0 | 2 | 优秀 |

**核心判断**：项目的内容管道设计健全、数据治理优秀，但**构建脚本存在安全漏洞**，**前端存在 XSS 风险和性能隐患**，**规则执行机制有缺口**。

---

## 一、致命问题（CRITICAL）

### C-1. 路径穿越漏洞 — compile-content.mjs

**位置**：`scripts/compile-content.mjs:79-92`（normalizeAttachmentUrl）

```javascript
if (clean.includes('..')) fail(`Suspicious path: ${clean}`, filePath);
```

**问题**：只检查字面量 `..`，未对 URL 编码（`%2e%2e`）或符号链接做防御。攻击者可通过构造 cover/attachment 路径逃逸目录边界。

**修复方案**：
```javascript
const normalized = path.normalize(cleanPath);
const base = path.normalize(CONTENT_ATTACHMENTS_DIR);
if (!normalized.startsWith(base + path.sep)) {
  fail(`Path escape attempt: ${clean}`, filePath);
}
```

---

### C-2. ffmpeg 输入路径未校验 — optimize-images.mjs

**位置**：`scripts/optimize-images.mjs:19-30, 123-130`

`absInput` 和 `outPath` 来源于 `content-data.json` 中的 cover 字段，未验证是否在合法目录内。虽然使用 `spawnSync` 数组语法避免了 shell 注入，但路径逃逸仍然可能。

**修复方案**：在调用 ffmpeg 前校验路径前缀：
```javascript
if (!absInput.startsWith(path.normalize(PUBLIC_DIR) + path.sep)) {
  throw new Error(`Path escape: ${absInput}`);
}
```

---

### C-3. 前端 XSS 风险 — dangerouslySetInnerHTML 链路脆弱

**位置**：
- `components/NoticeDetailModal.tsx:337, 395`
- `components/ArticleCard.tsx:175, 339`

**现状**：`renderSimpleMarkdown()` → `DOMPurify.sanitize()` → `dangerouslySetInnerHTML`。链路本身当前安全，但：

1. `renderSimpleMarkdown` 先 `escapeHtml` 再重新注入 HTML 标签，逻辑迂回
2. 若 DOMPurify 配置被削弱或升级时行为变化，整条链路失效
3. 缺少 CSP（Content Security Policy）头部作为纵深防御

**修复方案**：
- 用 `react-markdown` 替代手动 HTML 拼接，从根源消除风险
- 部署时配置 CSP：`default-src 'self'; script-src 'self'`

---

### C-4. pinned 字段验证缺失 — 规则执行漏洞

**位置**：`scripts/compile-content.mjs:478`

**规则**：BOT_RULES.md 第 262 行明确列为"不可协商规则"——Bot 不得设置 `pinned: true`。

**现状**：编译脚本读取 pinned 值但**不验证**。示例卡片 `19700102-ai-01.md` 直接写了 `pinned: true`，验证通过无警告。

**修复方案**：
```javascript
// compile-content.mjs 中添加
if (toBoolean(parsed.data.pinned, false) === true && !id.startsWith('1970')) {
  fail('pinned must be false (bot cannot auto-pin)', filePath);
}
```

---

### C-5. description >- 语法无强制验证

**位置**：`scripts/compile-content.mjs:455`

**规则**：BOT_RULES.md 第 113-117 行强制要求 description 使用 YAML `>-` 折叠块标量语法。

**现状**：脚本只读取字符串值，不检查原始 YAML 语法。如果 Bot 用双引号写 description，验证不会拒绝，导致中文引号等特殊字符产生解析问题。

**修复方案**：读取原始文件内容，用正则检查 frontmatter 中 description 行是否以 `>-` 开头：
```javascript
const rawFrontmatter = rawContent.split('---')[1];
if (!/description:\s*>-/m.test(rawFrontmatter)) {
  warn('description should use >- block scalar syntax', filePath);
}
```

---

## 二、严重问题（HIGH）

### H-1. NoticeDetailModal 时间状态依赖缺失

**位置**：`components/NoticeDetailModal.tsx:77-82`

```typescript
const timing = React.useMemo(
  () => getTimeWindowState(article?.startAt, article?.endAt, Date.now()),
  [article?.startAt, article?.endAt]  // ← 缺少 Date.now() 依赖
);
```

`Date.now()` 在每次渲染都变，但未列入依赖数组。导致倒计时状态在 Modal 打开后冻结。

**修复**：使用已有的 `useNow()` hook：
```typescript
const now = useNow();
const timing = React.useMemo(
  () => getTimeWindowState(article?.startAt, article?.endAt, now),
  [article?.startAt, article?.endAt, now]
);
```

---

### H-2. CompiledContent 类型断言无运行时校验

**位置**：`App.tsx:68`

```typescript
contentRes.json() as Promise<CompiledContent>  // 盲目信任
```

如果 `content-data.json` 格式损坏或字段缺失，应用静默崩溃。

**修复**：添加 `zod` schema 校验：
```typescript
const parsed = CompiledContentSchema.safeParse(await contentRes.json());
if (!parsed.success) { /* 降级处理 */ }
```

---

### H-3. 搜索实现无防抖 + 低效遍历

**位置**：`hooks/use-article-filters.ts:126-163`

每次按键触发全量遍历：1000 篇文章 × 5 字段 × `String.includes()` = 5000 次子串搜索。无防抖。

**修复**：
1. 防抖 300ms：`useDebounce(searchQuery, 300)`
2. 预计算小写索引（数据加载时一次性转换）
3. 考虑引入 Lunr.js 或 FlexSearch

---

### H-4. RightSidebar 打字机效果闭包变量泄漏

**位置**：`components/RightSidebar.tsx:41-50, 104-114`

`index` 变量在闭包中捕获但非 ref，组件卸载时 interval 继续运行。

**修复**：改用 `useRef` 追踪 index：
```typescript
const indexRef = React.useRef(0);
```

---

### H-5. ReDoS 风险 — Markdown 正则

**位置**：`scripts/compile-content.mjs:222-245`

```javascript
const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
```

无长度限制的 `[^\]]*` 在恶意构造的 Markdown 输入上可能触发灾难性回溯。

**修复**：添加量词上限：
```javascript
const imgRe = /!\[([^\]]{0,500})\]\(([^)\s]{0,2000})\)/g;
```

---

### H-6. R2 上传端点未验证 HTTPS

**位置**：`scripts/upload-large-attachments-r2.mjs:15-20`

环境变量 `R2_S3_ENDPOINT` 未校验协议。若被设为恶意 URL，凭证会发送到错误服务器。

**修复**：
```javascript
const u = new URL(endpoint);
if (u.protocol !== 'https:') throw new Error('R2 endpoint must use HTTPS');
```

---

## 三、中等问题（MEDIUM）

### M-1. 资产同步静默失败

**位置**：`scripts/compile-content.mjs:635-681`

`fs.cp()` 的 `.catch()` 只打 warn 不抛异常，构建在资产复制失败时仍然成功，但站点加载时图片 404。

**修复**：用 `Promise.allSettled()` + 失败计数，非零则 `process.exit(1)`。

---

### M-2. JSON 输出非原子写入

**位置**：`scripts/compile-content.mjs:615-633`

`content-data.json` 和 `search-index.json` 顺序写入。若进程在两次写入之间崩溃，文件状态不一致。

**修复**：先写临时目录，再原子 rename。

---

### M-3. 缺少 Error Boundary

前端无任何 `ErrorBoundary` 组件。任何子组件抛异常会白屏。至少在 Dashboard、ArticleList、Modal 外层各包一个。

---

### M-4. Vite alias 指向项目根

**位置**：`vite.config.ts`

```typescript
alias: { '@': path.resolve(process.cwd(), '.') }
```

`@` 解析到项目根目录而非 `src/`，理论上可 import 到 `.env` 等敏感文件。

**修复**：
```typescript
alias: { '@': path.resolve(__dirname, './src') }
```

---

### M-5. GitHub Actions 临时文件权限

**位置**：`.github/workflows/deploy.yml:64-81`

`mktemp` 创建的文件默认 world-readable，且下载的 snapshot JSON 在 Node inline 脚本中通过 `process.argv` 传递。

**修复**：`chmod 600 "$TMP_FILE"` + 提取校验逻辑到独立脚本。

---

### M-6. 两套 workflow paths 配置几乎相同

`deploy.yml`（test 分支）和 `deploy-main.yml`（main 分支）的 `paths` 触发列表一样。修改脚本文件会同时触发两条流水线，不符合"main 只人工审核"的设计意图。

**修复**：`deploy-main.yml` 的 paths 应仅包含 `content/**` 和 `config/**`。

---

### M-7. `[ignore]` 标记处理在多个 Skill 间重复

`incremental-process`、`parse-and-create-cards`、`daily-reconcile` 三个 skill 各自声明处理 `## [ignore]`，无共享逻辑，遗漏一处则静默通过。

---

### M-8. Prop Drilling 过深

`App.tsx` 向 `ArticleList` 传递 25+ 个 props。应提取 `FilterContext` 收归状态管理。

---

## 四、低优先级问题（LOW）

| 编号 | 问题 | 位置 |
|------|------|------|
| L-1 | 魔法数字未命名常量（`> 6`、`.slice(0, 4)`、`45/15`） | ArticleCard, RightSidebar, CountdownBar |
| L-2 | `as any` 绕过类型检查 | ArticleList:332 |
| L-3 | 硬编码过滤字符串 `'学院通知'` | ArticleCard:111 |
| L-4 | RSS 输出缺少 `<enclosure>` 附件标签 | generate-rss.mjs:51-75 |
| L-5 | 站点 URL 硬编码 fallback | generate-rss.mjs:13 |
| L-6 | chunkSizeWarningLimit 设为 1000（1MB），过于宽松 | vite.config.ts:26 |
| L-7 | AWS SDK 版本滞后 8 个月（3.896 vs 3.973+） | package.json |
| L-8 | localStorage 配额溢出静默吞错 | use-read-articles.ts:34 |
| L-9 | ARIA label 缺失（学院标签按钮） | ArticleCard:240 |

---

## 五、亮点（做得好的地方）

审计不只是找问题。以下设计值得肯定：

1. **内容数据完整性：优秀** — 抽检 15+ 张卡片，零 schema 违规，frontmatter 100% 合规
2. **两阶段卡片生成**设计理念正确，模板与语义分离
3. **三层 fallback 的订阅映射**（channel → group → unknown），鲁棒性强
4. **DOMPurify 净化链路**虽然迂回但当前有效
5. **工作日志审计追踪**完整，每日记录验证状态
6. **BOT_RULES.md**条理清晰、分层合理，是优秀的规则文档
7. **Git 分支策略**（test 自动、main 人工）设计合理

---

## 六、修复优先级路线图

### 第一阶段：立即修复（1-2 天）

| 问题 | 工作量 | 影响 |
|------|--------|------|
| C-1 路径穿越 | 10 行 | 安全 |
| C-2 ffmpeg 路径校验 | 5 行 | 安全 |
| C-4 pinned 验证 | 3 行 | 规则执行 |
| H-1 时间依赖修复 | 5 行 | 功能正确性 |

### 第二阶段：本周内（3-5 天）

| 问题 | 工作量 | 影响 |
|------|--------|------|
| C-3 XSS 纵深防御（CSP 头） | 配置级 | 安全 |
| H-3 搜索防抖 | 20 行 | 性能 |
| H-5 ReDoS 防护 | 5 行 | 安全 |
| M-1 资产同步失败处理 | 15 行 | 可靠性 |
| M-3 Error Boundary | 30 行 | 稳定性 |

### 第三阶段：两周内

| 问题 | 工作量 | 影响 |
|------|--------|------|
| H-2 运行时类型校验 | 中等 | 健壮性 |
| M-2 原子写入 | 中等 | 数据完整性 |
| M-4 Vite alias | 1 行 | 安全 |
| M-6 workflow paths 分离 | 配置级 | CI/CD |
| M-8 FilterContext 提取 | 大 | 可维护性 |

### 第四阶段：长期优化

- 用 `react-markdown` 替代手动 HTML 拼接
- 引入 FlexSearch 替代暴力搜索
- 统一 Skill 间的 `[ignore]` 处理逻辑
- 升级 AWS SDK
- Lighthouse / Core Web Vitals 优化

---

*审计结束。总计发现 5 个致命问题、6 个严重问题、8 个中等问题、9 个低优先级问题。内容管道数据完整性评级：优秀。*
