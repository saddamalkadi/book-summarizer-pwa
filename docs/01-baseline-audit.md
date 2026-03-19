# التدقيق الأساسي للمشروع (Baseline Audit)

**التاريخ:** مارس 2026  
**الإصدار:** v8.45  
**المُدقِّق:** Replit Agent

---

## 1. نظرة عامة على المشروع

**الاسم:** AI Workspace Studio  
**الوصف:** منصة عربية للذكاء الاصطناعي تعمل كـ PWA وتدعم Android وiOS عبر Capacitor.  
**المطوّر:** صدام القاضي  
**معرّف التطبيق:** `com.saddamalkadi.aiworkspace`  
**Frontend:** GitHub Pages — `app.saddamalkadi.com`  
**Backend:** Cloudflare Worker — `api.saddamalkadi.com`  

---

## 2. بنية الملفات الرئيسية

```
/
├── index.html              # نقطة الدخول (2,565 سطر) — HTML + CSS كامل
├── app.js                  # كود التطبيق (11,366 سطر) — IIFE واحدة
├── server.mjs              # خادم Node.js لـ Replit (تطوير فقط)
├── sw.js                   # Service Worker للـ PWA
├── auth-bridge.html        # صفحة وسيطة لـ Google OAuth
├── convert-worker.js       # Web Worker لتحويل الملفات
├── keys-worker.js          # كود Cloudflare Worker (المنشور على api.saddamalkadi.com)
├── manifest.webmanifest    # ملف PWA
├── capacitor.config.json   # إعدادات Capacitor
├── package.json            # تبعيات Capacitor
├── codemagic.yaml          # CI/CD لـ Android/iOS
├── wrangler.jsonc          # إعدادات Cloudflare Worker الرئيسي
├── wrangler.convert.jsonc  # إعدادات Worker الخاص بالتحويل
├── android/                # مشروع Android (Gradle)
├── ios/                    # مشروع iOS (Xcode)
├── downloads/              # APK/AAB جاهزة للتوزيع
├── docs/                   # توثيق المشروع
└── scripts/                # سكريبتات مساعدة
```

---

## 3. نمط البناء المعتمد

| العنصر | التفاصيل |
|--------|---------|
| نوع المشروع | Static SPA — صفحة واحدة |
| نظام البناء | لا يوجد bundler — ملفات خام |
| الخادم المحلي | `server.mjs` على منفذ 5000 |
| الـ Gateway | Cloudflare Worker على `api.saddamalkadi.com` |
| GitHub Pages | `app.saddamalkadi.com` (Frontend) |

---

## 4. المكتبات الخارجية (CDN)

| المكتبة | الغرض |
|--------|-------|
| `marked` | تحويل Markdown |
| `pdf.js` 3.11.174 | قراءة PDF |
| `mammoth` 1.9.0 | قراءة DOCX |
| `tesseract.js` 5.1.1 | OCR |
| `@turbodocx/html-to-docx` 1.20.1 | تصدير DOCX |
| Google GSI Client | مصادقة Google |

---

## 5. الخدمات الخلفية (Backend)

| الخدمة | الـ URL | الحالة |
|--------|--------|--------|
| Gateway الرئيسي | `https://api.saddamalkadi.com` | ✅ يعمل |
| المصادقة | `/auth/login`, `/auth/register` | ✅ يعمل |
| دردشة AI | `/v1/chat/completions` | ✅ OpenRouter |
| الصوت STT | `/voice/transcribe` | ✅ Workers AI |
| الصوت TTS | `/voice/speak` | ✅ Workers AI |
| TTS مجاني | `/proxy/tts` | ✅ Google TTS |
| تحويل الملفات | `/convert/*` | ✅ يعمل |
| OCR | `/ocr` | ✅ يعمل |

---

## 6. حالة Gateway الحية (من فحص مارس 2026)

```json
{
  "ok": true,
  "ready": true,
  "upstream_configured": false,   ← OpenRouter key في KV (يُصلحه auto-fix)
  "auth_required": true,
  "voice_cloud_ready": true,      ← الصوت السحابي جاهز
  "voice_stt_ready": true,
  "voice_tts_ready": true,
  "admin_password_ready": false,  ← يُصلحه auto-fix عند كل تشغيل
  "google_client_configured": true
}
```

> ملاحظة: `upstream_configured: false` و `admin_password_ready: false` يُصلحهما نظام auto-fix في `server.mjs` تلقائيًا عند كل إعادة تشغيل.

---

## 7. وضع التشغيل في Replit

- **الأمر:** `PORT=5000 node server.mjs`
- **المنفذ:** 5000
- **Auto-fix:** يعمل عند كل تشغيل — يخزن المفاتيح في KV ويُعيد نشر الـ Worker إذا لزم

---

## 8. المتغيرات البيئية المطلوبة

| المتغير | الغرض | الحالة |
|--------|-------|--------|
| `CF_API_TOKEN` | Cloudflare API للنشر | ✅ موجود |
| `OPENROUTER_API_KEY` | مفتاح OpenRouter | ✅ موجود |
| `GITHUB_TOKEN` | رفع الكود للـ GitHub Pages | ✅ موجود |
| `ADMIN_PASSWORD_REAL` | كلمة مرور الإدارة | ❌ غير موجود |
| `CF_ACCOUNT_ID` | معرّف حساب Cloudflare | ❌ غير موجود (مكتوب في الكود) |

---

## 9. حالة Android/iOS

| العنصر | الحالة |
|--------|--------|
| Android (APK/AAB) | ✅ v8.44 جاهز في `downloads/` |
| iOS (Xcode) | ⚠️ يتطلب macOS/Xcode |
| Capacitor | الإصدار 7.x |
| webDir | `www` (عبر `sync-web.mjs`) |

---

## 10. ملاحظات حرجة (مارس 2026)

1. ✅ Gateway يعمل على `api.saddamalkadi.com`
2. ✅ الدردشة النصية تعمل
3. ✅ الدردشة الصوتية العربية تعمل (مؤكد من المستخدم)
4. ✅ TTS مجاني عبر `/proxy/tts` (Google TTS)
5. ⚠️ **حلقة لا نهائية في server.mjs** — تم الإصلاح في v8.45
6. ⚠️ Google OAuth لا يعمل في بيئة Replit (نطاق غير مسموح)
7. ⚠️ حقول كلمة المرور خارج `<form>` (تحذيرات المتصفح)
8. ✅ PWA manifest صحيح
9. ✅ Service Worker يعمل
10. ✅ RTL والعربية تعملان بشكل ممتاز
