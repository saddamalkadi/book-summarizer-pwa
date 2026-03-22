# Runtime Audit

## Scope
- Date: 2026-03-22
- Mode: diagnosis only
- Rebuilds/tests that mutate runtime artifacts: not performed
- Requested focus:
  1. login failure
  2. auth-bridge / gateway mismatch
  3. wrong post-login landing
  4. sticky chat input not working on mobile
  5. scroll-to-bottom FAB not working on mobile
  6. APK != web
  7. actual login route UI unchanged

## Handoff Note
- `CODEX_HANDOFF.md` was not found in the repository or the surrounding workspace during this audit.

## Repo Paths Audited
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/auth-bridge.html`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/capacitor.config.json`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/sw.js`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/manifest.webmanifest`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/keys-worker.js`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/convert-worker.js`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/android/app/src/main/AndroidManifest.xml`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/android/app/src/main/java/com/saddamalkadi/aiworkspace/MainActivity.java`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/downloads/index.html`

## Top Findings

### 1. Login failure
Root cause:
- The frontend auth layer silently falls back to local auth defaults whenever `/auth/config` fetch fails, times out, or hits a mismatched service root.
- Those local defaults disable password admin login and can downgrade Google/admin state in the UI even when the backend is actually ready.
- Admin login submission also branches on the fetched config and can redirect users into Google/browser flow instead of the intended password path.

Evidence:
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:921`
  `getAuthServiceRoot()` always prefers `getPlatformServiceRoot()`, which is derived from `DEFAULT_SETTINGS.gatewayUrl`, not the actual runtime gateway setting.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:1001`
  `loadRemoteAuthConfig()` fetches `${root}/auth/config` and on any failure falls back to `getLocalAuthConfig()`.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:1028`
  Remote auth flags are set from the payload, but the fallback path does not preserve the last known-good remote config.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:4291`
  `submitUnifiedAuthEntry()` determines admin mode entirely from the fetched config.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/keys-worker.js:227`
  The worker correctly exposes admin/password/google availability through `getPublicAuthConfig()`.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/keys-worker.js:361`
  The worker returns a clear `AUTH_ADMIN_PASSWORD_NOT_CONFIGURED` only when `APP_ADMIN_PASSWORD` is really absent, so user-facing false negatives are frontend-driven when config fetch misses.

Conclusion:
- The primary failure is frontend config resolution and fallback behavior, not the basic existence of `/auth/login`.

### 2. auth-bridge / gateway mismatch
Root cause:
- Chat/runtime and auth/runtime do not resolve their service roots the same way.
- The auth bridge receives a `gateway` parameter but does not use it, so the login/browser path can diverge from the chat/API path.

Evidence:
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:717`
  `getPlatformServiceRoot()` is hardwired to `DEFAULT_SETTINGS.gatewayUrl`.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:836`
  `resolveGatewayApiRoot()` contains separate gateway normalization logic used by chat/API flows.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:895`
  `effectiveBaseUrl()` uses `resolveGatewayApiRoot(settings)` for chat completions.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:921`
  `getAuthServiceRoot()` does not use `resolveGatewayApiRoot(settings)` and prefers the platform default root.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:4189`
  `buildBrowserGoogleAuthUrl()` passes `gateway` in the query string.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/auth-bridge.html:218-222`
  The bridge reads `worker`, `native_return`, and `return_to`, but ignores `gateway`.

Conclusion:
- Auth can talk to one root while chat and model calls talk to another. This is the central structural mismatch.

### 3. Wrong post-login landing
Root cause:
- The auth bridge intentionally collapses native fallback to the public web home instead of the original target.
- After login, the app consumes the auth payload but does not explicitly restore the intended destination or active page.

Evidence:
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/auth-bridge.html:220-222`
  `webReturn = explicitReturn && !nativeReturn ? explicitReturn : PUBLIC_WEB_HOME`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/auth-bridge.html:258-271`
  Android fallback URL is built from `PUBLIC_WEB_HOME`, not the actual intended post-login route.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:4184-4200`
  Native flow deliberately sets `return_to` to the app scheme while the bridge fallback still lands on the public home.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:4053`
  `consumeAuthPayload()` finalizes session state but does not restore a requested route/page.

Conclusion:
- Wrong landing is not incidental; it is encoded into the current bridge fallback behavior.

### 4. Sticky chat input not working on mobile
Root cause:
- The chat composer is implemented as a single-line `<input>`, but large parts of the CSS and JavaScript still assume a `<textarea>`.
- The sticky composer sits in a layout where the visible scroll container is `#chatLog`, while `#page-chat` is forced to `overflow:hidden` on mobile.

