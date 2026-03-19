# AI Workspace Studio

A static Arabic AI workspace PWA (Progressive Web App) with Capacitor wrappers for Android and iOS.

## Architecture

- **Frontend**: Pure static HTML/CSS/JS app (`index.html`, `app.js`)
- **Server**: Custom Node.js static file server (`server.mjs`)
- **Mobile**: Capacitor wrappers for Android and iOS builds

## Running the App

The app runs via a Node.js static file server:

```
PORT=5000 node server.mjs
```

The server listens on `0.0.0.0:5000` and serves all static files from the project root.

## Key Files

- `index.html` - Main app entry point
- `app.js` - Main application bundle (~500KB)
- `server.mjs` - Static file server (Node.js, no dependencies)
- `auth-bridge.html` - OAuth/authentication bridge page
- `convert-worker.js` - Web Worker for file conversion
- `keys-worker.js` - Web Worker for key management
- `sw.js` - Service Worker for PWA offline support
- `manifest.webmanifest` - PWA manifest
- `capacitor.config.json` - Capacitor mobile configuration

## Mobile Builds

The project includes Android and iOS Capacitor wrappers. Build scripts are in `scripts/` and CI configuration is in `codemagic.yaml`.

## Deployment

Configured for autoscale deployment running `node server.mjs`.
