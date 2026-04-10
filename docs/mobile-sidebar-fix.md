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

The mobile sidebar bug was caused by **two overlapping sidebar rendering systems plus a late stabilization layer**:

1. Base mobile drawer rules inside `@media (max-width: 980px)`
2. `body.sidebarFloating .side` / `.backdrop2` rules that were originally meant for floating desktop sidebar mode
3. A later mobile stabilization block that tried to override both

Because JavaScript only toggled `.show` and `sidebarFloating`, the DOM could end up in a contradictory state:

- the sidebar was open logically
- but mobile portrait still inherited floating-sidebar positioning or clipping behavior
- or backdrop/visibility was controlled by a different CSS path than the drawer itself

This produced the real runtime symptom:

- the menu button could be clicked
- but the drawer became partially hidden, visually clipped, behind layers, or appeared to fail

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
- `pointer-events`
- `z-index`
- `overflow`
- safe-area padding

### 4. Sidebar state is now synchronized explicitly in JavaScript

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
