# Final visible UI proof — obvious change, web + APK

## Why the difference is now obvious (not subtle)

Previously, the chat page still showed a **large workspace band** (hero + quick actions + status) even after the conversation started. That competed with `#chatLog` for vertical attention.

**Now:** when the user is on **Chat** (`body.chat-page-active`) **and** the thread has **at least one message** (`body.chat-has-messages`), the entire **`#workspaceDeck` is `display: none`**. That removes a **full card-height block** above the transcript on both **web** and **APK** — the same HTML/CSS bundle runs in the Capacitor WebView.

Additional **obvious** changes (same bundle):

| Before (visible) | After (visible) |
|------------------|-----------------|
| Workspace deck (title, buttons, status) above messages | **Gone** once there are messages |
| «مشروع: …» subtitle in top bar | **Hidden** on chat (`#topSubtitle`) |
| Long composer keyboard hint | **Hidden** until the composer row is focused |
| Onboarding strip under empty state | **Hidden** once messages exist |
| Use-case + shortcut grids in collapsed deck | **Hidden** on chat (when deck still shown, empty thread) |

## What the user notices immediately

1. **Much taller `#chatLog`** after the first reply — the workspace block **disappears** entirely.
2. **Cleaner top bar** on chat — no project subtitle line.
3. **Less text noise** under the input until they tap the field.

## Less clutter / cleaner hierarchy / more chat space

- **Clutter**: workspace marketing UI removed from the reading path after conversation starts.
- **Hierarchy**: transcript becomes the dominant layer; model toolbar + composer stay as tools, not marketing.
- **Non-essential text**: subtitle hidden; hint on demand; shorter meta line (from `app.js` `syncComposerMeta`).

## Web and APK parity

- Source of truth: **`index.html`** + **`app.js`** in the repo root.
- **APK**: after `npm run cap:sync`, `www/` is copied into `android/app/src/main/assets/public/` (see Capacitor copy step). **Committing** root `index.html` / `app.js` is sufficient for parity when the team runs **`npm run cap:sync`** before `assembleDebug` / release.
- **No separate Android layout** — same CSS classes (`chat-page-active`, `chat-has-messages`).

## Repository / `main` confirmation

**Local commit:** `d75e0ca` — `feat(ui): obvious chat-first layout; hide workspace when thread has messages; add final and platform docs`  
(Includes all `docs/final-*.md`, `docs/android-*.md`, `docs/tts-*.md`, and related docs under `docs/`.)

**Push:** In this automation environment `git push origin main` failed (`remote-https` helper). On your machine run:

```bash
git pull --rebase origin main
git push origin main
```

After a successful push, verify on GitHub:

- Branch: **`main`**
- Paths: `docs/final-ui-audit.md`, `docs/final-chat-priority-layout.md`, `docs/final-ui-cleanup-and-reorganization.md`, `docs/final-web-apk-design-sync.md`, `docs/final-professional-ux-proof.md`, **`docs/final-visible-ui-proof.md`**

Local verification commands:

```bash
git status
git log -1 --oneline
git ls-tree -r main --name-only | findstr /i "docs/final"
```

(Use `grep` on macOS/Linux instead of `findstr`.)

## Build checklist (APK)

```bash
npm run cap:sync
cd android && ./gradlew.bat :app:assembleDebug
```

Install the APK and confirm: open Chat → send one message → **workspace area above messages is gone**.
