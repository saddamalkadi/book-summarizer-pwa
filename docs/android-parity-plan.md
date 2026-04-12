## Android Parity Plan

### Goal
Make the Android APK track the current live web app as closely as possible without redesigning the product or replacing the existing Capacitor project.

### Single source of truth
- Root web files in the repository are the source of truth:
  - `index.html`
  - `auth-bridge.html`
  - `app.js`
  - `sw.js`
  - `manifest.webmanifest`
  - `icons/`

### Parity path
1. Sync root web assets into `www/`
   - `npm run sync:web`
2. Sync Capacitor Android assets from `www/` into:
   - `android/app/src/main/assets/public/`
   - `npx cap sync android`
3. Build Android outputs from the synced Capacitor project
4. Verify that the built APK actually contains the same shell files as root web

### What was drifted historically
- Root web and Android bundled assets had drifted in earlier rounds of work.
- The current parity pass revalidated the mobile-critical files across:
  - root
  - `www/`
  - `android/app/src/main/assets/public/`

### Mobile-critical files verified in this pass
- `index.html`
- `app.js`
- `sw.js`
- `manifest.webmanifest`
- `auth-bridge.html` was also checked during sync/config inspection

### Expected result
- Android APK should ship the same app shell as live web `v8.60`
- Any remaining difference should be Android runtime specific, not stale asset drift
