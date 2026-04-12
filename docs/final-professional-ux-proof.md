# Professional UX — proof checklist

## Chat dominance

- [ ] On **Chat**, workspace marketing blocks (use cases + shortcut grid) are **not** visible when the deck is collapsed.
- [ ] **#chatLog** occupies visibly more vertical share vs pre-change screenshot (same viewport).
- [ ] With **≥1 message**, onboarding strip is **hidden**.

## Hierarchy

- [ ] Primary actions (send, attach, model strip or mini toolbar) remain **one tap/click** away.
- [ ] Subtopbar label is **not** visible but quick actions remain (keyboard/screen reader: toolbar `aria-label`).

## Clutter / copy

- [ ] Composer status line is **shorter** on chat.
- [ ] Keyboard hint appears **on composer focus** only (chat page).
- [ ] Thread drawer subtitle is **short**.

## Defaults

- [ ] First visit on viewport **≤1200px**: chat toolbar starts **collapsed** (unless user previously expanded).

## Regression

- [ ] STT, TTS, attachments, thread list, settings, home still work.
- [ ] Leaving chat removes `chat-page-active`; workspace deck expands again on **Home** per existing `ensureHomeWorkspaceLanding`.

## Sign-off

| Surface | Checked | Notes |
|---------|---------|-------|
| Web | | |
| Android APK | | |
