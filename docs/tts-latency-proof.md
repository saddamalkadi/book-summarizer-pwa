# TTS latency — verification checklist

## Web (browser)

1. Open chat, generate an assistant reply with non-trivial text.
2. Tap **«استماع»** (`force: true`):
   - [ ] First sound should start **without** waiting for a network spinner if the browser has a usable voice (local `speechSynthesis` path).
3. With voice cloud/proxy configured, toggle **voice mode** and let auto-play run (`force: false`):
   - [ ] Order should remain **proxy/cloud first**, then fallbacks — quality preserved.
4. Tap stop while speaking (⏹ on button):
   - [ ] Playback stops; no stuck “speaking” state.

## Android APK

1. Same **«استماع»** on a reply:
   - [ ] **Native TTS** should start without prior delay from `/proxy/tts` or `/voice/speak` when the plugin succeeds.
2. After a long reply, stop and replay:
   - [ ] Second play still works; no duplicate audio overlap.
3. **Dictation** (voice input):
   - [ ] Still starts and completes independently of TTS changes.

## Regression

- [ ] `speakAssistantReply(..., { force: false })` when voice mode off → still returns false immediately.
- [ ] No uncaught rejections from `stop()` when capped at 160ms.

## Notes

- First-ever `speechSynthesis` use on some browsers may still incur a short voice-list delay; init warmup reduces this.
- If native `TextToSpeech` fails on a device, the app **falls back** to proxy → cloud → browser as before.
