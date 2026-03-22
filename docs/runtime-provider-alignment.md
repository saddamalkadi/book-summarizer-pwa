# Runtime Provider Alignment

Date: 2026-03-22

## Current text chat path in source

Source files:

- `app.js`
- `keys-worker.js`

Current path:

1. Web and APK defaults point to:
   - provider = `openrouter`
   - authMode = `gateway`
   - gateway root = `https://api.saddamalkadi.com`
2. The gateway worker forwards chat to OpenRouter.
3. This path requires live upstream configuration:
   - `OPENROUTER_API_KEY`

Conclusion:

- The intended final text-chat provider path is **OpenRouter via gateway**.
- It is not Google/Gemini anymore.

## Current voice path in source

### Voice STT

- Client capture:
  - Android native speech-recognition plugin
  - browser speech-recognition or media capture fallback
- Optional cloud transcription:
  - `POST https://api.saddamalkadi.com/voice/transcribe`

### Voice TTS

- Client playback:
  - native Android TTS
  - browser speech synthesis fallback
- Optional cloud synthesis:
  - `POST https://api.saddamalkadi.com/voice/speak`

Current live provider:

- `workers_ai`

## What changed vs the older Replit/Google layer

Previously:

- Arabic text chat reportedly worked through an earlier Replit/Google-style path.
- That path was more tolerant for Arabic text responses because it was not blocked on the OpenRouter gateway key.

Now:

- Source defaults and runtime plumbing were unified around gateway + OpenRouter.
- Voice was also moved toward Worker-backed cloud routes.
- But production text chat lost its upstream key, so the new path became half-configured:
  - auth works
  - voice endpoints work
  - text chat upstream does not

## Why Arabic worked before and then degraded

Arabic text worked before because:

- the older path was effectively using a different provider layer that remained configured

Arabic voice degraded because:

- TTS language handling was over-normalized to bare `ar`
- browser/native voice selection became unstable
- long Arabic text was not chunked safely

## What should be adopted finally

Recommended final provider strategy:

- **Text chat**: OpenRouter via `https://api.saddamalkadi.com`
- **Voice STT/TTS**: Worker-backed routes via `https://api.saddamalkadi.com`
- **Do not keep a mixed text-provider model**

Why:

- one gateway root for auth, chat, voice, and convert is operationally cleaner
- Android and web can be made consistent
- logging, quotas, and pricing stay centralized

## Required production secrets/services

### For text chat

- `OPENROUTER_API_KEY`

### For admin password login

- `APP_ADMIN_PASSWORD`

### For OCR on scanned PDFs

One of:

- `OPENROUTER_API_KEY` suitable for OCR path
- `OCR_UPSTREAM_URL`

## Single source of truth

The product should treat the following as canonical:

- Public web app: `https://app.saddamalkadi.com`
- Runtime API root: `https://api.saddamalkadi.com`
- Convert path: `https://api.saddamalkadi.com/convert/pdf-to-docx`
- OCR path: `https://api.saddamalkadi.com/ocr`
