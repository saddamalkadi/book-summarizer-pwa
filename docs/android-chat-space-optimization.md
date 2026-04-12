# Android / mobile chat — screen space optimization

## Goal

Increase the comfortable reading area for the chat transcript on narrow viewports (especially Android portrait) without removing features, changing the visual identity, or breaking the flex shell that keeps `#chatLog` as the scroll container.

## What changed

### CSS variables (`index.html`)

- **`@media (max-width: 980px)`**: `--sticky-toolbar-top` and `--floating-nav-bottom` were reduced from the global defaults (`96px` / `104px`) to **`76px` / `90px`** so scroll padding and reserved space above/below the transcript match tighter chrome.
- **`@media (max-width: 640px)`**: further tightened to **`70px` / `80px`** for small phones.

### Shell and top bar

- When the chat page is active, **`.app`** uses slightly smaller padding and gap (`max-width: 980px`) so more height stays for content.
- **`.topbar`** padding is slightly reduced in that same context to save vertical space while keeping actions reachable.

### Chat toolbar (`#page-chat > .toolbar.mainToolbar`)

- Reduced **outer margins**, **inner padding**, **grid gap**, and **border-radius** on viewports `≤980px`.
- **Tool groups** use smaller padding and radius; **titles** use a slightly smaller label.

### Transcript (`#page-chat .chatlog` / bubbles)

- Replaced large `clamp()` padding with **fixed smaller vertical padding** on mobile so the log uses more of the viewport.
- **Bubbles**: slightly less padding, margin, and radius; **body** line-height and font-size tuned for density without hurting readability.
- **`--user-width`** at `980px` moved from `94%` to **`96%`** so user bubbles use a bit more horizontal width.

### Composer (`#page-chat > .chatbar`)

- Tighter **gap** and **padding**, with **safe-area** preserved on the bottom inset.
- Button **min size stays 44×44px** on `≤980px` for touch compliance.
- **`composer-meta`** and **`chips`** use less padding so the stack is shorter.

### `#chatInput` / desktop chatbar ordering

- Desktop-only chatbar padding and default input padding live in **`@media (min-width: 981px)`** so they no longer override the mobile compact rules.
- **`@media (max-width: 980px)`** and **`640px`** set `#page-chat #chatInput` padding and **16px** font size (avoids iOS zoom quirks on focus).

### JavaScript (`app.js`)

- **`resizeComposerInput`**: on viewports `≤980px`, the minimum auto-resize height for the composer textarea is **50px** instead of **58px**, so the default composer row is slightly shorter when empty.

## Acceptance mapping

| Requirement | How it is addressed |
|-------------|---------------------|
| Larger reading area | Less padding on log/bubbles, smaller reserved top/bottom vars, tighter meta/chips |
| Pinned controls stay usable | Sticky/flex behavior unchanged; touch targets ≥44px on chatbar buttons |
| No overlap / instability | No change to `.app:has(#page-chat.page.active)` height shell |
| Premium feel | Same gradients, borders, and hierarchy; only density and spacing |

## Files touched

- `index.html` — mobile `@media` rules, chat page overrides, chatbar/desktop split.
- `app.js` — `resizeComposerInput` minimum height on narrow screens.
