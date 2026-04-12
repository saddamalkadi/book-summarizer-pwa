# Android / mobile premium polish

## Visual and interaction polish

- **Touch-friendly media:** inline images/videos respect `max-width: 100%`, `object-fit: contain`, and capped heights (`min(52vh, …)`) to avoid giant overflow.
- **User bubble contrast:** user-side media shells use slightly darker translucent backgrounds so previews remain readable on the blue user gradient.
- **Assistant markdown media:** rounded corners and light shadow on content images for parity with card-based downloads.
- **Download previews:** `.assistant-preview-media` max height tightened slightly and `max-width: 100%` enforced for small screens.

## Arabic readability

- User text uses `pre.chat-user-text` with inherited font, `line-height: 1.85`, and `word-break: break-word` instead of monospace-only `pre` defaults.

## What we did not change

- No removal of sidebar, login, voice playback, thread drawer, workspace deck collapse behavior, or floating scroll dock.
- No redesign of color system or typography scale beyond the chat/media tweaks above.

## APK / WebView note

Behavior is implemented in shared `index.html` + `app.js` loaded by the Capacitor shell; rebuild the Android asset bundle to ship changes inside the APK.
