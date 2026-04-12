# Android real device — proof checklist v2

## Build

```bash
npm run cap:sync
cd android
./gradlew.bat :app:assembleDebug
```

APK output:

`android/app/build/outputs/apk/debug/app-debug.apk`

## Layout (must be obvious on device)

- [ ] On Android APK, `body` has class **`native-android`** (inspect via remote WebView debugging if needed).
- [ ] With **Chat** open, `body` has **`android-chat-focus`**.
- [ ] **Workspace** band is **collapsed** (or strip hidden) even on **empty** chat.
- [ ] **Chat toolbar** defaults **collapsed** on first install (expand via ⚙ mini bar).
- [ ] **Transcript** area is visibly taller: tight padding, smaller bubbles vs pre-v2 screenshot.

## STT (must record for real)

- [ ] Tap voice: status hints that **system mic UI** will open.
- [ ] **Google / system** voice sheet appears; speak; **text** lands in composer.
- [ ] Cancel sheet: app returns to **ready**, no stuck state.
- [ ] Deny permission: toast shows **permission JSON** snippet.
- [ ] After assistant TTS, tap voice again: still works (playback stopped before STT).

## Sign-off

| Device / OS | Layout OK | STT OK | Notes |
|-------------|-----------|--------|-------|
| | | | |
