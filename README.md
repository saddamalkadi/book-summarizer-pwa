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
