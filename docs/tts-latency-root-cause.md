# TTS startup latency — root cause audit

## End-to-end flow (before optimization)

`speakAssistantReply` ran in this order:

1. **`await stopVoicePlayback()`** — including **`await nativeTts.stop()`** with no upper bound. A slow native `stop()` delays every new playback start.
2. **Arabic session** → **`await speakAssistantReplyByProxyTts`** — full HTTP `fetch` to `/proxy/tts`, wait for body, create blob URL, then `play()`. This blocks **all** later paths (including Capacitor native TTS on APK).
3. **`await speakAssistantReplyByCloud`** — authenticated `fetch` to `/voice/speak`, blob, `play()`. Another full round-trip before any local engine.
4. **Capacitor `TextToSpeech.speak`** — only reached after both network paths failed or were skipped.
5. **`resolveSpeechSynthesisLanguage` + `ensureNativeArabicTtsLanguage`** — both called **`chooseSpeechLanguageForNativeTts`**, so **`isLanguageSupported` ran twice** in the worst case.
6. **`chooseSpeechLanguageForNativeTts`** — up to **~15 sequential** `isLanguageSupported` bridge calls for Arabic (each `await`), before **every** `speak()`.

### Web “استماع” (read-aloud, `force: true`)

The same chain applied: **network proxy first**, then cloud, then browser `speechSynthesis`. The fastest path (browser) was **last**, so perceived delay was dominated by **RTT + TTS generation** on the server.

### Android APK

The plugin **`TextToSpeech.speak`** was **after** proxy and cloud attempts. On-device synthesis is typically the **fastest** path but was **queued behind** two optional network steps.

### Other contributors

- **`stripTextForSpeech`** — synchronous string work; minor compared to network.
- **`splitTextForSpeech(text, 220)`** — only affects browser path; modest.
- **Cold `speechSynthesis` voices** — first `speak()` could wait until voices load (mitigated separately with `waitForSpeechVoices`).

## Summary

| Cause | Impact |
|--------|--------|
| Proxy/cloud before native | High on APK and any config where network runs |
| Unbounded `stop()` await | Medium — adds variable delay before any work |
| Duplicate + long `isLanguageSupported` probes | Medium on native — many bridge round-trips |
| Browser TTS last on forced read-aloud | High on web when proxy/cloud configured |
