## Android Build and Release

### Prerequisites

- JDK 17 or 21 (Temurin recommended)
- Android SDK with platform and build-tools (see project CI workflow)
- Node.js 20+ for Capacitor sync

### 1. Sync web assets into `www/`

```bash
npm run sync:web
```

### 2. Sync Capacitor Android project

```bash
npm run cap:sync
```

### 3. Build for local testing (debug)

```bash
cd android
./gradlew assembleDebug --no-daemon
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### 4. Build release APK / AAB

```bash
cd android
./gradlew assembleRelease bundleRelease --no-daemon
```

Outputs:

- `android/app/build/outputs/apk/release/app-release.apk` (or `app-release-unsigned.apk` depending on AGP)
- `android/app/build/outputs/bundle/release/app-release.aab`

### 5. Signing (release)

Create `android/keystore.properties` (not committed) with:

- `storeFile` — path to your keystore file
- `storePassword`, `keyAlias`, `keyPassword`

When this file is valid, `android/app/build.gradle` applies `signingConfigs.release` to the `release` build type.

If no keystore is configured, release builds fall back to the debug keystore so CI can produce an installable APK for pre-store testing. **Do not use debug-signed builds for Play Store submission.**

### 6. Verify an APK

Use `apksigner verify` from Android build-tools on the release APK you intend to distribute.

### 7. Public download page (`downloads/`)

The hosted trial page ships **APK only** (`ai-workspace-studio-latest.apk`). Store bundles (AAB) are built in a controlled release environment, not linked from the public downloads page.
