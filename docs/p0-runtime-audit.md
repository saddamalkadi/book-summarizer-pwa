# P0 Runtime Audit

Date: 2026-03-22
Repo: `book-summarizer-pwa`
Scope: runtime audit for the live product paths without rebuilding from scratch

## Live runtime facts

Verified against production API:

- `GET https://api.saddamalkadi.com/health`
  - `ready = true`
  - `configured = true`
  - `upstream_configured = false`
  - `admin_password_ready = false`
  - `admin_google_ready = true`
  - `admin_login_ready = true`
  - `voice_cloud_ready = true`
  - `voice_stt_ready = true`
  - `voice_tts_ready = true`
  - `voice_provider = "workers_ai"`
- `GET https://api.saddamalkadi.com/auth/config`
  - `adminEnabled = true`
  - `adminPasswordEnabled = false`
  - `adminLoginMethod = "google_only"`
  - `googleClientId` is configured
  - `voiceCloudReady = true`
  - `voiceSttReady = true`
  - `voiceTtsReady = true`
  - `voiceProvider = "workers_ai"`
  - `voicePreferredLanguage = "ar"`
- `GET https://api.saddamalkadi.com/convert/health`
  - `docxMode = "cloudconvert"`
  - `fidelityReady = true`
  - `ocrReady = false`

Important consequence:

- Auth and voice services are alive.
- Password-based admin login is not active in production because `APP_ADMIN_PASSWORD` is not configured live.
- Text chat still cannot be considered healthy in production because upstream chat is not configured (`OPENROUTER_API_KEY` missing).
- PDF to Word high-fidelity conversion works.
- OCR for scanned documents is still not production-ready.

## Root causes by P0 area

### 1. Android voice input button

Files:

- `app.js`
- `android/app/src/main/AndroidManifest.xml`

Relevant functions:

- `startComposerDictation()`
- `startNativeComposerDictationSafe()`
- `startCloudComposerDictation()`
- `toggleComposerDictation()`

Root cause:

- The Android path mixes three runtime branches in one control surface:
  - native speech recognition plugin
  - cloud STT capture
  - browser speech-recognition fallback
- Before the local fix pass, the native branch returned boolean-only results, which made fallback behavior opaque and caused silent termination after cancellation or plugin failure.
- There is still no attached Android device or `adb logcat` evidence in this audit environment, so the exact device-side failure string is still unproven.

### 2. Arabic TTS speaking English or one token

Files:

- `app.js`
- `keys-worker.js`

Relevant functions:

- `getVoiceApiConfig()`
- `normalizeVoiceLanguageTag()`
- `speakAssistantReplyByCloud()`
- `speakAssistantReply()`
- `speakWithBrowserSpeechSynthesis()`

Root cause:

- Production still advertises `voicePreferredLanguage = "ar"`, which is too generic for reliable Arabic voice selection on browser and native engines.
- The previous voice path treated the returned language as a single engine-wide tag and spoke the entire response as one utterance, which is fragile with Arabic punctuation and long text.
- The backend and frontend were not aligned on region-preserving Arabic tags such as `ar-SA`.

### 3. Login screen route is not really cleaned

Files:

- `app.js`

Relevant functions:

- `ensureAccountChrome()`
- `refineAuthGateLayout()`
- `syncUnifiedAuthEntry()`

Root cause:

- The real login UI is injected dynamically in JavaScript, not defined as a stable route page in `index.html`.
- Any cleanup outside `ensureAccountChrome()` is invisible to the actual runtime route.
- The template still contains duplicated explanatory blocks, plan messaging, and admin/user hints unless the cleanup pass runs every time against the injected markup.

### 4. Wrong post-login landing

Files:

- `app.js`
- `auth-bridge.html`

Relevant functions:

- `consumeAuthPayload()`
- `buildBrowserGoogleAuthUrl()`
- `setActiveNav()`

Root cause:

- The app previously restored the active tab or defaulted to chat, rather than using one canonical post-login destination.
- Browser auth and bridge auth could pass inconsistent `target_page` / `return_to` data.
- The product still lacks a dedicated workspace-home route, so "correct landing" is not formally modeled yet.

### 5. Sticky input and scroll FAB

Files:

- `index.html`
- `app.js`

Relevant functions:

- `getChatScrollContainer()`
- `syncChatScrollDock()`
- `scrollChat()`
- `resizeComposerInput()`

Root cause:

- Mobile chat was split between two competing scroll containers:
  - `#page-chat`
  - `#chatLog`
- CSS and scroll JS were written assuming a single authoritative scroller.
- The composer starts life as an `<input>` in HTML and is converted later, so sticky/layout math can briefly target the wrong assumptions.

### 6. Admin password cannot be changed

Files:

- `keys-worker.js`
- `wrangler.jsonc`

Root cause:

- Admin password is currently a deployment-time Worker secret only:
  - `APP_ADMIN_PASSWORD`
- There is no runtime API or persisted credential store for changing it from inside the app.
- Therefore "change admin password" is a missing product feature, not a broken button.

### 7. Logout / exit UX

Files:

- `app.js`

Relevant functions:

- `logoutCurrentAccount()`
- `openAccountCenter()`
- `ensureAccountChrome()`

Root cause:

- Logout exists inside settings/account UI but is not elevated into a globally obvious action.
- Exit/back behavior on Android is still default shell behavior, not an intentional product flow.
- There is no dedicated success/feedback surface after logout beyond reopening the auth gate.

### 8. Laptop readability and scrolling

Files:

- `index.html`
- `app.js`

Root cause:

- The shell has too many stacked sticky regions and too much pre-chat chrome on wider screens.
- Reading width is partly controlled, but the visible information density remains high.
- Conversation-first readability competes with workspace controls for above-the-fold space.

## Cross-cutting provider facts

### Text chat path

- Repo default:
  - provider = `openrouter`
  - authMode = `gateway`
  - gateway = `https://api.saddamalkadi.com`
- Production blocker:
  - `OPENROUTER_API_KEY` is missing on the live Worker
- Result:
  - auth can succeed while text chat still fails

### Voice path

- STT:
  - browser/native capture on client
  - optional cloud transcription via `https://api.saddamalkadi.com/voice/transcribe`
- TTS:
  - browser/native playback on client
  - cloud speech via `https://api.saddamalkadi.com/voice/speak`
- Current live provider:
  - `workers_ai`

### Convert path

- `PDF -> DOCX`:
  - `https://api.saddamalkadi.com/convert/pdf-to-docx`
- OCR:
  - `https://api.saddamalkadi.com/ocr`
- Current live state:
  - DOCX fidelity ready
  - OCR not ready

## Priority order

1. Voice runtime proof and Arabic output correctness
2. Login + auth bridge consistency
3. Post-login landing determinism
4. Sticky input + floating scroll controls
5. Admin password management architecture
6. Logout / exit UX
7. Laptop readability pass
