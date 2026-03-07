Book Summarizer Pro v13 — Cloud PDF→Word (أفضل خيار مدمج)

هذا الإصدار يضيف خيار "PDF → Word (سحابي — الأفضل)" عبر CloudConvert،
ويتم استدعاؤه من خلال Cloudflare Worker حتى لا يظهر مفتاح CloudConvert داخل GitHub Pages.

الملفات داخل هذا المجلد:
- index.html
- app_ocr.js
- sw.js
- manifest.webmanifest
- cloudflare_worker.js  (كود الـ Worker)

الخطوات (من الجوال أو الكمبيوتر):

1) أنشئ API Key في CloudConvert
   - تحتاج صلاحيات: task.write + task.read
2) أنشئ Cloudflare Worker جديد
   - الصق محتوى cloudflare_worker.js
3) أضف Secret باسم: CLOUDCONVERT_API_KEY وضع فيه مفتاح CloudConvert
4) Deploy
5) انسخ رابط الـ Worker مثل:
   https://bspro-convert.yourname.workers.dev

6) افتح تطبيقك (GitHub Pages) > الإعدادات
   - ضع Worker URL في خانة CloudConvert Worker URL
   - اضغط "حفظ الإعدادات"

7) من قائمة التصدير:
   - اختر "PDF → Word (سحابي — الأفضل)"
   - سيتم رفع PDF مباشرة لـ CloudConvert ثم تنزيل DOCX الناتج.

ملاحظة:
- التحويل السحابي يحتاج إنترنت
- خيار "PDF → Word (أوفلاين — صور)" مازال موجود، ويصدر Word يحتوي صور الصفحات (ليس دائماً ممتاز).
