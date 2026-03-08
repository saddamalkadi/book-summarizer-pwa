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
