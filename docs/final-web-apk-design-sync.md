# Web ↔ APK design sync

## Single source of truth

All layout and hierarchy changes live in:

- `index.html` (styles + static markup)
- `app.js` (runtime classes, composer block, strategic layout, init defaults)

There is **no** separate Android layout project: the Capacitor WebView loads the same `www` bundle produced by `npm run sync:web` / `npm run cap:sync`.

## Platform-specific overlays

- **`body.native-android`** / **`android-chat-focus`**: still apply **extra** density on real Android devices (previous phase). They **stack** with `chat-page-active` where both apply.
- **`chat-page-active`**: applies on **every** environment when the chat page is open — this is the **shared** chat-first pass.

## Release checklist

```bash
npm run cap:sync
cd android && ./gradlew.bat :app:assembleDebug
```

Install `android/app/build/outputs/apk/debug/app-debug.apk` and confirm:

- [ ] Opening **Chat** adds `chat-page-active` to `<body>` (remote WebView inspect).
- [ ] Workspace deck is **collapsed** on chat on **desktop browser** and **APK**.
- [ ] With messages, onboarding is **gone**; composer hint appears on **focus** only.

## Parity statement

Web PWA and Android APK render the **same** DOM/CSS/JS after sync; any difference is limited to **`native-android`** optional rules and OS fonts/safe areas.
