# GitHub Pages نشر تلقائي (GitHub Actions)

هذا الباكج يضيف نشر تلقائي لمستودع:
- **User:** `saddamalkadi`
- **Repo:** `book-summarizer-pwa`
- **الرابط المتوقع:** `https://saddamalkadi.github.io/book-summarizer-pwa/`

## 1) انسخ الملفات إلى جذر المستودع
انسخ العناصر التالية إلى **جذر** المستودع `book-summarizer-pwa`:
- `.github/workflows/pages.yml`
- `.nojekyll`

> ملاحظة: اترك ملفات تطبيقك (index.html, app.js, sw.js, manifest...) في الجذر كذلك.

## 2) فعّل GitHub Pages عبر Actions
1) افتح المستودع على GitHub
2) **Settings → Pages**
3) تحت **Build and deployment**
   - **Source:** اختر **GitHub Actions**

## 3) ارفع/حدّث ملفات التطبيق
- إما **Add file → Upload files** من واجهة GitHub
- أو عبر `git push`

## 4) أول نشر
بعد أول `push` على `main`:
- اذهب إلى **Actions** وشاهد Workflow باسم **Deploy to GitHub Pages**
- بعد نجاحه، افتح الرابط: `https://saddamalkadi.github.io/book-summarizer-pwa/`

## حل مشاكل الكاش (PWA / Service Worker)
لو التطبيق ما يتحدّث بعد النشر:
- زِد رقم نسخة الكاش في `sw.js` (مثلاً CACHE_NAME)
- أو غيّر الاستدعاء في HTML مثل `app.js?v=62` و `sw.js?v=62`
- أو على الجوال: احذف الـPWA وأعد تثبيته مرة واحدة.

## تحقق سريع
- يجب أن يكون `index.html` في الجذر
- تأكد أن المسارات داخل HTML نسبية مثل `./app.js` وليس `/app.js`
