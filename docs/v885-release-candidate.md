# v8.85 — Release Candidate (pre-user-testing)

Incremental refinement over v8.84. Same scope, same distribution channel, with an
extra layer of polish and message sanitization.

## ما الجديد فوق v8.84

- **رسائل الإدارة والبوابة**: إزالة أي ذكر لـ `APP_ADMIN_PASSWORD` أو `Cloudflare` أو أسماء
  Workers داخلية (`sadam-key` / `sadam-convert`) من الرسائل التي يراها المستخدم،
  والاكتفاء بعبارات عامة مناسبة للإصدار العام.
- **إعدادات المصادقة**: تحويل الاختيار الافتراضي المرئي لقائمة «نمط المصادقة» إلى
  `gateway` (السلوك الفعلي للتطبيق)، بدل الإيحاء بأن `browser` هو الافتراضي.
- **Service Worker**: `network-first` شامل لـ `sw.js`, `manifest.webmanifest`,
  `auth-bridge.html`, `app.js`, `index.html` — مع `cache: 'no-store'` للمحاولة
  الشبكية، لمنع تعلّق المستخدم على نسخة قديمة نهائيًا. أضفنا أيضًا رسالة
  `CLEAR_CACHE` لتصفير كل الكاش من العميل عند الحاجة.
- **صفحة التنزيل**: عنوانها أقصر وأوضح، رابط احتياطي واحد فقط (GitHub Releases)
  بدل رابطين، و cache-bust تلقائي على الرابط الأساسي.
- **Android APK**: إصدار `8.85.0 (885)` موقّع، متحقَّق منه عبر `apksigner` (v2 scheme)،
  ونفس الكود 100% بين الويب والتطبيق.

## حالة الاختبار

- Playwright smoke (Desktop 1440x900 + Pixel 7): كل العناصر الحيوية ظاهرة وقابلة
  للنقر، العنوان يحتوي `v8.85`، وحقل الدردشة والشريط الجانبي يعملان.
- `apksigner verify`: ✓ موقّع بنظام v2.
- `curl /`: يخدم `index.html` بـ `v8.85` بشكل صحيح.

## ما بقي

- بناء iOS IPA يحتاج macOS + Codemagic (خارج قدرات هذا الـ Runtime).
- ProGuard minify معطَّل عن قصد (تطبيق WebView؛ تفعيل minify يحتاج قواعد keep دقيقة
  لتجنب كسر `window.*` bridges).
