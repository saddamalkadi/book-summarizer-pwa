# AI Workspace Studio v9.0

منصة ذكاء اصطناعي متكاملة للدردشة والملفات والمعرفة وسير العمل — تعمل على الويب وAndroid.

## الميزات الأساسية

- **دردشة ذكية** مع بث مباشر (Streaming) ونماذج متعددة عبر OpenRouter
- **معالجة الملفات**: PDF / DOCX / Text / Images مع OCR
- **قاعدة المعرفة**: Embeddings + بحث دلالي + اقتباسات
- **اللوحة**: كتابة وتحسين وتوليد محتوى
- **سير العمل**: قوالب تشغيل جاهزة
- **الصوت**: تحويل الكلام لنص (STT) ونص لكلام (TTS) باللغة العربية
- **بوابة آمنة**: Cloudflare Worker لإخفاء مفتاح API عن المتصفح
- **مصادقة**: Google OAuth + تسجيل بالبريد + كلمة مرور الإدارة
- **الوضع الليلي**: تصميم داكن احترافي
- **PWA**: قابل للتثبيت كتطبيق ويب
- **Android**: تطبيق أصلي عبر Capacitor

## التشغيل

```bash
PORT=5000 node server.mjs
```

## البناء

### الويب
الملفات الأساسية جاهزة للنشر كموقع ثابت (GitHub Pages أو أي استضافة ثابتة).

### Android
```bash
npm install
npm run cap:sync
cd android && ./gradlew assembleRelease
```

## المتطلبات

| متغير البيئة | الوصف |
|---------|---------|
| `OPENROUTER_API_KEY` | مفتاح OpenRouter |
| `CF_API_TOKEN` | Cloudflare API Token |
| `CF_ACCOUNT_ID` | Cloudflare Account ID |
| `CF_KV_NAMESPACE_ID` | Cloudflare KV Namespace ID |
| `ADMIN_PASSWORD_REAL` | كلمة مرور المسؤول |
| `APP_ADMIN_EMAIL` | بريد المسؤول |
| `GOOGLE_CLIENT_ID_WEB` | Google OAuth Client ID |

## الترخيص

جميع الحقوق محفوظة.
