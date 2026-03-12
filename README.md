# AI Workspace Studio v6

منصة ذكاء اصطناعي متكاملة تعمل بدون Build (Static) — مناسبة لـ GitHub Pages + PWA.

## أهم الميزات
- Chat مع Streaming + RAG (Knowledge Base)
- Files: PDF/DOCX/Text/Images
- Knowledge Base (Embeddings) + بحث + اقتباسات
- Canvas: كتابة + تحسين + توليد تطبيق HTML
- Workflows: قوالب تشغيل + Builder
- Tools (Agent Tools): kb_search / web_search / download_file
- Secure Gateway (Cloudflare Worker) لإخفاء API Key عن المتصفح

## تشغيل سريع
1) افتح Settings
2) اختر Provider = OpenRouter
3) اختر Auth Mode:
   - Browser: ضع API Key
   - Gateway: ضع Gateway URL (وToken إن استخدمت)
4) ارفع ملفات → Knowledge Base → Re-index
5) في Chat فعّل RAG و/أو Tools حسب الحاجة

## ملاحظات
- Web Search يعتمد على OpenRouter عبر لاحقة :online (قد يختلف حسب الموديل)
- Embeddings تحتاج Embedding Model (مثال: openai/text-embedding-3-small)
- في GitHub Pages قد تحتاج Hard Refresh بعد التحديث بسبب Service Worker.


## v6.1 Hotfix
- Fix: ReferenceError `key is not defined` during chat send/stream (replaced with settings.apiKey).
- Cache bump: app.js?v=61 + cache aistudio-cache-v61.


## v6.2
- إضافة: محادثة جديدة + مسح الدردشة من داخل صفحة الدردشة.
- إضافة: إرفاق ملفات/صور مباشرة في الدردشة (OCR للصور + استخراج PDF/DOCX).
- إضافة: Deep Search Toggle (الإرسال يشغل Research تلقائياً).
- تحسين: إرسال سياق ملفات المشروع تلقائياً إذا كان مربع Files Context فارغ.

## v6.3
- تحسين: تطبيق تحديثات `index.html` و `app.js` فورًا عبر Service Worker (network-first لهذين الملفين).
- تحسين: تفعيل تحديث الـ Service Worker تلقائيًا ثم إعادة تحميل الصفحة عند توفر نسخة جديدة.


## تشغيل للوصول من أي متصفح/جهاز (بدون تقييد localhost)
يمكنك تشغيل خادم محلي آمن نسبيًا ومتاح من أي جهاز على نفس الشبكة عبر:

```bash
node server.mjs
```

افتراضيًا سيعمل على:
- `HOST=0.0.0.0` (يسمح بالوصول من أي متصفح/جهاز)
- `PORT=8080`

يمكن التخصيص:
```bash
HOST=0.0.0.0 PORT=9090 node server.mjs
```

