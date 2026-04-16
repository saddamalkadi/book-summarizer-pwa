# AI Workspace Studio — v8.84

Arabic AI Workspace Studio PWA — commercial-ready platform with full chat, voice, file processing, and auth.

## Live URLs

- **Frontend**: https://app.saddamalkadi.com (GitHub Pages)
- **API/Worker**: https://api.saddamalkadi.com (Cloudflare Worker)
- **Admin**: managed via env vars — see Required Env Vars below

## Architecture

- **Frontend**: Pure static HTML/CSS/JS PWA (`index.html`, `app.js`, `sw.js`)
- **Server**: `server.mjs` — Node.js static file server + auto-fix Cloudflare Worker on startup
- **Worker**: `keys-worker.js` — deployed directly to Cloudflare (ESM module, no bundling needed)
- **Mobile**: Capacitor wrappers for Android/iOS (`capacitor.config.json`)

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Main app entry point (v8.84) |
| `app.js` | Application bundle (?v=884) |
| `sw.js` | Service Worker (APP_VERSION="884") |
| `server.mjs` | Static server + Cloudflare Worker auto-fix |
| `keys-worker.js` | Worker source (auth, chat, TTS proxy, KV) |
| `convert-worker.js` | File conversion worker |
| `manifest.webmanifest` | PWA manifest |
| `capacitor.config.json` | Capacitor mobile config |

## Running

```
PORT=5000 node server.mjs
```

Server starts on `0.0.0.0:5000`, auto-commits/pushes to GitHub, then auto-fixes Cloudflare Worker.

## Cloudflare Worker Auto-Fix (server.mjs)

On every startup, `autoFixWorker()` runs asynchronously:

1. **Health check** → if `upstream_configured: true`, exit early (no action needed)
2. **Download live code** → if key already in code, wait 15s for propagation then exit
3. **Otherwise**: read LOCAL `keys-worker.js` source file
4. **Patch**: inject `OPENROUTER_API_KEY` literal into `getServerKey()` fallback
5. **Upload**: `PUT /workers/scripts/{name}` with metadata including all bindings
6. **Deploy**: `GET /workers/scripts/{name}/versions?limit=1` → deploy that specific UUID

## Required Env Vars

| Variable | Purpose |
|---------|---------|
| `CF_API_TOKEN` | Cloudflare API token (Workers + KV read/write) |
| `OPENROUTER_API_KEY` | OpenRouter API key (injected into Worker) |
| `GITHUB_TOKEN` | GitHub token (auto-push to GitHub Pages) |
| `ADMIN_PASSWORD_REAL` | Admin login password (required — no default) |

## System Status (v8.84)

| Feature | Status |
|---------|--------|
| Chat (via OpenRouter) | ✅ Working |
| Auth (Email/Password + Google OAuth) | ✅ Working |
| Arabic TTS (`/proxy/tts`) | ✅ Working |
| Voice STT (Cloudflare Workers AI Whisper) | ✅ Working |
| KV Storage (user data, sessions) | ✅ Working |
| File Conversion (`/ocr`, `/convert`) | ✅ Working |
| PWA Install / Service Worker | ✅ Working |
| Health endpoint (`/health`) | ✅ All green |
| Android APK (GitHub Actions) | ✅ Release build |
