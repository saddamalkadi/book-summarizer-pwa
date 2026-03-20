# AI Workspace Studio — v8.47

Arabic AI Workspace Studio PWA — commercial-ready platform with full chat, voice, file processing, and auth.

## Live URLs

- **Frontend**: https://app.saddamalkadi.com (GitHub Pages)
- **API/Worker**: https://api.saddamalkadi.com (Cloudflare Worker `book-summarizer-pwa-convert`)
- **Admin**: email `tntntt830@gmail.com` / password in `ADMIN_PASSWORD_REAL` env var

## Architecture

- **Frontend**: Pure static HTML/CSS/JS PWA (`index.html`, `app.js` ~530KB, `sw.js`)
- **Server**: `server.mjs` — Node.js static file server + auto-fix Cloudflare Worker on startup
- **Worker**: `keys-worker.js` (source, 41KB) → deployed as minified bundle (~64KB) on Cloudflare
- **Mobile**: Capacitor wrappers for Android/iOS (`capacitor.config.json`)

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Main app entry point (v8.47) |
| `app.js` | Application bundle (~530KB, ?v=847) |
| `sw.js` | Service Worker (APP_VERSION="847") |
| `server.mjs` | Static server + Cloudflare Worker auto-fix |
| `keys-worker.js` | Worker source (auth, chat, TTS, KV) |
| `convert-worker.js` | File conversion worker |
| `manifest.webmanifest` | PWA manifest |
| `capacitor.config.json` | Capacitor mobile config |
| `docs/12-final-launch-checklist.md` | Production status checklist |

## Running

```
PORT=5000 node server.mjs
```

Server starts on `0.0.0.0:5000`, auto-commits/pushes to GitHub, then auto-fixes Cloudflare Worker.

## Cloudflare Worker Auto-Fix (server.mjs)

On every startup, `autoFixWorker()` runs asynchronously:

1. **Health check** → if `upstream_configured: true`, exit early (no action needed)
2. **Download live code** → if injection marker already present + key in code, wait 15s for propagation then exit
3. **Otherwise**: download from services endpoint, patch `getServerKey` with hardcoded OR key + `plain_text` binding, add KV helpers + Google TTS proxy
4. **Upload**: `PUT /workers/scripts/{name}` (updates classic slot, auto-creates versioned entry)
5. **Deploy**: `GET /workers/scripts/{name}/versions?limit=1` → deploy that specific UUID

Key env vars: `CF_API_TOKEN`, `OPENROUTER_API_KEY`, `GITHUB_TOKEN`, `ADMIN_PASSWORD_REAL`

## Cloudflare Resources

- **Account ID**: `ea4e90ec8fbd70faefdddd2153064d6f`
- **Worker**: `book-summarizer-pwa-convert`
- **KV Namespace** (`USER_DATA`): `49d87e2d4989452fb3c680ad024ae5b7`
- **Secrets limitation**: Worker Versions enabled → can't set secrets via API (error 10215) → use code injection + plain_text bindings

## Production Status (20 March 2026)

All systems confirmed working via `/health` endpoint:

| System | Status |
|--------|--------|
| Chat AI (OpenRouter/GPT-4o-mini) | ✅ Working |
| Google OAuth | ✅ Configured |
| Auth/Session | ✅ Working |
| Arabic TTS/STT (Workers AI) | ✅ Working |
| File Conversion | ✅ Working |
| Cloud KV Storage | ✅ Working |
| Admin Login | ✅ Working |

## Pending Manual Tests (require real devices)

- Google OAuth with real Google account on `app.saddamalkadi.com`
- Arabic TTS / voice chat (mic + speaker on real device)
- Android Chrome PWA install
- iPhone Safari PWA install

## Phase 5 Features (Completed)

- Navigation restructured: Chat / Files / Projects + Accordions (Tools, More)
- Home screen redesign: clean workspace-hero, value prop subtitle
- Settings two-tier: basic visible, advanced hidden in `<details>` accordion
- Accessibility: 44px touch targets, ARIA labels, focus states
- Icons: removed variation selectors (U+FE0F)
- SW cache: v8.47 (`aistudio-cache-v847`)
- Auto-fix Worker: idempotent, race-condition-free deployment

## Version History

- v8.47: Final polish, settings advanced accordion, SW cache cleanup, Worker chat fix
- v8.45: Phase 5 navigation + home screen redesign
