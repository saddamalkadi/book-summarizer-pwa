# v8.91 — Final Release Candidate (user-testing RC)

نسخة التجربة النهائية قبل النشر للمتجر، مبنية من نفس نقطة الكود (الويب + APK + صفحة التنزيل).

## Checksum / Distribution

- Web: `https://app.saddamalkadi.com` (GitHub Pages)
- APK: `downloads/ai-workspace-studio-latest.apk` (2.2 MB — R8 minify + shrinkResources enabled)
- Versioned APK: `ai-workspace-studio-v8.91.0-android-release.apk`
- `versionCode` = 891 / `versionName` = 8.91.0
- `apksigner verify` → Signed with APK Signature Scheme v2 ✓

## ما تمّت إضافته فوق v8.90

- Service Worker: إضافة رسالة `CLEAR_CACHE` لتصفير كامل الكاش من العميل، و
  `fetch(req,{cache:'no-store'})` في مسار `networkFirst` لضمان إلغاء كاش المتصفح قبل
  الكاش الخاص بالـSW، و `try/catch` حول `cache.addAll(CORE)` حتى لا يعطل تسجيل
  الـSW إذا فشل أحد الأصول.
- صفحة التنزيل: حذف سطر `meta robots` المكرر، إضافة meta للتحكم بالكاش، وإضافة
  cache-bust تلقائي للرابط الأساسي.
- `scripts/smoke-test.mjs`: فحص Playwright دخاني لأساسيات الواجهة (الشريط العلوي،
  القائمة الجانبية، تبديل الصفحات، درج الجوال، حقل الدردشة) وتحقق من رقم الإصدار
  المرئي.
- Android: بناء موقَّع فعلي بالـ release keystore المحلي، مع تفعيل R8
  (`minifyEnabled true`) و `shrinkResources true` — نتيجة: APK بحجم ~2.2 MB بدل
  ~4.7 MB، مع الحفاظ على عمل Capacitor عبر قواعد ProGuard الموجودة.
- حذف ملفات APK القديمة (v8.85/v8.85.0/v8.90.0) من `downloads/`.

## ما هو موروث من الـ RC السابق (v8.90) ويظل ساريًا

- لا رسائل داخلية للـ runtime في الواجهة (لا `APP_ADMIN_PASSWORD`، لا `sadam-key`).
- `auth-bridge.html` و `downloads/` عليهما `noindex,nofollow`.
- `_config.yml` في Jekyll يستبعد `docs/`, `keys-worker.js`, `convert-worker.js`,
  `server.mjs`, `package.json`, `wrangler*.jsonc`, `scripts/`, `android/`, `ios/`,
  `node_modules/`, `attached_assets/` من مخرجات GitHub Pages.
- `CI/build-apk.yml` يبني الـAAB في مسار داخلي فقط (لا ينشره للعامة).

## اختبار دخاني

- Desktop (1440x900): topbar ✓، sidebar ✓، chat nav ✓، new thread ✓،
  sideAccountStrip ✓، chatInput ✓، sendBtn ✓، sideVersionLabel = `v8.91` ✓.
- Mobile (Pixel 7): topbar ✓، openSideBtn ✓، side drawer opens ✓، chat input ✓.

## خارج النطاق

- iOS IPA — يحتاج Xcode/Codemagic مع شهادات Apple Developer (لم يُبن من هذا الـ Runtime).
