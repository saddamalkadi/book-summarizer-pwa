# Functional Stabilization Audit — v8.47

**Date:** 2026-03-20  
**Scope:** Full button/handler audit across all pages + auth flow verification  
**Result:** 3 bugs found and fixed. All other functionality confirmed working.

---

## Audit Methodology

1. Traced `init()` call order to confirm dynamic element creation order
2. Cross-referenced every `addEventListener` call in `bind()` against static HTML and dynamically-created elements
3. Traced the complete auth flow end-to-end
4. Verified `refreshNavMeta()` and `refreshModeButtons()` side effects on home screen elements
5. Ran E2E automated tests to confirm all three fixes

---

## Bugs Found and Fixed

### Bug 1 — Auth Gate Never Opened for Voluntary Sign-In (Critical)

**Symptom:** Clicking "تسجيل الدخول" anywhere in the app never showed the login form.

**Root Cause:** `openAuthGate()` had a hard guard at line 4365:
```javascript
if (getAccountRuntimeState().authRequired !== true) return;
```
The default server configuration uses `authRequired: false` (guest mode allowed). Every voluntary call to `openAuthGate()` hit this guard and returned silently — the modal never appeared.

**Fix:** Added a `{ force = false }` parameter. Voluntary user-initiated sign-in paths pass `force: true`, bypassing the guard:
```javascript
function openAuthGate(message = '', { force = false } = {}){
  if (!force && getAccountRuntimeState().authRequired !== true) return;
  ...
}
```

**Call sites updated to `force: true`:**
- `openAccountCenter()` — when user is not signed in
- `accountSignInBtn` click listener  
- `requestUpgradeByEmail()` — user tried to request upgrade without being signed in
- `activateUpgradeCodeFromUi()` — user tried to activate code without being signed in
- `logoutCurrentAccount()` — after logout, prompt to re-sign in

---

### Bug 2 — "تسجيل الدخول" Strip Navigated to Settings Instead of Login Modal

**Symptom:** Clicking the sidebar account strip only switched to the Settings page, with no login form visible.

**Root Cause:** `sideAccountStrip` click handler called `setActiveNav('settings')` directly instead of routing through `openAccountCenter()`.

**Fix:** Changed handler to call `openAccountCenter()`, which correctly calls `openAuthGate({ force: true })` for non-signed-in users, or navigates to the settings account card for signed-in users:
```javascript
// Before
$('sideAccountStrip').addEventListener('click', () => { setActiveNav('settings'); ... });

// After
$('sideAccountStrip').addEventListener('click', () => { $('closeSideBtn')?.click(); openAccountCenter(); });
```

---

### Bug 3 — `refreshNavMeta()` Destroyed Use-Case Card Content

**Symptom:** The "بحث عميق" (🔬) and "بناء منتج" (🚀) use-case cards, and the "مهمة جاهزة" (⚡) quick-action button, lost their icons and descriptions after app initialization. They showed as plain text only.

**Root Cause:** In `refreshNavMeta()`, a label-update loop called `btn.textContent = labels[key]` on all `[data-quick-prompt]` elements. This overwrote child elements (`.uc-icon`, `.uc-title`, `.uc-desc`) with a plain string.

**Fix:** Added a `btn.children.length === 0` guard — only apply the text rewrite to buttons that have no child elements:
```javascript
// Before
if (labels[key]) btn.textContent = labels[key];

// After
if (labels[key] && btn.children.length === 0) btn.textContent = labels[key];
```

---

### Auth Gate Close Button — Voluntary Mode

**Companion fix:** When `openAuthGate()` is called with `force: true` (auth not required), the close button was hidden because the logic only checked `hasValidAuthSession()`. Updated to also show the close button when `authRequired=false`:
```javascript
// Before
$('authCloseBtn').style.display = hasValidAuthSession() ? '' : 'none';

// After
$('authCloseBtn').style.display = (hasValidAuthSession() || !getAccountRuntimeState().authRequired) ? '' : 'none';
```

---

## Full Button Coverage — No Issues Found

### Static HTML Buttons with Hard Bindings (all confirmed present)
| Button | ID | Handler |
|--------|-----|---------|
| Send | sendBtn | sendMessage |
| Stop | stopBtn | stopGeneration |
| Regenerate | regenBtn | regenLast |
| New Thread | newThreadBtn | newThread + setActiveNav |
| Mode Deep | modeDeepBtn | setDeep toggle |
| Mode Agent | modeAgentBtn | setAgent toggle |
| Mode Off | modeOffBtn | disableModes |
| Web Toggle | webToggleBtn | setWebToggle toggle |
| Pick Model | pickModelBtn | openModelHub |
| Model Modal Close | modelModalClose | openModelModal(false) |
| Settings Save | saveSettingsBtn | saveSettingsFromUI |
| Settings Reset | resetSettingsBtn | reset to DEFAULT_SETTINGS |
| Prompt Select | promptSelect | applyPromptTemplate |
| Stream Toggle | streamToggle | setSettings |
| Add Files | addFilesBtn | triggers filePicker.click() |
| Clear Files | clearFilesBtn | saveFiles([]) + render |
| New Project | newProjectBtn | newProject |
| Rename Project | renameProjectBtn | renameProject |
| Delete Project | deleteProjectBtn | deleteProject |
| Refresh Downloads | refreshDlBtn | renderDownloads |
| Clear Downloads | clearDlBtn | saveDownloads([]) |
| All Transcription Buttons | transcribePickBtn, ExtractBtn, etc. | full coverage |
| All Canvas Buttons | canvasNewBtn, SaveBtn, etc. | full coverage |
| All KB Buttons | kbBuildBtn, kbSearchBtn, etc. | full coverage |

### Dynamically Created Elements — All Created Before `bind()` Runs

`init()` call order guarantees:
1. `ensureStrategicChrome()` → creates historyDrawerBtn, focusModeBtn, studyModeBtn, voiceModeBtn, voiceInputBtn, pinSideBtn, threadDrawer, threadDrawerCloseBtn, accountTriggerBtn, authGate
2. `renderChat()`, `renderFiles()`, etc.
3. **`bind()`** ← all dynamic elements exist here
4. `initializeAuthExperience()` ← safe; elements already bound

### Other Confirmations
- **chatMoreBtn toggle**: Handled by inline script in index.html. CSS class `toolbar-secondary-open` on `.mainToolbar` correctly shows/hides `.tg-secondary` groups. On mobile, secondary groups are always shown (media query override). ✅
- **Nav accordion** (الأدوات, المزيد): Handled by delegated click listener on `#nav`. Calls `toggleNavGroup(group.id)` for accordion buttons. ✅
- **Quick-prompt use-case cards**: All `<button>` elements (not divs), keyboard-accessible. Handled by delegated `document.click` listener. ✅
- **Worker auto-deploy**: Correct; uses `result.items[0]?.id` from `/versions?limit=1` API. ✅
- **No JS console errors**: Clean runtime. ✅

---

## E2E Test Results (Automated)

Test: Auth gate opens on login strip click | **PASS**  
Test: Use-case cards preserve icon + title + description | **PASS**  
Test: Auth gate close button visible in optional-auth mode | **PASS**  
Test: Files page navigation and file attach button | **PASS**  
Test: Chat input accepts and displays typed text | **PASS**  

**Overall: 5/5 PASS**

---

## Status

**Functional Stabilization: COMPLETE**  
All buttons audited, all handlers confirmed, 3 bugs fixed, 5 E2E tests passing.
