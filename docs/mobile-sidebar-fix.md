# Mobile Sidebar Fix

## Scope

This pass fixes the sidebar/menu only for:

- mobile web in portrait mode

It does not include:

- Android APK parity
- voice chat
- login return flow
- desktop redesign

## Final root cause

The final mobile portrait sidebar failure had **two layers of cause**:

1. An overlapping mobile drawer contract caused by:
   - base `@media (max-width: 980px)` mobile rules
   - `body.sidebarFloating .side` / `.backdrop2` rules
   - a later "Mobile sidebar stabilization" block
2. A production-only stacking failure on the login screen:
   - `.auth-gate` is rendered as a fixed overlay with `z-index: 130`
   - the mobile drawer was rendered with:
     - `.side { z-index: 120 }`
     - `.backdrop2 { z-index: 108 }`

That meant the drawer could be **opened correctly in DOM state**, while still being painted **under the login overlay**. This is why the button looked broken in Android portrait even when JavaScript had already toggled:

- `.side.show`
- `.backdrop2.show`
- `body.mobileSidebarOpen`

The drawer was not "closed"; it was simply below the auth layer and therefore visually inaccessible.

## What changed

### 1. Desktop floating sidebar rules were isolated to desktop only

In [`index.html`](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html), `body.sidebarFloating` rules were moved behind:

- `@media (min-width: 981px)`

That prevents mobile portrait from inheriting desktop floating-sidebar behavior.

### 2. Old mobile drawer rules were removed from the earlier mobile blocks

The following mobile rules were removed from the early responsive section:

- `.side { ... }`
- `.side.show { ... }`
- `.backdrop2 { ... }`
- `.backdrop2.show { ... }`
- the extra mobile `.side` geometry override in the `max-width: 640px` block

This eliminated the duplicated drawer system.

### 3. A single mobile drawer contract now controls the sidebar

The mobile sidebar now depends only on:

- `body.mobileSidebarOpen`
- `.side.show`
- `.backdrop2.show`

inside one late mobile-only CSS block.

That block now explicitly controls:

- `position`
- `transform`
- `visibility`
- `opacity`
- `pointer-events`
- `z-index`
- `overflow`
- safe-area padding

### 4. The mobile backdrop and drawer now live above the auth overlay

The final blocking issue was fixed by raising the mobile layering above `.auth-gate`:

- `.backdrop2` was moved to `z-index: 138`
- `.side` was moved to `z-index: 140`

This preserves desktop behavior while making the drawer visible and interactive even when the login gate is still shown.

### 5. Sidebar state is now synchronized explicitly in JavaScript

In [`app.js`](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js):

- `syncSidebarDrawerState()` now enforces one sidebar mode contract
- `applyShellLayout()` now removes `sidebarFloating` on mobile instead of letting it linger
- `openSide()` / `closeSide()` now route through a single state path

## Files changed

- [`index.html`](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html)
- [`app.js`](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js)
- [`sw.js`](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/sw.js)
- [`manifest.webmanifest`](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/manifest.webmanifest)
- [`package.json`](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/package.json)

## Desktop safety

Desktop behavior was intentionally preserved:

- `sidebarFloating` still works on desktop only
- desktop pinned/floating behavior remains controlled by the existing sidebar pin logic
- no desktop layout redesign was introduced

## Production version for this fix

The live production shell used for final verification was:

- `v8.58`
