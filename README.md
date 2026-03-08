# AI Workspace Studio v2

هذه نسخة **v2** مبنية كتطبيق منصة (Workspace) مشابه لمنصات الذكاء الاصطناعي:
- Projects (لكل مشروع: محادثات + كانفس + ملفات)
- Chat (Streaming + Deep/Agent + Web Toggle)
- Model Hub (قائمة موديلات OpenRouter مع بحث/فلاتر/مفضلة)
- Canvas (معاينة HTML + إصدارات + تصدير TXT/HTML/DOCX)
- Downloads (ملفات من ردود الذكاء عبر قالب ```file)

## نشر على GitHub Pages
ارفع الملفات إلى جذر المستودع:
- index.html
- app.js
- sw.js
- manifest.webmanifest

ثم فعّل Pages → main / root.

## ملاحظات مهمة
- Streaming يعمل عبر Chat Completions SSE (OpenAI/OpenRouter).
- Web Toggle يفعل OpenRouter عبر لاحقة :online عند اختيار Web Mode.
- هذا تطبيق BYOK: ضع مفاتيحك في الإعدادات.
