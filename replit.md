# AI Workspace Studio

Arabic AI Workspace Studio — static PWA served from GitHub Pages with optional Cloudflare Worker gateway.

## Live URLs

- **Frontend**: https://app.saddamalkadi.com (GitHub Pages, see `CNAME`)
- **API gateway**: `api.saddamalkadi.com` (Cloudflare Worker, source in `keys-worker.js`)

## Architecture

- **Frontend**: Pure static HTML/CSS/JS PWA (`index.html`, `app.js`, `sw.js`)
- **Dev server**: `server.mjs` — plain static file server used only for local preview
- **Worker**: `keys-worker.js` — gateway source deployed to Cloudflare
- **Mobile**: Capacitor wrappers for Android/iOS (`capacitor.config.json`)

## Running locally

```bash
PORT=8080 node server.mjs
```

The server listens on `0.0.0.0:$PORT` and serves the repository as a static site.

## Environment variables (optional)

The local server never writes anything by default. A few optional variables unlock advanced developer-only workflows:

| Variable | Purpose |
|---------|---------|
| `AUTO_FIX_WORKER` | When set to `true`, enables the opt-in helper that patches the Cloudflare Worker using the variables below. Off by default. |
| `CF_API_TOKEN` | Cloudflare API token with Workers + KV permissions. Only used when `AUTO_FIX_WORKER=true`. |
| `CF_ACCOUNT_ID`, `CF_KV_NS`, `CF_WORKER_NAME` | Cloudflare account identifiers used by the opt-in helper. |
| `OPENROUTER_API_KEY` | OpenRouter API key used by the opt-in helper only. Never shipped in the client. |
| `ADMIN_PASSWORD_REAL` | Admin password used by the opt-in helper only. Never hardcoded. |

No secret has a hardcoded fallback inside the repository. If the required variables are missing the helper simply exits silently.

## Release pipeline

1. Push to `main` — GitHub Pages publishes the new web version.
2. `.github/workflows/build-apk.yml` builds the release APK and attaches it to `downloads/ai-workspace-studio-latest.apk` plus a versioned copy, and creates a GitHub Release.
3. `downloads/index.html` is the user-facing download page (APK-only).

The AAB artifact is not published through the public downloads page; it is produced internally when needed for Play Console submissions.
