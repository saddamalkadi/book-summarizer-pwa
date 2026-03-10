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

## إعداد bspro-api.tntntt830.workers.dev
تم تجهيز الإعدادات الافتراضية داخل التطبيق للعمل مباشرة مع بوابة:
- Gateway URL: `https://bspro-api.tntntt830.workers.dev`
- Cloud PDF→Word Endpoint: `https://bspro-api.tntntt830.workers.dev/convert/pdf-to-docx`
- Cloud OCR Endpoint: `https://bspro-api.tntntt830.workers.dev/ocr`
- Auth Mode الافتراضي: `gateway`

إذا كان الـWorker يتطلب حماية إضافية، ضع قيمة **Gateway Client Token** من صفحة الإعدادات.
