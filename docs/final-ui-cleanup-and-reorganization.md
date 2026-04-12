# UI cleanup and reorganization — implementation summary

## JavaScript (`app.js`)

### `syncStrategicLayoutState`

- **Before**: Workspace collapsed on chat only for **native Android**.
- **After**: **`chatActive` alone** toggles collapse + strategic strip collapse — **web and APK** get the same chat-first chrome reduction.

### `openWorkspacePage`

- Toggles **`body.chat-page-active`** whenever `page === 'chat'` (in addition to existing `android-chat-focus`).

### `renderChat`

- Sets **`chat-has-messages`** when the thread has messages; clears it on empty state.

### `ensureStrategicChrome` (quick bar)

- Subtopbar label shortened in DOM to «إجراءات» + **`aria-label`** on the toolbar for accessibility.

### Composer

- **Default hint** in injected HTML: short keyboard line.
- **Placeholder** (textarea replacement): shorter copy.
- **`syncComposerMeta`**: On active chat page, status line uses **` · `** separators and compact tokens (`N ملف · M رسالة`, shorter attachment phrases).

### Init defaults

- **Default collapsed chat toolbar** when viewport **`max-width: 1200px`** (was `< 980px`) so tablets/laptops get more transcript height without losing expand.

### Thread drawer

- Subtitle text shortened.

## CSS (`index.html`)

New block **`body.chat-page-active` …** including:

- Tighter `.app` gap.
- Smaller `#topRuntimeBadge`.
- **Screen-reader-only** subtopbar label (clip pattern).
- Tighter main toolbar margins on `#page-chat`.
- **Hide** workspace use-case grid + nav shortcuts when collapsed on chat.
- **Hide** second line inside `wqa-text` spans (subtitle noise).
- **Hide** `#chatOnboarding` when `chat-has-messages`.
- Composer hint **only when** `.chatbar:focus-within` (sibling `~` selector).
- Download **hint** in bubble actions: ellipsis + smaller type.

## HTML (`index.html`)

- **`#chatInput`** placeholder shortened (static input; JS still replaces with textarea).

## Not changed

- Home page marketing copy (out of scope for “chat phase” but untouched).
- Toolbar controls and IDs.
- Sidebar structure.
