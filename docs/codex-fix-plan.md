# Fix Plan

## Goal
Stabilize the platform around one coherent runtime model so that:
- login behaves the same on web and Android
- Google/browser auth returns to the right place
- mobile chat controls behave predictably
- Android no longer drifts from web unnoticed
- PDF -> Word and voice features degrade clearly instead of failing ambiguously

## Phase 1: Fix auth root consistency first
Why first:
- It is the main cause behind login failure, auth-bridge mismatch, and wrong post-login landing.

Required changes:
- Update `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js`
  - Make `getAuthServiceRoot()` derive from the same resolution path as chat/API.
  - Remove the hard preference for `DEFAULT_SETTINGS.gatewayUrl`.
  - Ensure auth, storage, voice, and chat all resolve against the same authoritative API root.
- Update `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/auth-bridge.html`
  - Use the passed `gateway` parameter or remove it from the contract.
  - Align worker/auth root expectations with the frontend auth root logic.

Success criteria:
- `/auth/config`, `/auth/login`, `/auth/google`, `/voice/*`, and `/v1/*` all resolve to the same intended API root.
- No more UI state drift caused by talking to a different service for auth than for chat.

## Phase 2: Fix login flow and post-login routing
Required changes:
- Update `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js`
  - Stop silent downgrade to `getLocalAuthConfig()` as the primary user-facing state.
  - Preserve last known-good remote config and surface fetch failures explicitly.
  - Make admin/password mode deterministic even if `/auth/config` refresh fails transiently.
  - Persist intended landing destination before browser auth.
  - Restore the intended page/chat/project after `consumeAuthPayload()`.
- Update `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/auth-bridge.html`
  - Preserve explicit `return_to` for native fallback instead of forcing public home.
  - Keep the intermediate “return to app” screen but ensure its fallback respects the real target.

Success criteria:
- Admin login does not misreport password configuration.
- Google login returns to the intended destination on both web and Android.
- Native fallback does not dump users at an unrelated landing page.

## Phase 3: Unify APK and web release model
Why:
- Current packaging guarantees drift between bundled `www` and live web.

Required changes:
- Update `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/capacitor.config.json`
  - Decide whether Android should stay bundled-first or use a remote host for UI.
- Update `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js`
  - Expose a runtime build marker in the UI for diagnostics.
- Update:
  - `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html`
  - `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/sw.js`
  - `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/manifest.webmanifest`
  - `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/android/app/build.gradle`
  so version identifiers match across all layers.

Professional recommendation:
- Use one release manifest/version source and generate all visible version strings from it.
- If Android must remain local-first, enforce a mandatory sync/build gate before any release label bump.

## Phase 4: Rebuild mobile chat composer correctly
Why:
- Sticky input and scrolling bugs come from a structural mismatch.

Required changes:
- Update `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html`
  - Choose one composer element: textarea or input. The current logic strongly suggests textarea should win.
  - Rework mobile layout so the sticky composer and scroll container are coordinated.
- Update `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js`
  - Make `resizeComposerInput()` match the actual DOM element.
  - Revisit keyboard editing state handling and sticky shell metrics.

Success criteria:
- Composer stays visible and usable on mobile during keyboard open/close.
- Multiline prompts, voice dictation insertion, and send flow remain stable.

## Phase 5: Rebind floating scroll controls to the real mobile scroller
Required changes:
- Update `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js`
  - Determine the real active scroll container at runtime instead of assuming `chatLog`.
  - Keep FAB visibility independent from transient keyboard layout where appropriate.
- Update `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html`
  - Simplify scroll ownership between page shell and chat log.

Success criteria:
- Scroll-to-bottom/top FAB always targets the same container the user is actually scrolling.

## Phase 6: Clean up the real auth UI source
Required changes:
- Update `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js`
  - Refactor `ensureAccountChrome()` and auth gate generation into a clearer, isolated renderer.
- Update `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/auth-bridge.html`
  - Fix encoding corruption and align visual copy with the current auth flow.
- Update `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/sw.js`
  - Ensure cache invalidation matches auth UI changes.

Success criteria:
- Auth UI changes come from a clear source of truth and show up reliably.

## Phase 7: Secondary stabilization

### Voice chat
- Normalize the decision tree between native STT, browser STT, and cloud STT/TTS.
- Add explicit capability reporting per platform and account state.
- Avoid silent fallback that changes behavior without telling the user.

Files:
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/keys-worker.js`

### PDF -> Word
- Keep current DOCX fidelity path.
- Add OCR production readiness only after secrets are available.

Files:
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/convert-worker.js`
- `/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js`

External requirement:
- To make OCR complete for scanned PDFs, provide one of:
  - `OPENROUTER_API_KEY`
  - `OCR_UPSTREAM_URL`

## Suggested order of execution
1. auth root consistency
2. login flow and post-login routing
3. APK/web release model
4. mobile composer structure
5. floating scroll controls
6. auth UI source cleanup
7. voice and OCR stabilization

## Recommended external help if you want the most professional path
- Cloud observability:
  - enable logs/trace visibility for `api.saddamalkadi.com`
- OAuth stability:
  - keep Google Web Client origins limited to the actual live domains
- OCR completion:
  - provide `OPENROUTER_API_KEY` or `OCR_UPSTREAM_URL`
- Release discipline:
  - add a single version manifest or CI release step so Android/web cannot drift silently
