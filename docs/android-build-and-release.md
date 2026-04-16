## Android Build and Release

### Environments

- **CI (recommended)** — GitHub Actions workflow `.github/workflows/build-apk.yml` builds a release APK on every push to `main` and publishes it to `downloads/`.
- **Local (optional)** — Java 21 + Android SDK 35 + `./gradlew assembleRelease` inside `android/`.

### Release signing

Release signing credentials must NEVER be committed or pasted into docs. They are read from
`android/keystore.properties` at build time. Use the template in
`android/keystore.properties.example` and keep the real file outside version control.

Required keys in `android/keystore.properties`:

```
storeFile=release-keystore.jks
storePassword=...
keyAlias=...
keyPassword=...
```

If `keystore.properties` is absent, the release build falls back to the debug signing key so it
still installs in CI/local environments; this is acceptable for pre-release testing only.

### Build commands

```bash
# Sync web into Capacitor webDir and native project
npm run cap:sync
# Build signed release APK
cd android && ./gradlew assembleRelease
```

Outputs:

- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab` (Play Store only; not distributed to users directly)

### Deliverables

For the public download page we only expose APK, never AAB:

- `downloads/ai-workspace-studio-latest.apk`
- `downloads/ai-workspace-studio-v<version>-android-release.apk`
