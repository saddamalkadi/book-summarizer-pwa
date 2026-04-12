## Android Build and Release

### Environment used
- Repository:
  - `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa`
- JDK used for this pass:
  - `C:\Program Files\Android\Android Studio\jbr`

### Required commands

#### 1. Sync current web into Capacitor web dir
```powershell
& 'C:\Program Files\nodejs\npm.cmd' run sync:web
```

#### 2. Sync Android Capacitor project
```powershell
& 'C:\Program Files\nodejs\npm.cmd' run cap:sync
```

#### 3. Build debug APK
```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
Set-Location 'C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android'
& '.\gradlew.bat' assembleDebug
```

#### 4. Build release APK and AAB
```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
Set-Location 'C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android'
& '.\gradlew.bat' assembleRelease
& '.\gradlew.bat' bundleRelease
```

### Release signing used in this pass

#### APK signing
```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$bt='C:\Users\Elite\AppData\Local\Android\Sdk\build-tools\36.1.0'
& "$bt\apksigner.bat" sign --ks 'C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\release-keystore.jks' --ks-key-alias 'aiworkspace' --ks-pass pass:AiWsStore!2026#K9 --key-pass pass:AiWsStore!2026#K9 --out 'C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\app\build\outputs\apk\release\app-release.apk' 'C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\app\build\outputs\apk\release\app-release-unsigned.apk'
```

#### APK signature verification
```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$bt='C:\Users\Elite\AppData\Local\Android\Sdk\build-tools\36.1.0'
& "$bt\apksigner.bat" verify --print-certs 'C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\app\build\outputs\apk\release\app-release.apk'
```

Verified certificate:
- SHA-1: `56DABCF0F5A47A19051A07F2940FFDFADF7CAF03`
- SHA-256: `590DF9D96E6A13B764AD264B163597B5BB3E91B1E8E60E82E1226BB26DA0E822`

#### AAB signing
```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
& 'C:\Program Files\Android\Android Studio\jbr\bin\jarsigner.exe' -keystore 'C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\release-keystore.jks' -storepass 'AiWsStore!2026#K9' -keypass 'AiWsStore!2026#K9' -signedjar 'C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\app\build\outputs\bundle\release\app-release-signed.aab' 'C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\app\build\outputs\bundle\release\app-release.aab' aiworkspace
```

#### AAB verification
```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
& 'C:\Program Files\Android\Android Studio\jbr\bin\jarsigner.exe' -verify -certs 'C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\app\build\outputs\bundle\release\app-release-signed.aab'
```

### Final output files from this pass
- Debug APK:
  - `android/app/build/outputs/apk/debug/app-debug.apk`
- Signed release APK:
  - `android/app/build/outputs/apk/release/app-release.apk`
- Signed release AAB:
  - `android/app/build/outputs/bundle/release/app-release-signed.aab`

### Copied release files in downloads/
- `downloads/ai-workspace-studio-v8.59-android-release.apk`
- `downloads/ai-workspace-studio-v8.59-android-release.aab`
- `downloads/ai-workspace-studio-latest.apk`
- `downloads/ai-workspace-studio-latest.aab`
