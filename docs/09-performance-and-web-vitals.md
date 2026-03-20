# الأداء ومقاييس Web Vitals — Phase 5H

## ملخص

---

## تحليل الموارد الحالية

### JavaScript خارجي (يُحمّل في `<head>`)
| المكتبة | الحجم التقريبي | الاستخدام |
|--------|--------------|---------|
| marked.min.js | ~45KB | Markdown parser |
| pdf.js (3.11) | ~300KB | قراءة PDF |
| pdf.worker.min.js | ~800KB | معالج PDF |
| mammoth.browser.min.js | ~360KB | قراءة DOCX |
| tesseract.js (5.1) | ~800KB | OCR |
| html-to-docx | ~200KB | تصدير DOCX |
| google GSI | ~80KB | Google Auth |

**إجمالي JS خارجي:** ~2.5 MB

### CSS
- index.html: ~3100 سطر HTML + CSS مضمّن (inline)
- Google Fonts: Noto Sans Arabic (يُحمّل من Google Fonts CDN)

---

## مقاييس Web Vitals المتوقعة

| المقياس | الوضع الحالي | الهدف | الحالة |
|--------|------------|-------|-------|
| **LCP** (Largest Contentful Paint) | ~2.5-3.5s | < 2.5s | ⚠️ يحتاج تحسين |
| **INP** (Interaction to Next Paint) | ~50-150ms | < 200ms | ✅ جيد |
| **CLS** (Cumulative Layout Shift) | ~0.05 | < 0.1 | ✅ جيد |
| **TTFB** (Time to First Byte) | ~200-400ms | < 800ms | ✅ جيد |

---

## تحسينات الأداء المُطبّقة

### 1. Google Fonts مع `display=swap`
```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;700;900&display=swap" rel="stylesheet" />
```
يمنع FOUT (Flash of Unstyled Text) بينما يحمي من الحجب.

### 2. Preconnect للموارد الخارجية
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

### 3. PWA Service Worker
- التطبيق يدعم Progressive Web App
- Assets تُخزّن locally بعد أول زيارة

---

## توصيات التحسين (مستقبلية)

### عالية الأولوية
1. **Lazy load** مكتبات PDF, DOCX, OCR — تحميلها فقط عند الحاجة:
   ```js
   // عند أول رفع PDF
   const pdfjs = await import('./pdf.min.js');
   ```
2. **Service Worker Caching** — cache جميع الـ JS/CSS/assets بعد أول تحميل
3. **CDN** — استخدام Cloudflare CDN لتسريع تحميل index.html

### متوسطة الأولوية
4. **Tree shaking** — إزالة marked.js وإضافة نسخة minified مخصصة
5. **Critical CSS inlining** — CSS أعلى الصفحة مضمّن (يعمل بالفعل)
6. **Image optimization** — icons webp (يعمل بالفعل)

---

## كيفية متابعة Web Vitals بعد الإطلاق

### 1. Chrome DevTools
```
F12 → Lighthouse → Run audit
```

### 2. PageSpeed Insights
```
https://pagespeed.web.dev/analysis?url=https://app.saddamalkadi.com
```

### 3. Cloudflare Web Analytics
في لوحة تحكم Cloudflare → Website → Speed → Web Vitals

### 4. قياس يدوي
```js
// في Console المتصفح
new PerformanceObserver((list) => {
  list.getEntries().forEach(e => console.log(e.name, e.value));
}).observe({type: 'largest-contentful-paint', buffered: true});
```
