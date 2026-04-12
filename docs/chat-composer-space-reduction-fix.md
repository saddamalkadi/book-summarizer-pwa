# Chat composer — space reduction fix

Date: 2026-04-12

## Goal

Maximize **visible transcript** by shrinking the sticky bottom stack: `chatbar` + `composer-meta` + attachment `chips`, without breaking send / attach / voice, Arabic readability, sticky behavior, or scroll.

## Changes

### `index.html` (CSS)

Under `body.chat-page-active`:

- Tighter `chatbar` padding and gap.
- **`#composerHint` always hidden** on chat (keyboard help moved to `title` on the textarea in `app.js`).
- **`composer-meta--idle`**: row hidden when there is nothing actionable (no pending attachments, no edit/reuse mode).
- Compact textarea padding, line-height, `min-height`, border radius.
- **`chips-empty`**: hide the chips strip entirely when there are no attachment chips (class set from `app.js`).
- Slightly reduced `chatlog` vertical padding; `padding-bottom` tracks `--floating-nav-bottom` + smaller constant so the transcript uses more viewport.

### `app.js`

- **`syncComposerMeta`**: toggles `composer-meta--idle` on chat when there are no attachments and no active composer edit; clears the status line and returns early to avoid the verbose “files · messages · …” line during normal reading.
- **`updateChatAttachChips`**: toggles `chips-empty` on `#chatAttachChips` after rebuild.
- **`resizeComposerInput`**: lower minimum heights (≈40px mobile / 46px desktop) and cap growth at 200px.
- **`syncStickyShellMetrics`**: `--floating-nav-bottom` now sums **chatbar + visible composer-meta + visible chips** so scroll padding matches the shorter stack when meta/chips are hidden.

### `index.html` (markup)

- Initial `#chatAttachChips` includes `chips-empty` so first paint does not reserve chip space.

## Non-goals

- Did not remove attachment or voice controls.
- Did not change message bubble layout or thread drawer.
