# Mobile UX polish plan (chat + Android APK parity)

## Goals

- Keep the existing visual identity and all features.
- Make **model / provider / modes / tools** reachable without scrolling the whole page during long chats.
- Keep the **composer** (input, attach, send, voice) always reachable with fewer Android keyboard / viewport conflicts.
- Scroll **only the transcript** on narrow viewports to avoid fighting between page scroll, sticky regions, and the drawer.
- Show **inline media** in bubbles (user + assistant) where data allows.

## Audit summary (before changes)

- `#page-chat` on small screens used `overflow: auto`, so the **entire** chat page (toolbar, workspace hero, log, composer) scrolled together; the toolbar scrolled away during long threads.
- The composer used **`position: fixed`** at `max-width: 640px`, which often conflicts with Android dynamic viewport / keyboard and required extra bottom padding on `.chatlog`.
- `getChatScrollContainer()` could prefer the page as the scroll parent on mobile, so floating scroll controls targeted the wrong element.
- User messages rendered as a single `<pre>`; attachment visuals existed only in pending chips, not persisted on the saved message.
- `app.js` contained **duplicate** `renderChat` / `addChatAttachments` / `updateChatAttachChips` blocks; only the last definitions executed, hiding edits applied to the wrong copy.

## Implementation strategy

1. **Flex shell (≤980px):** `#page-chat.page.active` becomes a column flex container with `overflow: hidden`; **only** `#chatLog` gets `flex: 1` + `overflow-y: auto`.
2. **Composer in flow:** Replace fixed positioning with a flex footer (`chatbar`, `composer-meta`, `chips`) and safe-area padding.
3. **Toolbar visibility:** With the outer page no longer scrolling, the main toolbar stays in the header stack; on ≤980px, `position: sticky` on the toolbar is forced to `relative` so it does not overlap the global topbar.
4. **Scroll container:** `getChatScrollContainer()` always returns `#chatLog` when the chat page is active and width ≤980px.
5. **User attachments:** Snapshot lightweight previews into `message.attachmentPreviews` on send; render inline HTML in the user bubble.
6. **Cleanup:** Remove dead duplicate functions so future edits apply to the live code path.

## Files touched

- `index.html` — layout CSS for mobile chat shell, composer, inline media, assistant markdown images.
- `app.js` — scroll helpers, send pipeline, attachment snapshots, `renderChat` body, duplicate removal, video/audio inline data URLs when size allows.
