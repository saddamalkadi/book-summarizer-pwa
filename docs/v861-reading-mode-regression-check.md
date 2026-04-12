# Reading mode regression check — v8.62 vs v8.61

## Requirement

Reading mode worked well in v8.61 and must **not** regress.

## What changed in v8.62

- **No changes** to `setChatReadingMode`, `syncChatReadingModeUi`, or reading-mode toggles in `app.js`.
- **No changes** to reading-mode selectors except unrelated **normal-mode** chat layout rules.

## Reading mode CSS (unchanged behavior)

`body.chat-page-active.chat-reading-mode` still hides:

- `.topbar`
- `#chatQuickActionBar`
- `#page-chat > .toolbar.mainToolbar`
- `#chatMiniToolbar`
- `#page-chat > .chatbar`  ← entire bar hidden (includes new `.chatbar-composer-cluster` inside it)
- `#page-chat > .composer-meta`
- `#page-chat > .chips`

Exit FAB + `Escape` behavior unchanged.

## Checklist

- [ ] Toggle **قراءة** → chrome hides; **✕ واجهة** / **Escape** restores.
- [ ] `chatLog` gains vertical space; scroll still reaches latest messages.
- [ ] No duplicate or orphaned attach cluster when exiting reading mode.

## Conclusion

Reading mode targets **containers**, not individual composer children, so the composer cluster refactor is **invisible** in reading mode (whole bar hidden).
