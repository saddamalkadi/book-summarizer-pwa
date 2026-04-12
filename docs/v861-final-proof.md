# v8.62 final proof — regression fix + compact normal chat

## Version markers

| Location | Value |
|----------|--------|
| `package.json` | `8.62.0` |
| `index.html` `data-appver` | `8.62` |
| `index.html` script | `app.js?v=862` |
| SW registration | `sw.js?v=862` |
| `sw.js` `APP_VERSION` | `862` |
| `app.js` `WEB_RELEASE_LABEL` | `v8.62` |
| Android `versionCode` / `versionName` | `862` / `8.62.0` |

## A — Admin password

- **Cause:** Boot wiped `authConfigCache`; failed `/auth/config` merged with **no previous snapshot** → defaults hid password.
- **Fix:** Stop wiping cache every `init()`; improve merge when `adminEnabled` without `adminLoginMethod`.

## B — Gateway

- **Cause:** Same poisoned cache removed `googleClientId` and related flags after transient config fetch failures.
- **Fix:** Preserve last good cached `/auth/config` across reloads unless a successful fetch replaces it.

## C — Normal chat space

- Tighter `chat-page-active` chrome (top bar, subtopbar, main toolbar, foundation strip, composer, chips, bubbles).
- **Composer cluster:** attach + input in one visual control; file input remains separate for `change` events.

## D — Reading mode

- Unchanged logic; full `.chatbar` still hidden in reading mode.

## E — Verification commands

```bash
node --check app.js
```

Manual:

1. Hard reload after deploy; confirm `app.js?v=862` in Network.
2. Auth gate with admin email → password row when server allows password path.
3. Normal chat: attach sits inside clustered field; more log lines visible vs v8.61.
4. Reading mode on/off cycle.
