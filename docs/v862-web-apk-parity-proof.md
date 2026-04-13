# v8.62 web/apk parity proof (shipped in v8.63)

## المصدر

الويب هو المصدر، ثم المزامنة إلى أصول Android عبر:

```bash
npm run cap:sync
```

## علامات الإصدار

- `package.json`: `8.63.0`
- `index.html`: `data-appver="8.63"`
- `index.html`: `app.js?v=863`
- `index.html`: `sw.js?v=863`
- `sw.js`: `APP_VERSION = "863"`
- `android/app/build.gradle`: `versionCode 863`, `versionName "8.63.0"`

## عناصر parity المرتبطة بهذا التمرير

- ترتيب RTL الجديد للـ composer من `app.js` + CSS في `index.html`.
- `chatbar-composer-cluster` بنفس البنية في نسخة الويب ونسخة Android assets بعد sync.
- عدم تعديل selectors الخاصة بـ reading mode.

## مسار الأصول داخل Android

- `android/app/src/main/assets/public/index.html`
- `android/app/src/main/assets/public/app.js`
- `android/app/src/main/assets/public/sw.js`
- `android/app/src/main/assets/public/manifest.webmanifest`

## فحص عملي سريع

1. افتح الدردشة:
   - ترتيب الأزرار في RTL يبدأ بالصوت ثم الإرسال.
   - زر المرفقات داخل الكتلة الموحدة وبعيد طرفيًا.
2. فعّل reading mode:
   - لا يظهر composer كاملًا (كما في السابق).
3. أعد الإرسال/الصوت/المرفقات:
   - جميع الإجراءات تعمل كما قبل.
