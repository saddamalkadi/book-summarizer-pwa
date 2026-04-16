# AI Workspace Studio v8.84

منصة عربية ثابتة (Static PWA) للدردشة والملفات والمعرفة وسير العمل، مع تغليف Capacitor لـ Android.

## ما الذي يُشحن في هذا المستودع؟

- **الويب الحي**: `index.html` + `app.js` + `sw.js`
- **بوابة الـ API**: `keys-worker.js`
- **خدمة التحويل/OCR**: `convert-worker.js`
- **تغليف Android**: داخل `android/`
- **صفحة التحميلات العامة**: `downloads/index.html`

## أوامر أساسية

### مزامنة الإصدار والويب
```bash
npm install
npm run sync:web
```

### مزامنة Capacitor مع Android
```bash
npm run cap:sync
```

### تشغيل خادم ثابت محلي
```bash
node server.mjs
```

> الخادم المحلي الحالي **لا** يقوم بأي auto-deploy أو auto-push أو حقن أسرار.  
> كما أنه يحجب الملفات والمجلدات غير المخصصة للوصول العام.

### بناء Android Release
```bash
cd android
./gradlew assembleRelease
./gradlew bundleRelease
```

## الإعدادات الإنتاجية المتوقعة

### الويب
- النطاق الحي المقصود: `https://app.saddamalkadi.com`
- الكاش والإصدار تتم مزامنتهما تلقائيًا عبر `npm run sync:web`

### Gateway / Worker
- اضبط أسرار Cloudflare المناسبة بدل أي قيم hardcoded:
  - `OPENROUTER_API_KEY`
  - `APP_SESSION_SECRET`
  - `UPGRADE_CODE_SECRET`
  - `UPGRADE_ADMIN_TOKEN`
  - `APP_ADMIN_PASSWORD` عند تفعيل دخول الإدارة بكلمة المرور
  - `GATEWAY_CLIENT_TOKEN` إذا رغبت بحماية إضافية من العميل
- يوصى أيضًا بتحديد:
  - `APP_ALLOWED_ORIGINS=https://app.saddamalkadi.com,https://app.saddamalkadi.com/`

### Android
- أضف `android/keystore.properties` محليًا ولا تقم برفعه إلى المستودع.
- عند وجود keystore صحيح، سيتم تفعيل:
  - `minifyEnabled`
  - `shrinkResources`
  - توقيع release الحقيقي

## ملاحظات تشغيلية

- صفحة التحميلات العامة للمستخدم النهائي تعرض **APK فقط** كقناة تجربة معتمدة.
- ملفات المتجر مثل AAB يجب أن تُدار داخليًا، لا أن تُعرض للمستخدم النهائي.
- الـ Service Worker مضبوط على network-first للملفات الحرجة لمنع بقاء المستخدم على نسخة قديمة.

## التحقق السريع قبل الإطلاق

1. افتح الويب وتأكد أن الإصدار الظاهر يطابق `package.json`.
2. اختبر `https://api.saddamalkadi.com/health`.
3. شغّل `npm run cap:sync`.
4. ابنِ `assembleRelease`.
5. تأكد أن `downloads/index.html` وداخل التطبيق يشيران إلى نفس APK النهائي.
