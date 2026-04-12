# Android final usability — proof checklist

This document records what was optimized and how to confirm it on a **debug/release APK** after `npm run cap:sync` and a fresh Gradle build.

## Part A — Chat layout / space

### Expected visible changes (portrait, ≤980px width)

1. **More vertical room for `#chatLog`** — less padding on the transcript and bubbles, slightly smaller composer block when empty (`resizeComposerInput` min height 50px).
2. **Tighter chat toolbar card** — same three-column/grid behavior where applicable, but shorter margins and padding.
3. **Smaller reserved scroll padding** — `--sticky-toolbar-top` and `--floating-nav-bottom` reduced on mobile breakpoints.
4. **Top app chrome** — slightly less padding around `.app` and `.topbar` when chat is the active page.

### Regression checks

- [ ] Chat page still uses **only `#chatLog`** as the scrollable transcript (toolbar + composer do not steal scroll).
- [ ] No overlap between sticky toolbar, workspace strip, and composer when the keyboard opens (spot-check).
- [ ] Collapsed chat toolbar + **mini toolbar** still usable.
- [ ] Touch targets on chatbar primary actions remain **≥44px** on mobile rules.

## Part B — STT / dictation

### Expected behavior

- [ ] Voice button **does not stay** on “جارٍ التحضير” indefinitely.
- [ ] After permission grant, dictation **starts** (native listener / status) or fails with a toast and **returns to ready**.
- [ ] Recognized text **appends** into the composer as before.
- [ ] **TTS** still plays assistant replies when voice mode expects it.

### Technical confirmation

- Root fix: **`getSupportedLanguages()`** no longer blocks Android; non-Android uses a **timeout race**.

## Build steps

```bash
npm run cap:sync
cd android && ./gradlew assembleDebug
```

Install `android/app/build/outputs/apk/debug/app-debug.apk` on device or emulator.

## Related docs

- `docs/android-chat-space-optimization.md` — layout/CSS/JS details.
- `docs/android-stt-preparing-fix.md` — STT hang root cause and fix.

## Sign-off

| Check | Date | Result / notes |
|-------|------|----------------|
| Layout on Android portrait | | |
| STT start + text in composer | | |
| TTS after STT fix | | |

*(Fill after on-device run.)*