Evidence:
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html:1906-1912`
  The composer markup uses `<input id="chatInput">`.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:3337-3340`
  `resizeComposerInput()` returns immediately unless the element is a `TEXTAREA`.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html:199-201`
  Mobile CSS makes `.chatbar` sticky at the bottom.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html:207`
  `#page-chat{overflow:hidden;}` on mobile.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html:463` and `:616`
  Composer styling still targets `.chatbar textarea`.

Conclusion:
- The sticky input issue is structural: the current DOM element, JS behavior, and mobile layout rules are out of sync.

### 5. Scroll-to-bottom FAB not working on mobile
Root cause:
- The FAB logic assumes `#chatLog` is always the active scroller, but the mobile layout hides other overflow and also suppresses floating controls during keyboard editing.
- In practice, the visible motion on mobile can be split between the page shell and `#chatLog`, while the FAB only targets the latter.

Evidence:
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:2390-2412`
  `syncChatScrollDock()` only reads `chatLog.scrollTop`, `scrollHeight`, and `clientHeight`.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:5993-5998`
  `scrollChat(direction)` only calls `chatLog.scrollTo(...)`.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html:1032-1038`
  `body.keyboardEditing` disables floating nav visibility.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html:207`
  `#page-chat{overflow:hidden;}` changes the normal mobile scrolling model.

Conclusion:
- The FAB is bound to the wrong abstraction level. It operates on one scroller while mobile UX is driven by a more complex layout stack.

### 6. APK != web
Root cause:
- Android ships the bundled `www` output from Capacitor, while the live website loads the latest Pages/GitHub-hosted assets.
- There is no single shared runtime source of truth once a native build has been created.
- Version markers are inconsistent across files, which hides drift rather than preventing it.

Evidence:
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/capacitor.config.json:4`
  `"webDir": "www"`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html:2410`
  Web loads `app.js?v=844`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/sw.js:2`
  `APP_VERSION = "844"`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html:6`
  Title says `v8.43`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/manifest.webmanifest:2`
  Manifest says `AI Workspace Studio v8.43`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:1`
  File banner still says `v8.34`

Conclusion:
- The APK/web mismatch is expected under the current packaging model. The inconsistent version tags make the mismatch harder to diagnose.

### 7. Actual login route UI unchanged
Root cause:
- The login screen is not a dedicated route/page. It is built and injected dynamically from `app.js`.
- As a result, changing HTML shells or ancillary pages will not change the real auth UI unless the loaded `app.js` changes too.
- Additionally, `auth-bridge.html` contains visible mojibake/encoding corruption, which makes some auth UI appear unchanged or broken even when logic changed elsewhere.

Evidence:
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:3654-3736`
  `ensureAccountChrome()` constructs the auth gate HTML at runtime and injects it into `document.body`.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html:2410-2422`
  The visible behavior depends on the currently loaded `app.js` and service worker cache.
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/auth-bridge.html:182-199`
  Arabic strings are visibly corrupted.

Conclusion:
- “Login route UI unchanged” is mainly a runtime injection/caching issue, not a missing edit in a dedicated route file.

## Related Observations

### Voice chat is still multi-path and fragile
- Native, browser speech, and cloud speech are mixed, and desktop browsers still prefer local Web Speech when available.
- This increases surface area for inconsistent behavior between laptop, mobile web, and Android.
- Relevant paths:
  - `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:2765`
  - `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:3034`
  - `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js:3099`

### PDF -> Word fidelity is only partially production-ready
- DOCX conversion can be high fidelity when `DOCX_UPSTREAM_URL` or `CLOUDCONVERT_API_KEY` exists.
- OCR for scanned documents still requires `OCR_UPSTREAM_URL` or `OPENROUTER_API_KEY`.
- Relevant paths:
  - `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/convert-worker.js:40-69`
  - `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/convert-worker.js:89-130`
  - `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/convert-worker.js:361-385`

## Priority Assessment
1. auth-bridge / gateway mismatch
2. login failure
3. wrong post-login landing
4. APK != web
5. sticky chat input on mobile
6. scroll-to-bottom FAB on mobile
7. actual login route UI unchanged

Rationale:
- Issues 1 to 3 block core access and session continuity.
- Issue 6 is the root of repeated “web works / APK differs” reports.
- Issues 4 and 5 are important mobile UX regressions but do not matter until login/session flow is coherent.
- Issue 7 becomes much easier once the runtime source of truth and caching model are simplified.
