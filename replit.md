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

## Environment variables

The local `server.mjs` is a pure static file + `/proxy/tts` server. It never writes to Cloudflare anymore.

The legacy `AUTO_FIX_WORKER` / `CF_API_TOKEN` / `ADMIN_PASSWORD_REAL` code path was removed in v8.98 because it overwrote production Worker bindings on every process start and every 5 minutes, causing `APP_ADMIN_PASSWORD` and `OPENROUTER_API_KEY` to oscillate between good and dropped states. Setting `AUTO_FIX_WORKER=true` is now a no-op and prints a warning.

**Production deploys and secret rotations** are handled exclusively by:

- `wrangler deploy --config wrangler.jsonc` for the Worker code.
- `wrangler secret put APP_ADMIN_PASSWORD --name sadam-key` and `wrangler secret put OPENROUTER_API_KEY --name sadam-key` for secret rotation.
- `scripts/rotate-production-secrets.sh` — one-shot script that does all of the above and validates live endpoints.
- `.github/workflows/rotate-worker-secrets.yml` — CI equivalent, triggered via `workflow_dispatch` or by touching `.github/rotate-trigger`.

## Release pipeline

1. Push to `main` — GitHub Pages publishes the new web version.
2. `.github/workflows/build-apk.yml` builds the release APK and attaches it to `downloads/ai-workspace-studio-latest.apk` plus a versioned copy, and creates a GitHub Release.
3. `downloads/index.html` is the user-facing download page (APK-only).

The AAB artifact is not published through the public downloads page; it is produced internally when needed for Play Console submissions.
