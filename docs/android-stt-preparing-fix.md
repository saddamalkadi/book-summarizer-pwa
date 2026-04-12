# Android STT — “preparing” / جارٍ التحضير hang

## Symptom

On the native Android (Capacitor) build, tapping **voice input** set the composer to **`processing`** (“جارٍ التحضير”) and the flow never reached **`listening`** or completion. The UI stayed disabled because `syncVoiceInputButton` disables the button while `dictationState === 'processing'`.

## Root cause

`startNativeComposerDictationSafe()` calls **`await resolveSpeechRecognitionLanguage(plugin)`** before `plugin.start()`.

`resolveSpeechRecognitionLanguage` awaited **`plugin.getSupportedLanguages()`** whenever that method existed. On Android, the community Speech Recognition plugin can expose this API, but the native implementation may **never resolve** the Capacitor bridge call in some OS/version paths (documented quirks around language enumeration / broadcast-style flows). If that promise never settles:

1. `VOICE_RUNTIME.nativeStarting` stays true until the outer function unwinds (it does not).
2. `setComposerDictationState('processing')` remains effectively stuck from the user’s perspective because the code never reaches `start()`, `finally`, or a failure path.

So the “preparing” state was a **real wait on a native call that could hang indefinitely**, not a fake spinner.

## Fix

In `app.js`, **`resolveSpeechRecognitionLanguage`** was updated to:

1. **On native Android** (`isNativeAndroidPlatform()`): **skip** `getSupportedLanguages()` entirely and return the first candidate from `buildSpeechLanguageCandidates(getPreferredSpeechLanguage())` (same locale logic used elsewhere).
2. **On other platforms** that still call it: wrap `getSupportedLanguages()` in **`Promise.race`** with a **~2.4s** timeout; on timeout or error, fall back to the same first candidate.

`startNativeComposerDictation()` (the `popup: true` path) also uses `resolveSpeechRecognitionLanguage`, so it benefits from the same behavior.

## Safety properties

- **No permanent preparing state** from a hung language list: the await always completes.
- **TTS unchanged**: the change is isolated to speech-**recognition** language resolution.
- **Permissions** and **`plugin.start()`** behavior are unchanged; only the preceding language discovery step is hardened.

## Files touched

- `app.js` — `resolveSpeechRecognitionLanguage`.

## Verification checklist (manual / APK)

1. Grant microphone permission when prompted.
2. Tap voice input: UI should move from preparing to listening (or show an error toast and return to ready).
3. Speak a short phrase: text should appear in the composer (or cloud fallback if configured and native returns empty).
4. Confirm TTS / voice playback still works after a reply.