الخادم يضيف:
- `Access-Control-Allow-Origin: *` لتسهيل الوصول من المتصفحات المختلفة
- Security headers أساسية (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`)

> ملاحظة: إعدادات جدار الحماية على نظام التشغيل/السيرفر نفسه قد تحتاج فتح المنفذ يدويًا (مثل 8080).



## v6.4
- تحسين: تمرير مرفقات الدردشة (خصوصًا الصور) إلى النموذج مباشرة في الرسالة عند دعم الرؤية.
- إضافة: استخراج نص ذكي للمرفقات عبر OCR للصور عند الإرفاق في الدردشة.


## v6.5
- تحسين OCR: اعتماد لغة OCR قابلة للتخصيص من الإعدادات (`ara+eng` افتراضيًا) مع fallback تلقائي.
- إصلاح DOCX: توحيد تحويل ناتج html-to-docx إلى Blob قبل التنزيل لتفادي فشل التصدير في بعض المتصفحات.
- إضافة: دعم تحويل PDF→DOCX عبر CloudConvert Worker Endpoint اختياري من الإعدادات (بديل للتحويل المحلي).

## إعداد Gateway الصحيح
تم تجهيز الإعدادات الافتراضية داخل التطبيق للعمل مباشرة مع بوابة API:
- Gateway URL: `https://bspro-api.tntntt830.workers.dev`
- Cloud PDF→Word Endpoint: `https://bspro-api.tntntt830.workers.dev/convert/pdf-to-docx`
- Cloud OCR Endpoint: `https://bspro-api.tntntt830.workers.dev/ocr`
- Auth Mode الافتراضي: `gateway`

إذا كان لديك Worker ثابت للواجهة (مثل `keys.*.workers.dev`) وWorker آخر للـ API، ضع رابط Worker الـ API في Gateway URL.

إذا كان الـWorker يتطلب حماية إضافية، ضع قيمة **Gateway Client Token** من صفحة الإعدادات.

## حل مشكلة "الرابط لا يعمل" (ERR_FAILED)
إذا ظهر الخطأ عند فتح رابط مثل `https://keys.<subdomain>.workers.dev` فجرّب التالي بالترتيب:

1. **تأكد من الرابط الصحيح**
   - رابط الـ API الافتراضي للتطبيق هو:
     `https://bspro-api.tntntt830.workers.dev`
   - رابط الصحة (Health Check):
     `https://bspro-api.tntntt830.workers.dev/health`

2. **لا تستخدم Worker الواجهة كرابط Gateway**
   - في إعدادات التطبيق (`Auth Mode = gateway`)، ضع رابط Worker الـ API فقط.
   - لا تضع رابط Worker ثابت/واجهة إذا كان لا يقدّم مسار `/v1/*`.

3. **اختبر من Cloudflare Dashboard**
   - Workers & Pages → اختر Worker المطلوب.
   - تأكد أن آخر Deploy ناجح، وأن عنوان `workers.dev` ظاهر ومفعّل.

4. **أعد النشر إذا كان الرابط متوقفًا**
   ```bash
   wrangler deploy
   ```

5. **تأكد من الأسرار المطلوبة**
   ```bash
   wrangler secret put OPENROUTER_API_KEY
   # اختياري:
   wrangler secret put GATEWAY_CLIENT_TOKEN
   ```

6. **امسح الكاش/حدّث قسريًا**
   - لأن التطبيق PWA، نفّذ Hard Refresh أو احذف Service Worker وCache ثم افتح الرابط مجددًا.

> ملاحظة: إذا كان `bspro-api.../health` يعمل بينما `keys...` لا يعمل، فغالبًا Worker `keys` غير منشور أو تم حذفه، واستخدام `bspro-api` كـ Gateway يكفي للتشغيل.



## ملاحظة Cloudflare: رسالة "Update your wrangler config file"
إذا ظهرت الرسالة البرتقالية داخل Dashboard عند إضافة Secret، فهذا **تنبيه مزامنة فقط** وليس خطأ يمنع النشر.

الطريقة الموصى بها (لتفادي الالتباس):
1. أضف السر من CLI:
   ```bash
   wrangler secret put OPENROUTER_API_KEY
   ```
2. انشر العامل:
   ```bash
   wrangler deploy
   ```
3. اختبر:
   ```bash
   curl https://<your-worker>.workers.dev/health
   ```

> ملاحظة: قيمة الـ Secret لا تُكتب داخل `wrangler.jsonc` (لأسباب أمنية)، لذلك ظهور تنبيه المزامنة متوقع عند التعديل من Dashboard.

## محتوى Worker باسم `keys`
الملف المقترح داخل المشروع: `keys-worker.js`.

### أسرار (Secrets) مطلوبة في Cloudflare
- `OPENROUTER_API_KEY` (مفتاح OpenRouter الأساسي داخل السيرفر)
- `GATEWAY_CLIENT_TOKEN` (اختياري لحماية إضافية)
- `OPENROUTER_REFERER` (اختياري)
- `OPENROUTER_TITLE` (اختياري)

### مثال إعداد سريع
```bash
wrangler secret put OPENROUTER_API_KEY
wrangler secret put GATEWAY_CLIENT_TOKEN
wrangler deploy
```
