# Mobile Root-Cause Audit

## Scope
This audit covers mobile runtime behavior only:
- Android phone browser in portrait mode
- Android APK

No fixes are implemented in this document. This is a diagnosis pass only.

## Evidence sources
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\app.js`
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\index.html`
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\auth-bridge.html`
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\capacitor.config.json`
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\app\src\main\AndroidManifest.xml`
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\app\src\main\java\com\saddamalkadi\aiworkspace\MainActivity.java`
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\sw.js`

## Cross-cutting root causes

### 1. Web root, `www`, and Android bundled assets are not aligned
The mobile APK is not running the same web bundle as the live web root.

Observed version drift:
- root web `index.html`: `v8.55`
- `www/index.html`: `v8.52`
- `android/app/src/main/assets/public/index.html`: `v8.47`

Observed bundle drift:
- root web `app.js`: header still says `v8.34`, but runtime label is `v8.55`
- `www/app.js`: `v8.52`
- Android bundled `public/app.js`: `v8.52`

Impact:
- The APK can exhibit stale mobile/sidebar/auth/voice behavior even when the live web root has newer logic.
- Android-specific issues cannot be trusted to match web behavior until bundled assets are brought in sync.

### 2. Mobile shell layout uses multiple overlapping positioning systems
The mobile runtime combines:
- sticky topbar
- sticky subtopbar
- fixed chat bar on small screens
- floating scroll controls
- off-canvas sidebar drawer
- thread drawer overlay
- nested scroll containers

These are coordinated through JS-written CSS variables and mobile viewport listeners. The result is fragile on mobile, especially in portrait mode and when the keyboard opens.

### 3. Auth/browser return is orchestrated by too many mechanisms
The Android auth flow currently depends on a mix of:
- URL search/hash consumption
- localStorage bridge
- `window.postMessage`
- Capacitor Browser `browserFinished`
- Capacitor App `appUrlOpen`
- `resume`
- `appStateChange`
- custom scheme `aiworkspace://auth`
- Android `intent://` fallback

This is powerful, but brittle. It makes post-login return sensitive to timing and stale state.

### 4. Voice runtime is split across too many fallback branches
Voice logic currently mixes:
- native speech recognition plugin path
- cloud STT path
- browser Web Speech recognition path
- browser speech synthesis path
- native TTS proxy path

On Android APK, this produces ambiguous runtime behavior when the native path is unavailable or partially available.

## Per-issue diagnosis

### Issue A — Mobile browser portrait: sidebar/menu does not appear correctly
#### Symptoms
- Menu button does not reliably expose the sidebar.
- Sidebar may exist in DOM but be clipped, hidden, or rendered behind other layers.

#### Root cause
There are multiple competing sidebar/drawer models in CSS:
- base mobile drawer rules in `index.html` under `@media (max-width:980px)`
- additional mobile tightening under `@media (max-width:640px)`
- later `body.sidebarFloating .side` rules intended for floating desktop sidebar
- later refinement blocks that re-style the sidebar again

The drawer open/close logic in `app.js` is simple:
- add/remove `.show` on `#side`
- add/remove `.show` on `#backdrop`

But the layout around it is not simple. On mobile portrait the drawer competes with:
- sticky `.topbar`
- sticky `.subtopbar`
- fixed `#page-chat > .chatbar`
- floating scroll dock
- page/content overflow rules

This creates a real risk that the sidebar is technically "open" while still being visually off-canvas, clipped, or layered behind sticky/fixed UI.

#### Evidence
- `index.html`: mobile drawer rules around the first mobile blocks
- `index.html`: `body.sidebarFloating .side` rules later in the file
- `app.js`: `openSide()` / `closeSide()` only toggle classes, with no reconciliation against current overlay/sticky state

#### Affects
- Mobile browser portrait
- Android APK

---

### Issue B — Android APK: sidebar/menu does not work correctly
#### Symptoms
- Sidebar/menu behavior in APK does not match web.
- Drawer may not open, may render incorrectly, or may feel inconsistent.

#### Root cause
Same UI-shell issue as Issue A, plus APK bundle drift.

The APK is not shipping the same mobile shell as the current web root:
- Android bundled `public/index.html` is on `v8.47`
- current live root is `v8.55`

So even if the live web sidebar improved, the APK still runs older sidebar/layout logic.

#### Affects
- Android APK only

---

### Issue C — Android APK: voice chat does not activate/work correctly
#### Symptoms
- Voice button does not activate recording reliably inside the APK.
- User can press the button without getting a reliable voice-capture flow.

#### Root cause
The Android voice path assumes a working native speech-recognition plugin via:
- `getNativeSpeechRecognitionPlugin()`
- `ensureNativeSpeechRecognitionPermission(plugin)`
- `plugin.start(...)`

If that native path is unavailable or incomplete, the runtime falls back into web/cloud branches. In Android WebView, those branches are less reliable than in a normal browser.

There is also no strong native-side glue in `MainActivity.java`; it only forwards new intents. So the whole voice flow depends on default Capacitor/plugin behavior with little native recovery logic.

The code also shows duplicate-like native dictation flows:
- `startNativeComposerDictation()`
- `startNativeComposerDictationSafe()`

This increases the risk of state divergence around:
- `VOICE_RUNTIME.nativeListening`
- `composerListening`
- auto-send/continuous voice loop

#### Additional APK-specific factor
Because Android bundled assets lag behind root web, the APK may be running older voice logic than expected.

