# AI Workspace Studio v3

نسخة استراتيجية (Workspace) تشبه منصات الذكاء الاصطناعي:

## ماذا أضيف في v3
- ✅ PDF/DOCX parsing داخل المتصفح (pdf.js + mammoth)
- ✅ Knowledge Base (Embeddings) + RAG داخل الدردشة (Toggle)
- ✅ صفحة KB: فهرسة + بحث + إعدادات (Top‑K / Chunking / RAG instruction)
- ✅ Research Agent (3 خطوات) + إنشاء ملف report.md
- ✅ Smart Memory (تلخيص تلقائي عند تضخم السياق)
- ✅ باقي مزايا v2: Projects + Canvas + Downloads + Model Hub + Streaming

## طريقة الاستخدام السريعة
1) افتح الإعدادات وضع API Key
2) ارفع ملفات PDF/DOCX من صفحة "الملفات"
3) افتح صفحة "المعرفة (KB)" وضع Embedding Model  
   - OpenRouter غالباً: `openai/text-embedding-3-small`
4) اضغط "فهرسة KB"
5) ارجع للدردشة وفعّل RAG

## ملاحظات
- Web يعتمد على OpenRouter `:online` عند تفعيل Web Mode + زر Web
- OCR للصور غير مضاف في v3 (يمكن إضافته في v4)
