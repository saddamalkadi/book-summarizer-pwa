## Android Runtime Parity Fixes

### Scope of this pass
- No redesign
- No iPhone changes
- No feature additions
- Keep current Capacitor project

### What was fixed or validated

#### 1. Web-to-Android asset parity
The following files were verified to match exactly between:
- repository root
- `www/`
- `android/app/src/main/assets/public/`

Verified by SHA-256:
- `index.html`
  - `3F7E681DC94F1AE7AB665F652E63D85F890A787CF85191F4899AA3074B1123A8`
- `app.js`
  - `2A76ACED998B04153F42897AF9BAD3754869A144E58D01F4AE985422872B488C`
- `sw.js`
  - `5373AF20C64A165D3313C6412EB1C9D0BED9FEE956205E04E2B38ED335DE9AAE`
- `manifest.webmanifest`
  - `DB9EE18BFBEEA1046753D1B507C0B24F10ACAB79CDC9032F3BCA4E09688EE40C`

#### 2. APK payload parity
The release APK was extracted and the same mobile shell files inside the APK were hashed.

Hashes inside APK assets:
- `assets/public/index.html`
  - `3F7E681DC94F1AE7AB665F652E63D85F890A787CF85191F4899AA3074B1123A8`
- `assets/public/app.js`
  - `2A76ACED998B04153F42897AF9BAD3754869A144E58D01F4AE985422872B488C`
- `assets/public/sw.js`
  - `5373AF20C64A165D3313C6412EB1C9D0BED9FEE956205E04E2B38ED335DE9AAE`
- `assets/public/manifest.webmanifest`
  - `DB9EE18BFBEEA1046753D1B507C0B24F10ACAB79CDC9032F3BCA4E09688EE40C`

This confirms the APK is carrying the same shell files as the current web source.

#### 3. Capacitor Android runtime validation
Validated:
- `capacitor.config.json`
  - `appId = com.saddamalkadi.aiworkspace`
  - `appName = AI Workspace Studio`
  - `webDir = www`
  - `allowNavigation` includes:
    - `app.saddamalkadi.com`
    - `api.saddamalkadi.com`
    - `convert.saddamalkadi.com`
    - Google/OpenRouter hosts used by the app
- `AndroidManifest.xml`
  - internet permission present
  - microphone permission present
  - custom scheme `aiworkspace://auth` intent filters present
  - `launchMode=singleTask`
  - `windowSoftInputMode=adjustResize`
- `MainActivity.java`
  - `onNewIntent` preserves incoming deep-link intent for post-login return handling

### What was not changed in this pass
- Desktop web behavior
- Product design
- iPhone/iOS path

### Remaining Android-specific verification limits
- The release WebView is not exposing a debuggable devtools socket in this environment.
- `uiautomator` can only see the outer `android.webkit.WebView`, not the inner DOM.
- Because of that, exact inside-WebView interactive proof for sidebar/login/voice/upload still needs manual or device-side validation.
- This is a verification limitation, not a stale asset drift problem.