#### Affects
- Android APK primarily
- some fallback behavior can affect mobile browser, but the core failure is APK-specific

---

### Issue D — Android APK: post-login does not return correctly into app flow
#### Symptoms
- Login opens browser/external flow but does not cleanly return into the app.
- User can land in an intermediate browser-like state or on the wrong page.

#### Root cause
The auth return flow is fragmented between:
- `auth-bridge.html`
- `consumeAuthRedirectFromLocation()`
- `consumeAuthBridgeStorage()`
- `consumeAuthBridgeLaunchUrl()`
- Capacitor `appUrlOpen`
- Capacitor `resume`
- Capacitor `appStateChange`
- Capacitor Browser `browserFinished`

This is a lot of overlapping recovery logic. It works only if the right return path wins the race.

The bridge also depends on:
- `return_to`
- `target_page`
- `native_return`
- `worker`

These are all passed through URLs, then interpreted again inside the app shell. The result is highly timing-sensitive on Android.

#### APK-specific multiplier
Because APK assets are stale, Android may still be running an older auth-return implementation than live web.

#### Affects
- Android APK primarily

---

### Issue E — Mobile: visible screen shaking / layout instability
#### Symptoms
- Screen visually jumps or shakes.
- Instability becomes more visible during keyboard open/close, login transitions, drawer changes, or page switches.

#### Root cause
There is a mobile-only reflow feedback loop combining:
- `visualViewport.resize`
- `window.resize`
- `orientationchange`
- `focusin`
- `focusout`
- recalculation of `--app-vh`
- toggling `body.keyboardEditing`
- `syncStickyShellMetrics()`
- `scheduleChatScrollDockSync()`
- `applyShellLayout()`

The page uses nested scroll containers and several sticky/fixed surfaces. When viewport height changes during mobile keyboard or focus transitions, layout variables are rewritten and multiple UI systems re-evaluate at once.

This makes repaint/reflow loops very plausible, especially when:
- the keyboard opens
- the active page is chat
- a drawer is open/closing
- scroll dock visibility is recalculated

#### Evidence
- `index.html` viewport manager writes `--app-vh` and toggles `keyboardEditing`
- `app.js` recalculates sticky metrics and scroll dock visibility based on DOM measurements
- `syncChatScrollDock()` depends on sidebar open state, drawer open state, keyboard state, and scroll container selection

#### Affects
- Mobile browser portrait
- Android APK

---

### Issue F — Mobile browser portrait: safe-area/keyboard handling is unstable
#### Symptoms
- Bottom input spacing and sticky bars behave inconsistently while typing.
- Mobile chat page can feel unstable around the keyboard.

#### Root cause
The CSS mixes:
- `env(safe-area-inset-bottom)`
- fixed bottom chat bar on small screens
- chat log bottom padding compensation
- `keyboardEditing` class behavior
- `#page-chat{ overflow:auto; }` on mobile

At the same time, JS uses:
- `getChatScrollContainer()`
- `scrollChatToBottom()`
- floating dock visibility

This split responsibility makes the input area and scroll behavior sensitive to mobile viewport changes.

#### Affects
- Mobile browser portrait
- Android APK

---

### Issue G — Mobile service worker / stale asset mismatch risk
#### Symptoms
- Mobile web can behave inconsistently after deployment.
- User may see older runtime despite newer root files.

#### Root cause
The service worker caches core shell assets by version:
- `index.html`
- `auth-bridge.html`
- `app.js?v=APP_VERSION`

This is fine in principle, but in a project already suffering from:
- root/web bundle drift
- `www` drift
- Android public bundle drift

it increases the chance that mobile tests are performed against stale shell state.

#### Affects
- Mobile browser primarily
- can indirectly confuse APK parity expectations

## Browser-only vs APK-only vs shared

### Browser-only or browser-dominant
- Mobile browser portrait sidebar rendering/clipping
- Service worker stale-shell mismatch

### APK-only or APK-dominant
- Android native voice activation path
- Android browser-to-app return flow
- APK running stale bundled web assets (`android/app/src/main/assets/public`)

### Shared across mobile browser and APK
- Sidebar/drawer CSS layering model
- Mobile viewport/keyboard instability
- Sticky/fixed/scroll container interaction
- Chat shell layout fragility

## Files that must change in later fix phases

### Must change
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\app.js`
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\index.html`
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\auth-bridge.html`

### Likely must change
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\capacitor.config.json`
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\app\src\main\AndroidManifest.xml`
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\app\src\main\java\com\saddamalkadi\aiworkspace\MainActivity.java`

### Must be resynced later for parity
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\www\app.js`
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\www\index.html`
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\app\src\main\assets\public\app.js`
- `C:\Users\Elite\OneDrive\Documenti\GitHub\book-summarizer-pwa\android\app\src\main\assets\public\index.html`

## Recommended order for later implementation
1. Fix mobile shell/sidebar layering in web shell first
2. Fix mobile viewport/keyboard stability loop
3. Fix Android auth return path
4. Fix Android voice activation path
5. Resync `www` and Android bundled assets with the web root

## Phase 1 outcome
The main mobile problems are not independent. They are driven by four shared root causes:
- bundle/version drift between root web and APK
- competing mobile drawer/sidebar systems
- fragile auth/browser return orchestration
- viewport/keyboard/sticky reflow loops

No implementation has been applied yet in this phase.
