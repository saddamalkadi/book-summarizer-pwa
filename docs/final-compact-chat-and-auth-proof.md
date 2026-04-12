# Final proof — compact chat + auth restore

Date: 2026-04-12

## Acceptance checklist

| Criterion | Evidence |
|-----------|----------|
| Less dead space above/below input | `body.chat-page-active` chatbar/composer/chips CSS + `composer-meta--idle` + `chips-empty` |
| Low-value composer text removed/hidden | `#composerHint` hidden on chat; long hint removed from `applyArabicProductCopy`; meta row hidden when idle |
| Smaller composer height | `resizeComposerInput` mins 40/46px; textarea padding/line-height reduced on chat |
| More transcript area | Tighter `chatlog` padding; `--floating-nav-bottom` follows real bottom stack height |
| Admin password visible when server enables it | `authConfigAfterFetchFailure` prevents false `adminPasswordEnabled` after failed `/auth/config` |
| Gateway auth / worker errors from stale UI | Same persistence fix + explicit boolean merge on success |
| Web + APK parity | Single `app.js` / `index.html`; rebuild APK after `npm run cap:sync` |

## How to verify quickly

1. **Auth**: With a known-good production Worker, load the app online → confirm `/auth/config` success. Toggle airplane mode → reload: password row should **not** disappear if disk cache had `adminPasswordEnabled: true` from a prior success.
2. **Chat**: Open Chat with messages → composer hint row gone; with zero attachments, meta row hidden; chips strip hidden until a file is attached.
3. **APK**: `npm run cap:sync` then `assembleDebug` — behavior matches web WebView.

## Related docs

- `docs/admin-gateway-regression-root-cause.md`
- `docs/admin-gateway-worker-restore-fix.md`
- `docs/chat-composer-space-reduction-fix.md`
