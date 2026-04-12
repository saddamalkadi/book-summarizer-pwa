# Reading mode (clean chat chrome) — v8.61

## Purpose

Maximize the **chat transcript area** by hiding:

- Main **top bar** (modes, new thread, etc.)
- **Quick action** sub-bar (`#chatQuickActionBar`)
- Chat **main toolbar** (model, prompts, tools)
- **Mini toolbar** (`#chatMiniToolbar`)
- **Composer** (`.chatbar`)
- **Composer meta** and **attachment chips** (when visible)

## UX

- **Toggle:** button **«قراءة»** in `#chatQuickActionBar` (created in `ensureStrategicChrome`).
- **Exit:** floating button **«✕ واجهة»** (`#chatReadingModeExitBtn`) while reading mode is active.
- **Keyboard:** `Escape` turns reading mode off (only when `body.chat-reading-mode` is set).

## State

- **Key:** `KEYS.chatReadingMode` → `aistudio_chat_reading_mode_v1`
- **Storage:** `localStorage` value `'1'` when enabled.
- **Unsynced:** key is listed in `UNSYNCED_STORAGE_KEYS` so it stays **per-device** (phone vs desktop).

## CSS

Rules live in `index.html` under `body.chat-page-active.chat-reading-mode …`.  
The same bundle ships in the **Capacitor APK**, so behavior matches web.

## Implementation hooks (`app.js`)

- `isChatReadingModeEnabled` / `setChatReadingMode` / `syncChatReadingModeUi`
- `openWorkspacePage`: leaving chat clears `chat-reading-mode` and hides the exit FAB; entering chat runs `syncChatReadingModeUi`.
- `init` calls `syncChatReadingModeUi()` after the first page open.

## Limitations

- While reading mode is on, the **قراءة** toggle is hidden with the quick bar — use the **FAB** or **Escape**.
