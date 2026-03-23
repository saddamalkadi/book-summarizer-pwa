# Production Gateway Runtime Fix

## Scope
- Remove the production chat gateway/API mismatch.
- Force the managed web runtime to use the same API gateway root for:
  - auth
  - chat
  - convert proxy
  - OCR proxy

## Root Cause
Production had two separate problems that compounded each other:

1. The frontend could keep an older `gatewayUrl` in local storage from previous deployments or manual settings.
2. The managed hosted UI was not forcing a single source of truth for the runtime service root, so chat could continue to use a stale gateway path even while auth was resolved from the platform service root.

This is why users could still see the error banner:

> رابط البوابة الحالي يطلب Cookie أو Cloudflare Access بينما التطبيق يستخدم جلسة API

even though the intended production API root was `https://api.saddamalkadi.com`.

## Fix Applied
In [app.js](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js):

- Added `isManagedHostedRuntime()`
- Added `alignManagedRuntimeSettings()`
- Forced managed web deployments to normalize runtime settings back to:
  - `authMode = gateway`
  - `gatewayUrl = https://api.saddamalkadi.com`
  - `baseUrl = https://api.saddamalkadi.com/v1`
  - `cloudConvertEndpoint = https://api.saddamalkadi.com/convert/pdf-to-docx`
  - `ocrCloudEndpoint = https://api.saddamalkadi.com/ocr`
- Reset cached auth config when the managed alignment rewrites stale settings.

## Why This Fix Is Safe
- It only applies on the managed hosted UI origins.
- It does not remove any settings or features.
- It preserves advanced capabilities, but prevents production from drifting onto stale or incorrect gateway roots.

## Live Proof
After deploying the worker, live production returned:

### Health
`GET https://api.saddamalkadi.com/health`

Key fields:
- `upstream_configured: true`
- `configured: true`
- `auth_required: true`

### Chat path
`POST https://api.saddamalkadi.com/v1/chat/completions`

Result:
- request completed successfully
- the gateway responded with a valid completion payload
- this confirms the API path itself is now aligned and usable

## Remaining Frontend Validation
The UI banner itself depends on the freshly deployed web bundle loading in the browser.  
The API side is now aligned and healthy; the frontend stabilization relies on the new web bundle using the forced managed runtime alignment on load.
