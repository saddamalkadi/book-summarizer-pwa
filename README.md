# AI Workspace Studio

منصة ذكاء اصطناعي عربية تعمل مباشرة في المتصفح وبدون خطوة Build، مناسبة لـ GitHub Pages + PWA، مع غلاف Capacitor لتطبيق Android.

## أهم الميزات
- دردشة مع Streaming + RAG (قاعدة معرفة)
- دعم ملفات PDF / DOCX / نصوص / صور
- قاعدة معرفة (Embeddings) + بحث واقتباسات
- لوحة عمل (Canvas) للتحرير وتوليد تطبيقات HTML
- سير عمل (Workflows) بقوالب جاهزة
- أدوات وكيل: `kb_search` / `web_search` / `download_file`
- بوابة آمنة (Cloudflare Worker) لإخفاء مفاتيح API عن المتصفح

## تشغيل سريع

1. افتح **الإعدادات**.
2. اختر مزوّد النموذج (OpenRouter / OpenAI / Gemini).
3. اختر نمط المصادقة:
   - **المتصفح (BYOK)**: أدخل مفتاح API الخاص بك.
   - **البوابة**: استخدم بوابة `api.saddamalkadi.com` الرسمية (الافتراضية) أو أي بوابة مخصصة.
4. ارفع الملفات واستخدم قاعدة المعرفة وRAG عند الحاجة.

## البوابة الرسمية

- Gateway URL: `https://api.saddamalkadi.com`
- Health Check: `https://api.saddamalkadi.com/health`
- Auth Mode الافتراضي: `gateway`

إذا كنت تستخدم بوابة خاصة بك، ضع رابط Worker الذي يقدّم مسارات `/v1/*` في حقل **Gateway URL** داخل الإعدادات.

## تشغيل للتجربة محليًا

```bash
node server.mjs
```

افتراضياً:
- `HOST=0.0.0.0`
- `PORT=8080`

يمكن التخصيص:
```bash
HOST=0.0.0.0 PORT=9090 node server.mjs
```

## التحديث في PWA
التطبيق يستخدم Service Worker بـ `network-first` لـ `index.html` و`app.js`، لذلك يكفي إعادة تحميل الصفحة للحصول على آخر إصدار. في الحالات النادرة التي يبقى فيها كاش قديم، قم بـ **Hard Refresh** أو إلغاء تسجيل Service Worker من أدوات المتصفح.

## بناء Worker الخاص بك (اختياري)

إذا أردت تشغيل بوابتك الخاصة بدل البوابة الرسمية:

1. انشر `keys-worker.js` عبر `wrangler deploy`.
2. أضف الأسرار التالية من CLI:
   ```bash
   wrangler secret put OPENROUTER_API_KEY
   # اختياري لحماية إضافية:
   wrangler secret put GATEWAY_CLIENT_TOKEN
   ```
3. ضع رابط Worker الناتج في حقل **Gateway URL** داخل الإعدادات.

أسرار إضافية اختيارية لخدمة التحويل السحابي (`convert-worker.js`):
- `DOCX_UPSTREAM_URL`, `DOCX_UPSTREAM_TOKEN`, `DOCX_UPSTREAM_FORMAT`
- `OCR_UPSTREAM_URL`, `OCR_UPSTREAM_TOKEN`

> ملاحظة: لا يمكن ضمان مطابقة 100% بين PDF وDOCX الناتج دون محرك تحويل متخصص يتم ربطه عبر `DOCX_UPSTREAM_URL`.

## تنزيل APK

صفحة التنزيل الرسمية: [`/downloads/`](./downloads/)

تحتوي على ملف APK الأحدث، مبني عبر GitHub Actions من نفس المستودع. ملف AAB غير معروض للعامة ويُبنى داخليًا فقط عند الحاجة لرفعه على متجر Play.
