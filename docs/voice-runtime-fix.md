# Voice Runtime Fix

Date: 2026-03-22

## Scope

This document covers:

- Android voice input button
- Arabic TTS correctness
- browser and Android runtime paths

## Root causes

### Android voice input

- Native recognition, cloud capture, and browser fallback shared one control path.
- The native branch did not return structured fallback signals.
- Cancellation and plugin failure could leave the UI idle without starting the next valid path.

### Arabic TTS

- Language tags were degraded to bare `ar`.
- Voice engines often need regional Arabic tags such as `ar-SA`.
- Long Arabic output was spoken in one fragile utterance.

## Local fixes now present in source

### Frontend

File:

- `app.js`

Implemented locally:

- preserve Arabic language preference as `ar-SA`
- detect Arabic text before speech output
- chunk long Arabic text into safer speech segments
- route browser TTS through `speakWithBrowserSpeechSynthesis()`
- make Android dictation return structured result objects:
  - `success`
  - `fallbackAllowed`
  - `cancelled`
- fall back from native Android capture to cloud STT when appropriate
- use browser-based Google auth path for Android sign-in consistency

### Backend

File:

- `keys-worker.js`

Implemented locally:

- preserve Arabic regional tags in `normalizeVoiceLanguageTag()`
- default preferred language to `ar-SA`
- route Arabic cloud TTS requests through the Google TTS proxy path for determinism
- keep Workers AI for non-Arabic synthesis

## Required live proof

### Web

Need to verify:

1. open `https://app.saddamalkadi.com`
2. sign in
3. send Arabic text response
4. trigger voice playback
5. confirm:
   - Arabic voice is selected
   - the full response is spoken
   - not a single English token

### Android

Need to verify:

1. install the latest APK
2. grant microphone permission
3. press voice input button
4. speak Arabic
5. confirm transcript is inserted and/or auto-sent

## Blockers to final proof

- no Android device is attached to this audit environment
- web domain connectivity from this shell is unstable, so browser proof must be captured from user-side runtime or a connected test device
