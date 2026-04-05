# incremental-process

## Purpose

Detect new archive data, process incremental notices, write cards/conclusions/worklog, validate, and report the result.

## Preconditions

1. Confirm current branch is `test`. If not on `test`, stop unless the user explicitly approved another branch.
2. Confirm `archive/` is available as the archive data source.
3. Before reading `archive/`, perform submodule checks:
   - If `archive/` is not initialized, run `git submodule init` and `git submodule update` in the main repo.
   - If the task requires latest archive data, enter `archive/` and run `git pull` in the archive repo.
4. Never modify archive files from the main repo context.

## Archive Git Workflow

Archive is managed by its own repository.

- Archive updates must be committed inside `archive/` only.
- Use this flow inside `archive/`:

```bash
git add .
git commit -m "chore: archive YYYY-MM-DD"
git push
```

- Main repo content updates and archive repo updates are separate operations.

## Processing Rules

1. Scan `archive/YYYY-MM-DD/` for new or updated `messages.md` files.
2. Merge segments by `message ID`.
3. Skip `## [ignore]` blocks completely.
4. Route normal notices to card generation.
5. Route supplement/correction notices to merge logic.
6. Update `content/conclusion/**/*.md` and `worklog/**/*.md` when processing completes.
7. Run `pnpm run validate:content` before any main-repo commit.

## Branch Discipline

- Default branch is `test`.
- Without explicit user approval, do not modify, commit, or push on `main`.
- Do not create local commits on `main` first and move them later. That is sloppy and breaks the rule.

## Completion Report Template

Every run must report in this structure:

```md
## 新增卡片
- 卡片 ID / 标题 / 学院

## 并入更新卡片
- 原卡片 ID / 更新原因 / 变更字段

## 来源信息
- 来源群 / 发送者 / 发布时间

## 附件与图片落地
- 新复制附件
- 新复制图片

## 文档更新
- 更新的 `content/conclusion/**/*.md`
- 更新的 `worklog/**/*.md`

## 校验结果
- 命令
- 是否通过
- 失败时的核心原因

## Git 信息
- 当前分支
- archive 仓库是否有提交/推送
- 主仓库是否有提交/推送到 `test`
```

Do not omit Git status. Do not give vague nonsense.
