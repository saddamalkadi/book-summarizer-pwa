# التدقيق الأساسي للمشروع (Baseline Audit)

**التاريخ:** مارس 2026  
**الإصدار:** v8.43  
**المُدقِّق:** Replit Agent

---

## 1. نظرة عامة على المشروع

**الاسم:** AI Workspace Studio  
**الوصف:** منصة عربية للذكاء الاصطناعي تعمل كـ PWA وتدعم Android وiOS عبر Capacitor.  
**المطوّر:** صدام القاضي  
**معرّف التطبيق:** `com.saddamalkadi.aiworkspace`

---

## 2. بنية الملفات الرئيسية

```
/
├── index.html              # نقطة الدخول الرئيسية (2,451 سطر) - يحتوي على HTML + CSS + بعض JS
├── app.js                  # الكود الرئيسي للتطبيق (11,205 سطر) - IIFE واحدة كبيرة
├── server.mjs              # خادم Node.js بسيط لخدمة الملفات الثابتة
├── sw.js                   # Service Worker لدعم PWA والعمل بدون اتصال
├── auth-bridge.html        # صفحة وسيطة لمصادقة Google عبر المتصفح
├── convert-worker.js       # Web Worker لتحويل الملفات (PDF→DOCX وغيره)
├── keys-worker.js          # Web Worker لإدارة المفاتيح والتشفير
├── manifest.webmanifest    # ملف PWA manifest
├── capacitor.config.json   # إعدادات Capacitor للتطبيقات الأصلية
├── package.json            # تبعيات Capacitor فقط (لا build step)
├── package-lock.json
├── codemagic.yaml          # إعدادات CI/CD لبناء Android/iOS
├── wrangler.jsonc          # إعدادات Cloudflare Worker (gateway رئيسي)
├── wrangler.convert.jsonc  # إعدادات Cloudflare Worker (خدمة التحويل)
├── GUIDE.ar.md             # دليل الاستخدام بالعربية
├── android/                # مشروع Android الأصلي (Gradle)
├── ios/                    # مشروع iOS الأصلي (Xcode)
├── assets/                 # ملفات ثابتة (logo.svg فقط حاليًا)
├── icons/                  # أيقونات التطبيق
├── downloads/              # ملفات APK/AAB جاهزة للتوزيع
└── scripts/                # سكريبتات المساعدة (sync-web.mjs, prepare_ios_cloud_build.py)
```

---

## 3. نمط البناء المعتمد

| العنصر | التفاصيل |
|--------|---------|
| **نوع المشروع** | Static SPA (تطبيق صفحة واحدة ثابت) |
| **نظام البناء** | لا يوجد - ملفات JavaScript/HTML/CSS خام بدون bundler |
| **مدير الحزم** | npm (للتبعيات الأصلية فقط - Capacitor) |
| **نقطة الدخول الويب** | `index.html` |
| **الكود الرئيسي** | `app.js` - IIFE واحدة تضم كل منطق التطبيق |
| **الخادم المحلي** | `server.mjs` - خادم HTTP بسيط مبني على Node.js |
| **المنفذ** | 5000 (Replit) |
| **الـ Host** | 0.0.0.0 (مناسب لـ Replit) |

---

## 4. المكتبات الخارجية (CDN)

| المكتبة | الإصدار | الغرض |
|--------|---------|-------|
| `marked` | آخر إصدار | تحويل Markdown إلى HTML |
| `pdf.js` | 3.11.174 | قراءة ملفات PDF |
| `mammoth` | 1.9.0 | قراءة ملفات DOCX |
| `tesseract.js` | 5.1.1 | تقنية OCR لاستخراج النصوص من الصور |
| `@turbodocx/html-to-docx` | 1.20.1 | تصدير المحتوى كملف DOCX |
| Google GSI Client | - | مصادقة Google |

---

## 5. الخدمات الخلفية (Backend Services)

التطبيق يعتمد على **Cloudflare Workers** كـ gateway رئيسي:

| الخدمة | الـ URL | الغرض |
|--------|--------|-------|
| **Gateway الرئيسي** | `https://api.saddamalkadi.com` | المصادقة + AI APIs |
| **خدمة التحويل** | `https://api.saddamalkadi.com/convert/...` | تحويل PDF↔DOCX |
| **خدمة OCR** | `https://api.saddamalkadi.com/ocr` | استخراج النص من الصور |
| **الصوت (STT)** | `https://api.saddamalkadi.com/voice/transcribe` | تحويل الصوت إلى نص |
| **الصوت (TTS)** | `https://api.saddamalkadi.com/voice/speak` | تحويل النص إلى صوت |
| **OpenRouter** | `https://openrouter.ai/api/v1` | نماذج AI (افتراضي) |

---

## 6. نموذج المصادقة

نظام مزدوج:
- **وضع Gateway** (`authMode: 'gateway'`): يعتمد على `https://api.saddamalkadi.com` لإدارة الجلسات  
- **وضع المتصفح** (`authMode: 'browser'`): API key مباشر بدون خادم

الوضع الافتراضي هو **gateway** مع الـ URL الثابت: `https://api.saddamalkadi.com`

---

## 7. صفحات/أقسام التطبيق

| المعرف | الاسم |
|--------|-------|
| `chat` | الدردشة الرئيسية |
| `kb` | قاعدة المعرفة (RAG) |
| `files` | إدارة الملفات |
| `canvas` | اللوحة التفاعلية |
| `workflows` | سير العمل |
| `downloads` | التحميلات والتصدير |
| `projects` | المشاريع |
| `settings` | الإعدادات |
| `guide` | دليل الاستخدام |

---

## 8. وضع التشغيل في Replit

- **الأمر:** `PORT=5000 node server.mjs`
- **الحالة الحالية:** يعمل بنجاح على منفذ 5000
- **عرض الملفات:** يخدم جميع الملفات الثابتة من مجلد العمل
- **SPA Fallback:** أي مسار غير معروف يُعيد `index.html`

---

## 9. حالة Android/iOS

| العنصر | الحالة |
|--------|--------|
| **Android** | مشروع Gradle جاهز + ملفات APK/AAB موجودة في `downloads/` |
| **iOS** | مشروع Xcode موجود في `ios/` |
| **Capacitor** | الإصدار 7.x |
| **webDir** | `www` (يتطلب `sync-web.mjs` لنسخ الملفات) |
| **آخر بناء Android** | v8.43 |

---

## 10. ملاحظات حرجة من الفحص الأولي

1. ✅ الخادم يعمل على منفذ 5000 بشكل سليم
2. ⚠️ **بوابة المصادقة تظهر فورًا** عند تحميل التطبيق (متوقع عند عدم وجود جلسة)
3. ❌ **خطأ 401** من `https://api.saddamalkadi.com/auth/config` - انظر `02-bug-diagnosis-login-voice.md`
4. ❌ **خطأ 403** من مورد آخر على نفس الخادم
5. ⚠️ **Google GSI يتهيأ عدة مرات** (`initialize() called multiple times`)
6. ❌ **أصل Replit غير مسموح به** في Google OAuth Client ID
7. ⚠️ حقول كلمة المرور ليست داخل عنصر `<form>` (تحذيرات المتصفح)
8. ✅ PWA manifest موجود وصحيح
9. ✅ Service Worker موجود
10. ✅ RTL و Arabic fonts تعمل بشكل صحيح
