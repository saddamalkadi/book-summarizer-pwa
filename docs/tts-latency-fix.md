# TTS latency — fix summary

## Changes ( `app.js` )

### 1. Prefer Capacitor native TTS first

When `getNativeTextToSpeechPlugin()?.speak` exists (**Android / iOS APK**), **`nativeTts.speak(...)` runs immediately** after a short stop wait and text prep — **before** proxy or cloud TTS. This removes one or two network round-trips from the critical path.

### 2. Bounded wait on `stop()` before speak

`stopVoicePlayback({ awaitNativeStopMaxMs: 160 })` is used from **`speakAssistantReply` only**. Other callers still use full `await stop()` so stop/replay stays reliable. This caps delay when the previous session’s native `stop()` is slow.

### 3. Fewer + cached `isLanguageSupported` calls

- **`chooseSpeechLanguageForNativeTts`**: Arabic (and non-Arabic) candidate lists shortened to **four** entries instead of fifteen+.
- **`VOICE_RUNTIME.nativeTtsLangCached`**: if the last resolved locale still reports supported, **one** bridge call; otherwise re-probe and update cache.

### 4. Removed duplicate language resolution on speak path

`speakAssistantReply` now calls **`chooseSpeechLanguageForNativeTts` once** per native attempt (previously equivalent work ran via `resolveSpeechSynthesisLanguage` + `ensureNativeArabicTtsLanguage`).

### 5. Web read-aloud (`force: true`): browser before network

When **no** native TTS plugin (typical web) and **`force: true`** (زر «استماع»), **`speakWithBrowserSpeechSynthesis` runs before** proxy and cloud. Voice-mode auto-play (`force: false`) keeps **proxy → cloud → browser** for quality when cloud/proxy are configured.

### 6. Browser path micro-optimizations

- **`waitForSpeechVoices(400)`** inside `speakWithBrowserSpeechSynthesis` only when `getVoices()` is empty (cold start).
- **`splitTextForSpeech(text, 280)`** — slightly fewer handoffs for long answers.
- **Init**: `void waitForSpeechVoices(500)` after registering `voiceschanged` to warm the voice list earlier.

### 7. Blob audio `load()` before `play()`

**`speakAssistantReplyByProxyTts`** and **`speakAssistantReplyByCloud`** call **`audio.load()`** after assigning `src` so the decoder can start sooner before `play()`.

### 8. `window._ttsStop`

Assigned in `init()` to `() => void stopVoicePlayback()` so the listen button’s stop path works without affecting latency.

## Non-goals (unchanged)

- No UI redesign.
- STT / dictation order and plugins untouched.
- No removal of proxy or cloud TTS; only **ordering** and **native-first** where applicable.

## Files touched

- `app.js` — `VOICE_RUNTIME`, `chooseSpeechLanguageForNativeTts`, `stopVoicePlayback`, `speakAssistantReply`, `speakWithBrowserSpeechSynthesis`, proxy/cloud audio, `init`.
