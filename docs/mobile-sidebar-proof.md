# Mobile Sidebar Proof

## Scope

This proof covers only:

- mobile web in portrait mode

It does **not** claim Android APK proof in this pass.

## Proof method

The fix is verified against the live production site after deployment.

Required conditions for acceptance:

1. open the live app in a mobile portrait viewport
2. click the real menu button
3. verify the sidebar becomes visible above the app shell
4. verify the backdrop appears
5. verify there is no hidden-open or clipped state
6. verify the drawer can be closed again

## Runtime artifacts

The runtime proof for the live mobile web check is stored in:

- [`tmp-mobile-sidebar-proof-result.json`](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/tmp-mobile-sidebar-proof-result.json)

## Expected pass conditions

The proof is valid only when all of the following are true at runtime:

- `buttonExists = true`
- `sidebarHasShow = true`
- `backdropHasShow = true`
- `bodyHasMobileSidebarOpen = true`
- `sidebarVisible = visible`
- `sidebarPointerEvents = auto`
- the sidebar rectangle is on-screen and usable

## Current status

This document must be updated after the live production verification step.

Until then, it should not be treated as a completed acceptance record.
