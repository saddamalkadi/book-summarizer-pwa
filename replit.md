# AI Workspace Studio — v8.47

Arabic AI Workspace Studio PWA — commercial-ready platform with full chat, voice, file processing, and auth.

## Live URLs

- **Frontend**: https://app.saddamalkadi.com (GitHub Pages)
- **API/Worker**: https://api.saddamalkadi.com (Cloudflare Worker `book-summarizer-pwa-convert`)
- **Admin**: email `tntntt830@gmail.com` / password in `ADMIN_PASSWORD_REAL` env var

## Architecture

- **Frontend**: Pure static HTML/CSS/JS PWA (`index.html`, `app.js` ~530KB, `sw.js`)
- **Server**: `server.mjs` — Node.js static file server + auto-fix Cloudflare Worker on startup
- **Worker**: `keys-worker.js` (source, ~43KB with TTS proxy) — deployed directly to Cloudflare (ESM module, no bundling needed)
- **Mobile**: Capacitor wrappers for Android/iOS (`capacitor.config.json`)

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Main app entry point (v8.47) |
| `app.js` | Application bundle (~530KB, ?v=847) |
| `sw.js` | Service Worker (APP_VERSION="847") |
| `server.mjs` | Static server + Cloudflare Worker auto-fix |
| `keys-worker.js` | Worker source (auth, chat, TTS proxy, KV, Google TTS at /proxy/tts) |
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
2. **Download live code** → if `OR_KEY.substring(0,12)` already in code (CF strips comments), wait 15s for propagation then exit
3. **Otherwise**: read LOCAL `keys-worker.js` source file (avoids multipart extraction issues from services endpoint)
4. **Patch**: inject `OPENROUTER_API_KEY` literal into `getServerKey()` fallback (handles both `env` and `env2` param names, and both single-line and multi-line return formats)
5. **TTS Proxy**: inject `handleGoogleTtsProxy` if not already present (supports both bundled and local source format)
6. **Upload**: `PUT /workers/scripts/{name}` with metadata including all bindings + `OPENROUTER_API_KEY` as `plain_text` binding
7. **Deploy**: `GET /workers/scripts/{name}/versions?limit=1` → deploy that specific UUID via `POST /deployments`

## Critical Facts

- **Worker versions**: Using Cloudflare's Worker Versions (gradual rollout) — each upload creates a versioned entry that must be explicitly deployed
- **Bindings are per-version**: `/script-settings` PATCH fails (error 10004); global bindings don't work; must use `plain_text` binding in each upload's metadata
- **Local source vs bundled**: Deploying `keys-worker.js` (self-contained ESM, ~43KB) instead of the services endpoint extraction (which had multipart `\r` artifact causing SyntaxError at line 1943)
- **Cloudflare strips comments**: The `/*aistudio-key-injected*/` marker won't be in `GET /workers/scripts/{name}` response; use `liveCode.includes(OR_KEY.substring(0,12))` instead
- **Race condition resolved**: Old lingering autoFix processes (from rapid restarts) all deploy within ~3-4 minutes. Once they finish, the health check exits early on subsequent restarts. Run fixes ONLY after all old processes are done (no new versions created for 2+ minutes)

## Cloudflare Account

- **Account ID**: `ea4e90ec8fbd70faefdddd2153064d6f`
- **KV Namespace**: `49d87e2d4989452fb3c680ad024ae5b7`
- **Worker Name**: `book-summarizer-pwa-convert`

## Required Env Vars

| Variable | Purpose |
|---------|---------|
| `CF_API_TOKEN` | Cloudflare API token (Workers + KV read/write) |
| `OPENROUTER_API_KEY` | OpenRouter API key (injected into Worker) |
| `GITHUB_TOKEN` | GitHub token (auto-push to GitHub Pages) |
| `ADMIN_PASSWORD_REAL` | Admin login password (optional, fallback: Saddam@Admin2026!) |

## Phase 5 Release Hardening (مارس 2026)

- **Navigation**: Sidebar restructured to 5 primary (Chat, Files, Projects, Tools, More) + collapsible sub-groups
- **Chat Onboarding**: `#chatOnboarding` div auto-shown/hidden via MutationObserver on `#chatLog`
- **Secondary Toolbar**: `#chatMoreBtn` toggles `.toolbar-secondary-open` class with `aria-expanded`
- **Settings**: OCR/cloud checkboxes moved to Advanced section; main view simplified to 2 checkboxes
- **Accessibility**: Focus rings (`*:focus-visible`), ARIA labels on all interactive elements, 42px+ touch targets
- **Worker Deploy**: UUID fallback — if `PUT /scripts/` response lacks UUID, query `GET /versions?items[0].id`
- **Docs**: accessibility-final-pass, login-voice-production-validation, mobile-device-validation, final-launch-signoff

## System Status (as of v8.47)

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
| Chat Onboarding (MutationObserver) | ✅ Working |
| Secondary Toolbar Toggle (chatMoreBtn) | ✅ Working |
| Worker UUID deploy fallback | ✅ Fixed |
