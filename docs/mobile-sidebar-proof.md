# Mobile Sidebar Proof

## Scope

This proof covers only:

- mobile web in portrait mode

It does **not** claim Android APK proof in this pass.

## Proof method

The fix was verified against the live production site after deployment using:

- live production URL: `https://app.saddamalkadi.com/`
- production version: `v8.58`
- Chrome headless driven through DevTools Protocol
- Android mobile emulation:
  - width: `412`
  - height: `915`
  - Android Chrome user-agent

The runtime check performed:

1. open the live app in a portrait Android-like viewport
2. read the real live version from DOM
3. click the real menu button (`#openSideBtn`)
4. verify the drawer state after opening
5. verify the backdrop state after opening
6. test hit detection inside the visible drawer area using `elementFromPoint(...)`
7. click the real backdrop to close the drawer again

## Runtime artifacts

The runtime proof for the live mobile web check is stored in:

- [`tmp-mobile-sidebar-proof-result.json`](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/tmp-mobile-sidebar-proof-result.json)
- [`tmp-mobile-cdp-proof.json`](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/tmp-mobile-cdp-proof.json)
- [`tmp-mobile-cdp-proof.png`](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/tmp-mobile-cdp-proof.png)

## Expected pass conditions

The proof is valid only when all of the following are true at runtime:

- `buttonExists = true`
- `sidebarHasShow = true`
- `backdropHasShow = true`
- `bodyHasMobileSidebarOpen = true`
- `sidebarVisible = visible`
- `sidebarPointerEvents = auto`
- the sidebar rectangle is on-screen and usable

## Live result

The final live runtime result on production `v8.58` was:

- before open:
  - `version = 8.58`
  - `sideVisible = hidden`
  - `sideOpacity = 0`
  - `sideTransform = matrix(1, 0, 0, 1, -368, 0)`
- after open:
  - `sideHasShow = true`
  - `backdropHasShow = true`
  - `bodyHasMobileSidebarOpen = true`
  - `sideVisible = visible`
  - `sideOpacity = 1`
  - `sideZ = 140`
  - `backVisible = visible`
  - `backOpacity = 1`
  - `backPointer = auto`
  - `rect.width = 350`
  - `rect.left = 0`
  - `hitA.id = closeSideBtn`
  - `hitB.className = navbtn-label`
- after close:
  - `sideHasShow = false`
  - `backdropHasShow = false`
  - `bodyHasMobileSidebarOpen = false`
  - `sideVisible = hidden`
  - `backVisible = hidden`

## Acceptance conclusion

For **mobile web portrait only**, the live production proof now confirms:

- the menu button opens the sidebar
- the sidebar is painted above the login overlay
- the backdrop appears and is clickable
- there is no hidden-open state
- the drawer can be closed again reliably

This proof does **not** claim Android APK success. That remains outside this pass.
