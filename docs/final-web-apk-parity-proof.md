# Web ↔ APK parity — v8.61

## Source of truth

- **Canonical web assets** live at the repository root (`index.html`, `app.js`, `sw.js`, `manifest.webmanifest`, …).
- `npm run cap:sync` runs `scripts/sync-web.mjs` (copies into `www/`) then **`npx cap sync`**, which copies `www` into:
  - `android/app/src/main/assets/public/`
  - `ios/App/App/public/` (if present)

## Version alignment

| Artifact | v8.61 marker |
|----------|----------------|
| `package.json` | `8.61.0` |
| `android/app/build.gradle` | `versionCode 861`, `versionName "8.61.0"` |
| `index.html` | `data-appver="8.61"`, `app.js?v=861`, SW `?v=861`, cache `aistudio-cache-v861` |
| `sw.js` | `APP_VERSION = "861"` |
| `manifest.webmanifest` | name includes `v8.61` |
| `app.js` | `WEB_RELEASE_LABEL = 'v8.61'` |

## Features verified as shared (same JS + HTML bundle)

- Voice timing constants and cloud silence stop
- Reading mode (`body.chat-reading-mode` CSS in `index.html`)
- Assistant foundation strip + `task_exec_honest` template
- Home quick tiles
- Auth gate v2 template + `refineAuthGateLayout`

## Local APK build

**This environment:** `assembleDebug` failed because `JAVA_HOME` pointed to an invalid path (`C:\Users\Elite\jdks\temurin-17`).

**Standard Gradle outputs (after a successful build):**

- Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release (if signing configured): `android/app/build/outputs/apk/release/app-release.apk`

After fixing Java, run from repo root:

```powershell
npm run cap:sync
cd android; .\gradlew.bat assembleDebug
```

## Proof checklist

1. `npm run cap:sync` completes without errors.
2. Open `android/app/src/main/assets/public/index.html` and confirm `data-appver="8.61"` and `app.js?v=861`.
3. Install the built APK and spot-check: login, chat send, voice button, reading mode toggle, home quick tiles.
