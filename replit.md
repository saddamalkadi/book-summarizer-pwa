# AI Workspace Studio — v9.0

Arabic AI Workspace Studio PWA — commercial-ready platform with full chat, voice, file processing, and auth.

## Live URLs

- **Frontend**: https://app.saddamalkadi.com (GitHub Pages)
- **API/Worker**: https://api.saddamalkadi.com (Cloudflare Worker)

## Architecture

- **Frontend**: Pure static HTML/CSS/JS PWA (`index.html`, `app.js`, `sw.js`)
- **Server**: `server.mjs` — Node.js static file server + auto-fix Cloudflare Worker on startup
- **Worker**: `keys-worker.js` — deployed directly to Cloudflare (ESM module)
- **Mobile**: Capacitor wrappers for Android/iOS (`capacitor.config.json`)

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Main app entry point |
| `app.js` | Application bundle |
| `sw.js` | Service Worker |
| `server.mjs` | Static server + Cloudflare Worker auto-fix |
| `keys-worker.js` | Worker source (auth, chat, TTS proxy, KV) |
| `convert-worker.js` | File conversion worker |
| `manifest.webmanifest` | PWA manifest |
| `capacitor.config.json` | Capacitor mobile config |

## Running

```
PORT=5000 node server.mjs
```

## Required Env Vars

| Variable | Purpose |
|---------|---------|
| `CF_API_TOKEN` | Cloudflare API token (Workers + KV read/write) |
| `CF_ACCOUNT_ID` | Cloudflare Account ID |
| `CF_KV_NAMESPACE_ID` | Cloudflare KV Namespace ID |
| `OPENROUTER_API_KEY` | OpenRouter API key (injected into Worker) |
| `GITHUB_TOKEN` | GitHub token (auto-push to GitHub Pages) |
| `ADMIN_PASSWORD_REAL` | Admin login password (required for admin access) |
| `APP_ADMIN_EMAIL` | Admin email address |
| `APP_UPGRADE_EMAIL` | Upgrade request email |
| `GOOGLE_CLIENT_ID_WEB` | Google OAuth Client ID |

## System Status (as of v9.0)

| Feature | Status |
|---------|--------|
| Chat (GPT-4o-mini via OpenRouter) | ✅ Working |
| Auth (Email/Password + Google OAuth) | ✅ Working |
| Arabic TTS (`/proxy/tts` via Google Translate) | ✅ Working |
| Voice STT (Cloudflare Workers AI Whisper) | ✅ Working |
| KV Storage (user data, sessions) | ✅ Working |
| File Conversion (`/ocr`, `/convert`) | ✅ Working |
| PWA Install / Service Worker | ✅ Working |
| Health endpoint (`/health`) | ✅ All green |
| Android APK | ✅ Working |
| Dark Mode | ✅ Working |
| Mobile Responsive | ✅ Working |
