# AI Workspace Studio — Runtime Notes

## Live Endpoints

- Frontend: `https://app.saddamalkadi.com`
- API gateway: `https://api.saddamalkadi.com`
- Downloads: `https://app.saddamalkadi.com/downloads/`

## Current Runtime Model

- `index.html` + `app.js` + `sw.js` form the shipped web shell.
- `keys-worker.js` serves auth, gateway, storage, voice, and conversion proxying.
- `convert-worker.js` handles OCR / PDF-to-DOCX conversion workloads.
- `server.mjs` is now a static server only. It no longer auto-pushes git changes or mutates Cloudflare deployments.

## Safe Local Run

```bash
PORT=5000 node server.mjs
```

- Static assets are served from the repository root.
- Hidden directories and operational files are not publicly served.
- Local `/proxy/tts` stays disabled unless `ENABLE_TTS_PROXY=true` is explicitly set.

## Production Notes

- Configure Cloudflare Worker secrets directly in the deployment environment.
- Required secrets should be set in Cloudflare Secrets, not embedded in code or docs.
- Release Android builds should use `android/keystore.properties` locally or in CI secrets.
