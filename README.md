# AI Workspace Studio (v1)

واجهة عربية RTL تشبه منصات الذكاء الاصطناعي المتكاملة:
- Projects (محادثات + كانفس + ملفات + إعدادات لكل مشروع)
- Chat مع Deep/Agent + Web Search toggle (OpenRouter :online)
- Canvas مع HTML Preview
- Files (إضافة نص كسياق)
- Downloads (استخراج ملفات من ```file blocks)

## نشر على GitHub Pages
ارفع الملفات إلى جذر المستودع:
- index.html
- app.js
- sw.js
- manifest.webmanifest

ثم فعّل Pages → main / root.

## ملاحظة أمان
مفاتيح API في المتصفح مناسبة للتجربة فقط.
للنشر العام استخدم Proxy (Cloudflare Worker) لحماية المفاتيح.
