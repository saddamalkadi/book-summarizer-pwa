# Sticky toolbar and composer fix

## Problem

On mobile and in the Android WebView, the chat **toolbar** (model, provider, modes, tools) sat in a page that scrolled away with the transcript. The **composer** was `position: fixed` at ≤640px, which is fragile with the Android keyboard and visual viewport.

## Changes

### Toolbar

- For `max-width: 980px` and `#page-chat.page.active`, the page no longer scrolls as a whole; the toolbar remains in the **non-scrolling header stack** above `#chatLog`.
- `body.chatToolbarPinned #page-chat.page.active > .toolbar.mainToolbar` is set to `position: relative; top: auto; max-height: none` so a tall toolbar does not fight the global topbar or clip oddly on mobile.

### Composer

- At ≤640px, `#page-chat.page.active > .chatbar` uses **`position: relative`** (in normal flow) with bottom **safe-area** padding instead of `fixed` + manual `chatlog` bottom spacer.
- In the same 980px media block, `.chatbar`, `.composer-meta`, and `.chips` are **`flex-shrink: 0`**, full width, so the footer stays visible while the log scrolls.

### Desktop

- Above 980px, existing sticky / strategic styles are unchanged except where shared rules intentionally apply to both (safe-area, reading width).

## Acceptance mapping

- User can change model / modes without scrolling the transcript to the top: the controls sit above the scrolling log on mobile.
- Composer remains at the bottom of the chat column without overlapping the last messages (no fixed bar over content in the common case).
