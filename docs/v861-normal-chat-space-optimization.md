# Normal chat space optimization (post–v8.61) — shipped in v8.62

## Goals

- More **visible `chatLog` area** in **normal** chat mode (not only reading mode).
- Keep **reading mode** behavior unchanged (separate selectors; reading mode still hides the full composer stack).

## Changes

### 1) Vertical chrome compression (`index.html` CSS, `body.chat-page-active`)

- **Top bar:** slightly reduced vertical padding.
- **Quick action sub-bar (`#chatQuickActionBar`):** reduced `padding-block`.
- **Main chat toolbar:** tighter padding, margins, radius, and softer shadow.
- **Assistant foundation strip:** slightly smaller padding/margin.
- **Composer row (`.chatbar`):** less padding, smaller gaps, `flex-wrap: nowrap` where appropriate.
- **Attachment chips (non-empty):** slightly tighter padding/gap.
- **Bubbles:** slightly reduced bottom margin.

### 2) Attachment + input merged visually

- Wrapped `#chatAttachBtn` + `#chatInput` in **`.chatbar-composer-cluster`** so the attach control shares one **unified field** with the text area (no separate full-width row for attach).
- **Hidden file input** stays a direct child of `.chatbar` (unchanged id `chatAttachFiles`).
- `app.js` still upgrades `#chatInput` to `<textarea>` inside the cluster; IDs unchanged.

### 3) Reading mode

- Reading mode rules still target `#page-chat > .chatbar` and hide it entirely — the cluster does not require separate reading-mode changes.

## Files

- `index.html`: chatbar markup, `body.chat-page-active` layout CSS, dark mode border for cluster.

## Non-goals

- No change to STT/TTS/send pipelines.
- No removal of toolbar capabilities — only density.
