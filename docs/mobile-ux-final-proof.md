# Mobile UX final proof (verification checklist)

This document records **what changed in the repository** and how to **manually verify** on Android APK or mobile browser. Automated device testing was not run in CI from this environment.

## Code changes (evidence)

| Area | File | What to look for |
|------|------|------------------|
| Mobile chat flex shell | `index.html` | `@media (max-width:980px)` rules for `#page-chat.page.active` + `.chatlog` flex/overflow |
| Composer not fixed | `index.html` | ≤640px `#page-chat.page.active > .chatbar` uses `position: relative` + safe-area |
| Scroll container | `app.js` | `getChatScrollContainer()` early-return `chatLog` when ≤980px + chat active |
| Scroll to bottom | `app.js` | `scrollChatToBottom()` avoids extra `window.scrollTo` in mobile shell |
| User inline media | `app.js` | `snapshotAttachmentsForMessage`, `renderUserAttachmentPreviewsHtml`, `sendMessage` sets `attachmentPreviews` |
| Video/audio data URLs | `app.js` | `addChatAttachments` branch for `(video\|audio) && size <= 4MiB` |
| Dead code removal | `app.js` | Removed duplicate `renderChat` / `addChatAttachments` / `updateChatAttachChips` / duplicate `syncComposerMeta` |
| Assistant markdown media | `index.html` | `.bubble.assistant .body img` / `video` rules |
| User/assistant preview CSS | `index.html` | `.chat-inline-*` and `pre.chat-user-text` |

## Manual test matrix (device)

1. **Toolbar access:** Open a long thread; scroll the message list. Confirm model/provider/pills remain **above** the log without scrolling the whole app away.
2. **Composer access:** With many messages, confirm input, attach, send, and voice remain visible; open keyboard and confirm the input is not permanently hidden under chrome (best-effort; some OEMs still resize oddly).
3. **Scroll smoothness:** Scroll only the transcript; confirm topbar/sidebar do not jitter from nested scroll feedback.
4. **User image:** Attach a small image, send; bubble shows **inline image** + text; reload app — image still visible if snapshot stored.
5. **User video/audio (≤4 MiB):** Attach short clip or audio; send; inline **controls** appear; larger files show file card without inline video.
6. **Assistant downloads:** Existing download cards still show previews + links.
7. **Regression:** Sidebar, thread drawer, login, voice TTS button on assistant rows, workspace collapse when messages exist — still present.

## Build note for APK

After pulling these changes, run your usual Android asset copy / Capacitor sync so `android/app/src/main/assets/public` (or equivalent) contains the updated `index.html` and `app.js`.

## APK runtime proof (emulator, debug build)

Commands used (Windows / PowerShell):

- `npm run cap:sync`
- `gradlew.bat assembleDebug`
- `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
- `adb forward tcp:9222 localabstract:webview_devtools_remote_<PID>`
- `node scripts/apk-chat-cdp-verify.mjs` (Chrome DevTools Protocol against the WebView)

Additional CSS shipped for this proof: `.app:has(#page-chat.page.active)` and chained `.main > .content` height limits so `#chatLog` gets a real `clientHeight` smaller than `scrollHeight` inside the WebView (fixes unbounded flex growth).

Observed on **Android Emulator API 34** (viewport ~411×914 CSS px), after synthetic long thread + scroll:

- `logScrollHeight` ≫ `logClientHeight`, `logScrollTop` large → transcript scrolls inside `#chatLog` only.
- `toolbarTop` unchanged after scroll → main toolbar stays in the header stack (not carried away by page scroll).
- `barBottom` ≤ viewport height → composer remains in view after scrolling to the end.
- `chatbar` `position` = `relative` (not `fixed`).
- Inline `<img>` wide layout; `<audio controls>` and `<video controls playsinline>` get non-trivial layout height in the user bubble shell.

Not covered by automation: opening the **software keyboard** and watching for OEM-specific resize glitches; `AndroidManifest` uses `android:windowSoftInputMode="adjustResize"` as the baseline.
