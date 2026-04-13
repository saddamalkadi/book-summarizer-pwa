# v864 Web + APK Parity Proof

تم تطبيق التعديلات على web أولًا ثم مزامنتها إلى Capacitor لضمان نفس الحالة.

## دلائل الإصدار (بعد الرفع)

- `package.json`: `8.65.0`
- `index.html`:
  - `data-appver="8.65"`
  - `app.js?v=865`
  - `sw.js?v=865`
  - `aistudio-cache-v865`
- `app.js`: `WEB_RELEASE_LABEL = 'v8.65'`
- `sw.js`: `APP_VERSION = "865"`
- `manifest.webmanifest`: `AI Workspace Studio v8.65`
- `android/app/build.gradle`:
  - `versionCode 865`
  - `versionName "8.65.0"`

## ملاحظة التزامن

تنفيذ `npm run cap:sync` بعد التعديلات ينسخ أصول web النهائية إلى Android assets لنفس الحالة بدون باندل قديم.
