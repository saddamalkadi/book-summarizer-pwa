# v8.84 — Release Candidate (pre-user-testing)

هذه النسخة مخصّصة لتجربة المستخدمين قبل النشر إلى متجر التطبيقات. مخرجات هذا الإصدار:

- نسخة الويب على الكمبيوتر والجوال من `https://app.saddamalkadi.com`.
- ملف APK مستقر للتثبيت المباشر: `downloads/ai-workspace-studio-latest.apk`.
- كل المخرجات مبنية من نفس نقطة الكود `v8.84 / versionCode 884`.

## أبرز التغييرات

### 1) تشديد أمني وإنتاجي
- إزالة كلمة المرور الإدارية الثابتة من `server.mjs`. الآن الكود لا يحتوي قيمة fallback قابلة للتخمين، ويقرأ فقط من `ADMIN_PASSWORD_REAL`. عند غيابها يُعطَّل دخول الإدارة بكلمة المرور تلقائيًا، ويبقى دخول Google الإداري فعّالاً.
- إزالة المسارات الداخلية `APP_ADMIN_PASSWORD` و`sadam-key`/`sadam-convert` من الرسائل الموجّهة للمستخدم، وإبدالها برسائل عامة واضحة.
- إخفاء حزمة `AAB` نهائيًا من واجهة التطبيق ومن صفحة التنزيل (لأنها مخصّصة لمتجر Google Play وليست للتوزيع المباشر).
- تنظيف مجلد `downloads/` وإزالة جميع ملفات APK/AAB/ZIP التاريخية من الإصدارات السابقة، وإبقاء الملف النهائي فقط: `ai-workspace-studio-latest.apk` و`ai-workspace-studio-v8.84-android-release.apk`.
- توقيع APK حقيقي بشهادة مخصّصة (`RSA 2048`, صالحة 10000 يوم)، بدل الاعتماد على مفتاح الـdebug كما كان في الأتمتة.

### 2) ثبات الكاش والنسخ
- رفع `APP_VERSION` إلى `884` وتحديث `aistudio-cache-v884`.
- Service Worker الآن يعامل `sw.js` و`manifest.webmanifest` و`auth-bridge.html` و`app.js` و`index.html` بـ `network-first` حصرًا، لمنع تعلّق المستخدم على نسخة قديمة.
- إضافة رسالة خدمة `CLEAR_CACHE` للعملاء عند الحاجة.
- صفحة التنزيل تحمل meta `no-store/no-cache` ويضاف cache-bust عشوائي للرابط المباشر.

### 3) واجهات ومحتوى
- صفحة `downloads/index.html` أُعيدت كتابتها بالكامل: بطاقة واحدة للـ APK فقط + رابط الويب، بدون AAB، بدون "رابط احتياطي من GitHub" (لتقليل الارتباك الأمني والتشغيلي).
- قسم التنزيلات داخل الإعدادات: أُزيل زر AAB وكل الروابط الاحتياطية. زر واحد `APK Android` + رابط فتح نسخة الويب.
- في الإعدادات: قائمة «نمط المصادقة» صار افتراضها المرئي `gateway` (الرسمية) بدل `browser`، مطابقةً للسلوك الفعلي للتطبيق.
- رسائل التحقق من Gateway لم تعد تذكر أسماء Workers داخلية؛ صارت عامة: «استخدم رابط البوابة الرسمي المقدَّم مع النسخة».

### 4) Android
- `versionCode 884` / `versionName 8.84.0`.
- `android/keystore.properties` وكيستور خاص بالنسخة التجريبية (لا يُرفع إلى git لأنه ضمن `.gitignore`).
- Build: `./gradlew assembleRelease --no-daemon` بنجاح، وتحقّقنا من التوقيع بـ `apksigner verify` (V2 scheme).
- ProGuard/minify: لم يُفعَّل (تطبيق WebView، تمكين minify/shrink بدون قواعد دقيقة قد يعطل JS interop)، لكن التوقيع الحقيقي كافٍ لضمان قابلية التثبيت وعدم ظهور «App not installed».

## اختبار دخاني (Playwright)

- Desktop @ 1440x900: `topbar`, `sidebar`, `chat nav`, `new thread`, `side account strip`, `chat input`, `send button` — كلها ظاهرة وقابلة للنقر. العنوان يحتوي `v8.84` ونص الشريط الجانبي أيضًا `v8.84`.
- Mobile @ Pixel 7: `topbar` ظاهر، `openSideBtn` يعمل، درج التنقّل يفتح ويعرض القوائم، وحقل الدردشة ظاهر بعد فتح الصفحة.
- Dark mode: تم التحقق بصريًا — التباين مقبول، والعناصر الفاتحة ذات النصوص مضبوطة.

## ما يحتاج إعداد Runtime (خارج الكود)

لا يتغيّر شيء جوهري في مفاتيح التشغيل؛ الـWorker يستخدم أسرار Cloudflare الموجودة:
- `OPENROUTER_API_KEY`
- `APP_ADMIN_PASSWORD` (اختياري — غيابها الآن يعطّل زر الدخول بكلمة المرور بأمان بدل كشف رسالة داخلية).
- `GATEWAY_CLIENT_TOKEN` (اختياري).

## ما بقي خارج نطاق هذا الإصدار

- بناء iOS IPA يحتاج macOS + Xcode + Apple Developer، ولم يُنفَّذ هنا. تم الإبقاء على إعدادات `codemagic.yaml` كما هي لتوليده لاحقًا من Codemagic.
- لم يُفعَّل ProGuard minify لأن التطبيق WebView وقد يخسر بعض الدوال الداخلية؛ يمكن تجربته لاحقًا مع قواعد keep محددة.
