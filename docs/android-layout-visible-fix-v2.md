# Android layout — visible fix v2 (real device)

## Why v1 was barely visible on the APK

1. **Generic breakpoints only** — Rules lived under `@media (max-width: 980px)` / `640px`, which also apply to narrow desktop browsers and were partly **overridden later in the same CSS file** (e.g. global `#page-chat > .chatbar` before we split desktop/mobile).
2. **No Android-specific hook** — Capacitor WebView width is often still “desktop-sized” in CSS terms, so **not all mobile-only rules applied**, and competing selectors cancelled subtle padding changes.
3. **Large chrome unrelated to media queries** — Workspace deck + strategic strip + full top branding still consumed height whenever the chat page was open but empty or few messages.

## v2 approach (aggressive but scoped)

### 1. `body.native-android`

Set in `app.js` `init()` when `isNativeAndroidPlatform()` is true. All strong layout overrides are scoped to **native Android only**, so PWA/desktop are unchanged.

### 2. `body.android-chat-focus`

Toggled in `openWorkspacePage()` when the active page is `chat`. This stacks **extra compaction only while the user is actually in chat**, preserving home/settings experience.

### 3. CSS (see `index.html`)

- **Shell**: `.app` padding and gap reduced with `!important` so it wins over earlier `clamp()` rules.
- **Top bar**: Smaller `brand-mark` (52→40px), tighter `.topbar` padding on chat focus, slightly smaller runtime/plan pills; subtitle (`.sub`) clamped to ~2 lines.
- **CSS variables on chat focus**: `--sticky-toolbar-top: 54px`, `--floating-nav-bottom: 68px` for less scroll “dead zone”.
- **Chat toolbar**: Tighter padding/gap, **`max-height: min(38vh, 400px)`** when expanded so pinned tools cannot eat most of the screen.
- **Transcript**: Much smaller vertical padding on `#chatLog`; smaller bubbles (padding, margin, line-height).
- **Composer**: Thinner `chatbar`, `composer-meta`, `chips`; safe-area preserved.
- **Onboarding**: Less vertical padding.
- **Mini toolbar**: Tighter when chat toolbar is collapsed.
- **Collapsed workspace hero**: Smaller title/padding when deck is collapsed.

### 4. Behaviour: collapse workspace on Android chat

`syncStrategicLayoutState()` in `app.js` now treats **`native Android + chat page active`** like “has messages”: workspace deck and strategic strip collapse (or hide strip) **even for an empty thread**, reclaiming a full band of height.

Default **chat toolbar collapsed** on first install is also enforced for Android when `localStorage` has no prior preference (`KEYS.chatToolbarCollapsed === null`).

## Files touched

- `index.html` — `body.native-android` / `body.android-chat-focus` rules.
- `app.js` — classes, `syncStrategicLayoutState`, `openWorkspacePage`, `init` defaults.
