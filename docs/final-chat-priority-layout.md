# Chat-priority layout

## Body state classes

| Class | Set when | Purpose |
|-------|----------|---------|
| `chat-page-active` | `openWorkspacePage('chat')` | Global chat-first CSS (web + APK) |
| `chat-has-messages` | `renderChat()` when `messages.length > 0` | Hide empty-state onboarding; optional future rules |
| `android-chat-focus` | Android + chat | Extra compaction (existing v2 rules in `index.html`) |

## Layout strategy

1. **Transcript first** — `#chatLog` gets tighter top padding under `chat-page-active`; bubbles slightly tighter vertical rhythm.
2. **Chrome second** — Main toolbar margins reduced on chat; workspace deck **collapsed on every platform** while chat is the active page so the hero becomes a **compact card** (title + primary quick actions + status strip only).
3. **Composer last** — Padding normalized; meta row stays one line with hint only on focus.

## Workspace deck when collapsed on chat

- **Still visible**: title, primary `wqa` row (with subtitle line hidden via CSS for cleaner look), status strip.
- **Hidden on chat**: `.workspace-use-cases`, `.workspace-nav-shortcuts` (duplicated in sidebar anyway).

## Flex shell

Existing `#page-chat.page.active` flex + `.app:has(#page-chat.page.active)` height rules are unchanged; this pass is additive hierarchy and density, not a new scroll model.
