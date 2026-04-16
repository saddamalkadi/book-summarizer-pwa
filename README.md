# AI Workspace Studio v8.84

منصة عمل عربية متكاملة بالذكاء الاصطناعي — تعمل على الويب وأندرويد كتطبيق PWA وتطبيق أصلي.

## الروابط

- **نسخة الويب**: [app.saddamalkadi.com](https://app.saddamalkadi.com)
- **تنزيل APK**: [صفحة التنزيلات](https://app.saddamalkadi.com/downloads/)

## الميزات الرئيسية

- دردشة ذكية مع بث مباشر (Streaming) عبر OpenRouter
- دعم أكثر من 200 نموذج ذكاء اصطناعي
- معالجة الملفات: PDF / DOCX / النصوص / الصور
- قاعدة معرفة (Knowledge Base) مع بحث واقتباسات
- لوحة كتابة (Canvas) مع تحسين وتوليد
- سير عمل (Workflows) مع قوالب جاهزة
- بوابة آمنة (Gateway) عبر Cloudflare Worker
- تسجيل دخول عبر Google OAuth
- إملاء صوتي وقراءة صوتية (TTS/STT)
- وضع ليلي احترافي
- دعم كامل للغة العربية (RTL)
- تطبيق Android أصلي عبر Capacitor

## البنية التقنية

- **الواجهة**: HTML/CSS/JS بدون أدوات بناء (Static PWA)
- **الخادم**: `server.mjs` — خادم ملفات ثابتة مع Node.js
- **البوابة**: `keys-worker.js` — Cloudflare Worker (Auth + Gateway + Voice)
- **التحويل**: `convert-worker.js` — Cloudflare Worker (OCR + PDF→DOCX)
- **الموبايل**: Capacitor wrappers (Android / iOS)

## التشغيل المحلي

```bash
npm install
node server.mjs
```

## بناء تطبيق Android

```bash
npm run sync:web
npm run cap:sync
cd android && ./gradlew assembleRelease
```

## الترخيص

جميع الحقوق محفوظة.
