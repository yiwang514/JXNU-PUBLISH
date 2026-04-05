# parse-and-create-cards

## Purpose

Turn merged notice units into stable card files with correct metadata, assets, and natural titles.

## Input Assumptions

- Archive assets come from `archive/YYYY-MM-DD/` provided by the archive submodule.
- Before copying any asset, confirm `archive/` is initialized and synchronized.
- Never treat archive as disposable local temp data. It is a separate repository.

## Card Generation Rules

1. Phase 1 writes template, body source, and copied assets.
2. Phase 2 fills semantic fields one card at a time.
3. Never batch-fabricate `title`, `description`, `category`, `tags`, `start_at`, or `end_at`.

## Title Rules

- Title must stay faithful to the source facts.
- Prefer natural, readable titles.
- Avoid mechanical templates like `关于……的通知` or repeating `……通知` for everything.
- If a shorter natural title can preserve the same facts, use it.
- Do not invent emphasis, scope, or deadlines not present in the notice.

## Time Rules

Classify each notice before filling `start_at` and `end_at`:

### A. Activity-in-progress notices

- `start_at = 活动开始时间`
- `end_at = 活动结束时间`

### B. Registration / submission / collection notices

- `start_at = published`
- `end_at = 报名截止 / 提交截止 / 入群截止 / 收集截止`
- If a registration deadline exists, it overrides the event occurrence time as `end_at`.

### C. Date-only notices

- Use full-day window.
- `start_at = 00:00:00+08:00`
- `end_at = 23:59:59+08:00`

### Hard constraints

- All timestamps use ISO8601 with explicit `+08:00`.
- If both fields exist, `start_at` must be earlier than `end_at`.
- If the time cannot be determined reliably, leave it blank and record `time_uncertain`.

## Supplement Merge Rules

- If a supplement changes deadline, location, target audience, or submission method, update the existing card instead of creating a duplicate.
- When a registration-window card gets a new deadline, keep the registration-window logic consistent: `start_at` should still stay near `published`.

## Asset Rules

- Copy images from `archive/YYYY-MM-DD/photos/` to `content/img/`.
- Copy files from `archive/YYYY-MM-DD/files/` to `content/attachments/`.
- Strip archive hash prefixes when naming copied assets.
- First image becomes `cover`.
- Do not leave archive-relative paths in the final card.
