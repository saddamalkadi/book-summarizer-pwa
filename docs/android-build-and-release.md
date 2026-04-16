## Android Build and Release

### 1. Sync web into Capacitor

```bash
npm run cap:sync
```

### 2. Build (local)

```bash
cd android
./gradlew assembleRelease bundleRelease
```

Outputs:

- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

### 3. Release signing

Create `android/keystore.properties` (never commit; paths are gitignored) with:

- `storeFile` — path to the keystore file
- `storePassword`, `keyAlias`, `keyPassword`

When this file is present, `assembleRelease` / `bundleRelease` use the release signing config. Otherwise Gradle falls back to the debug keystore so CI can still produce an installable APK.

Sign or verify with Android SDK `apksigner` / `jarsigner` as needed for your keystore.

### 4. Publishing APK for testers

After a release build, copy the APK to `downloads/` with a stable name (for example `ai-workspace-studio-latest.apk`) and update `downloads/index.html` if the marketed version string changes. GitHub Actions builds `assembleRelease` on each push to `main` and attaches artifacts to the matching GitHub Release.
