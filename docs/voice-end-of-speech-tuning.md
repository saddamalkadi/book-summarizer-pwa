# Voice end-of-speech tuning (v8.61)

## Goals

- Wait for a **natural pause** before treating dictation as finished, without feeling sluggish.
- Separate **end of audio capture** (cloud) from **auto-send after transcript** where useful.
- Avoid regressions in cloud STT, Web Speech API, and native (Capacitor) paths.

## Constants (`app.js`)

| Constant | Value | Role |
|----------|------:|------|
| `VOICE_CLOUD_MAX_RECORD_MS_VOICE` | 16800 ms | Hard cap while continuous voice mode is on |
| `VOICE_CLOUD_MAX_RECORD_MS_SINGLE` | 14800 ms | Hard cap for one-shot cloud dictation |
| `VOICE_CLOUD_SILENCE_HOLD_MS` | 1500 ms | Quiet period after speech before stopping the recorder |
| `VOICE_CLOUD_SILENCE_RMS` | 0.011 | RMS threshold (time-domain) for “sound vs silence” |
| `VOICE_CLOUD_SILENCE_TICK_MS` | 90 ms | Analysis interval |
| `VOICE_CLOUD_MIN_LOUD_MS` | 320 ms | Minimum accumulated “loud” time before silence can end the clip |
| `VOICE_AUTOSEND_AFTER_TRANSCRIPT_MS` | 480 ms | Delay after transcript is applied before `sendMessage()` (cloud + native) |
| `VOICE_WEBSPEECH_END_GRACE_MS` | 1200 ms | After Web Speech `onend`, wait before auto-send |

## Cloud STT (`startCloudComposerDictation`)

Previously, recording stopped on a **fixed timeout** (~5.2–6.5 s), which could cut mid-thought or send too early relative to pauses.

Now:

1. `MediaRecorder` runs until either:
   - **~1.5 s of silence** after at least ~320 ms of detected speech (via `AnalyserNode` on the same mic stream), or
   - **hard max** duration (14.8 s / 16.8 s).
2. After transcription, auto-send uses **`VOICE_AUTOSEND_AFTER_TRANSCRIPT_MS`** (was ~90 ms).

Silence monitoring is cleaned up in `finish()`, `cleanupCloudVoiceCapture()`, and `stopComposerDictation()`.

## Web Speech API (`startComposerDictation`)

`onend` can fire after short pauses while the user still intends to continue in the next breath. Auto-send is delayed by **`VOICE_WEBSPEECH_END_GRACE_MS`**.

`composerWebVoiceSendTimer` is cleared in `stopComposerDictation()` so manual stop does not send.

## Native STT

Post-transcript auto-send uses the same **`VOICE_AUTOSEND_AFTER_TRANSCRIPT_MS`** as cloud (replacing ~90 ms).

## Tuning notes

- If silence never triggers (noisy environment), the **hard max** still stops recording.
- If silence triggers too easily, increase `VOICE_CLOUD_SILENCE_RMS` slightly or `VOICE_CLOUD_SILENCE_HOLD_MS`.
- If auto-send still feels early on web, increase `VOICE_WEBSPEECH_END_GRACE_MS` slightly (trade-off: longer wait after true end).
