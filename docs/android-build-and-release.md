## Android Build and Release

### Goal

This document describes the safe release flow for the Android trial build. It intentionally avoids storing passwords, private keystore values, or local machine-specific secrets in the repository.

### Preconditions

- `package.json` version is the intended release version.
- Cloud/runtime secrets are configured outside the repo.
- `android/keystore.properties` exists locally or in CI secrets when a real release signature is required.
- Web assets are synced from the same final source revision before building Android.

### Required commands

#### 1. Sync final web assets
```bash
npm run sync:web
```

#### 2. Sync Capacitor projects
```bash
npm run cap:sync
```

#### 3. Build release APK
```bash
cd android
./gradlew assembleRelease
```

#### 4. Build release AAB
```bash
cd android
./gradlew bundleRelease
```

### Output locations

- Release APK:
  - `android/app/build/outputs/apk/release/app-release.apk`
- Release AAB:
  - `android/app/build/outputs/bundle/release/app-release.aab`

### Signing notes

- Do **not** commit keystore files, passwords, or command lines containing real secrets.
- Use `android/keystore.properties` locally or inject it in CI.
- If no release keystore is configured, the repository fallback signs the release APK with the debug keystore for installability only. That is acceptable for internal validation, but not for store distribution.
- For store submission, use a real release keystore and verify the signed artifact in your secured environment.

### Distribution notes

- The public trial channel should expose the APK only.
- Keep AAB artifacts for store operations and internal release handling, not for general end-user download pages.
