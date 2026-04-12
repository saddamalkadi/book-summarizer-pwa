# Android STT — real recording fix v2

## What “preparing fixed but no recording” meant

After v1, `await resolveSpeechRecognitionLanguage()` no longer blocked forever. The flow reached `plugin.start()` with:

- `popup: false`
- `partialResults: false`

On Android, that path uses **`SpeechRecognizer` inside the app process** (see `SpeechRecognition.java` `beginListening(..., showPopup false)`). The plugin **does not resolve the Capacitor `start` promise until `onResults`** (or it **rejects** on `onError`).

On many **WebView / OEM** stacks this in-process recognizer **never reaches a stable “recording” state** from the user’s perspective: errors like **Client side error**, busy service, or silent failure are common. The UI could sit in “listening” briefly or return without text while the user perceives “nothing recorded.”

Separately, wrapping `start()` in **`Promise.race` with an 18s timeout** is **unsafe for `popup: true`**: the system voice UI can stay open longer than 18s and the JS side would reject while the Activity is still visible.

## v2 fix: Android uses Intent / system UI (`popup: true`)

For **`isNativeAndroidPlatform()`** only, `startNativeComposerDictationSafe()` now:

1. **Skips** `listeningState` binding for this session (the Intent path does **not** emit those events in the plugin Java code).
2. Sets **`listening`** UI **explicitly** before `start()` so the button reflects real user expectation (“mic is active”) once the system sheet opens.
3. Calls `plugin.start({ ..., popup: true })` so Android uses **`startActivityForResult`** → **`listeningResult`** → resolves with `matches` when the user finishes. This is the same reliable path already used by `startNativeComposerDictation()`.
4. **Does not** apply the 18s `STT_TIMEOUT` race on Android (only the in-app / iOS path keeps the race).

## Permissions and errors

- If permission is still denied after `requestPermissions`, the toast now includes **`JSON.stringify(checkPermissions())`** so support can see the exact Capacitor state.
- Native English error strings from the plugin are mapped via **`translateNativeSttError()`** to short Arabic explanations (e.g. client error, no speech, no match, busy, mic permission).
- Activity cancel is treated as cancel (`0` result code) without a scary error toast.

## TTS

`await stopVoicePlayback()` remains **before** STT starts so playback should not hold audio focus during dictation.

## Files touched

- `app.js` — `startNativeComposerDictationSafe`, `translateNativeSttError`, permission toast detail, `finally` calls `syncVoiceInputButton()`.

## Limitation / UX note

The user will see the **system speech recognition UI** (Google / OEM). That is intentional: it is the most reliable way to get **real** audio capture and transcripts on Android WebView.
