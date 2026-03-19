# تشخيص أخطاء تسجيل الدخول والدردشة الصوتية

**التاريخ:** مارس 2026  
**الإصدار:** v8.45

---

## الحالة العامة (مُحدَّث)

| الميزة | الحالة | ملاحظات |
|--------|--------|---------|
| تسجيل الدخول (بريد إلكتروني) | ✅ يعمل | gateway متاح |
| تسجيل الدخول (Google) | ❌ في Replit | ✅ يعمل على `app.saddamalkadi.com` |
| الدردشة النصية | ✅ يعمل | OpenRouter عبر gateway |
| الدردشة الصوتية (TTS عربي) | ✅ يعمل | مؤكد من المستخدم |
| STT (تحويل صوت→نص) | ✅ يعمل | Workers AI |

---

## أولاً: تسجيل الدخول (Login)

### تدفق تسجيل الدخول

```
المستخدم → يُدخل الاسم + البريد → يضغط "متابعة"
  └─► submitUnifiedAuthEntry()
        ├─► [بريد إدارة] POST /auth/login  {email, password}
        └─► [بريد عادي]  POST /auth/register {name, email}
              └─► applyAuthResponse() → يحفظ sessionToken
                    └─► closeAuthGate() → يفتح التطبيق
```

### المشاكل الموجودة

#### 1. Google OAuth لا يعمل في Replit
- **السبب:** نطاق `*.replit.dev` غير مضاف في Google Cloud Console
- **التأثير:** محدود — لأن التطبيق الفعلي يعمل على `app.saddamalkadi.com` حيث Google يعمل
- **الإصلاح في Replit:** غير ضروري (بيئة تطوير فقط)

#### 2. Google GSI يُهيَّأ عدة مرات
- **الخطأ:** `google.accounts.id.initialize() is called multiple times`
- **السبب:** `renderGoogleButton()` تُستدعى عند كل تحديث للواجهة
- **الإصلاح:** إضافة فحص `window._gsiInitialized` قبل الاستدعاء

#### 3. حقول كلمة المرور خارج `<form>`
- **الخطأ:** `Password field is not contained in a form`
- **التأثير:** تحذيرات فقط — المتصفح لا يحفظ كلمة المرور تلقائيًا
- **الإصلاح:** تغليف الحقول في `<form>` مع `onsubmit="return false"`

#### 4. upstream_configured: false (عند التشغيل)
- **السبب:** مفتاح OpenRouter غير مخزّن في KV بعد
- **الإصلاح:** نظام auto-fix في `server.mjs` يُعالجه تلقائيًا عند كل بدء تشغيل

---

## ثانياً: الدردشة الصوتية (Voice Chat)

### البنية الحالية (v8.45)

```
speakAssistantReply(text)
  ├─► [أولاً]  speakAssistantReplyByProxyTts()  → POST /proxy/tts (Google TTS مجاني)
  ├─► [ثانياً] speakAssistantReplyByCloud()     → POST /voice/speak (Workers AI)
  └─► [أخيراً] Web Speech API                  → المتصفح (Chrome فقط)
```

### حالة كل مكوّن

| المكوّن | الحالة | المسار |
|--------|--------|-------|
| Google TTS Proxy | ✅ يعمل | `/proxy/tts` (server.mjs) |
| Cloud TTS (Workers AI) | ✅ جاهز | `/voice/speak` (gateway) |
| Web Speech API | ⚠️ Chrome فقط | متصفح مباشرة |
| Capacitor Native STT | ✅ Android/iOS | plugin أصلي |

### مشاكل بيئة Replit للصوت

| المشكلة | السبب | التأثير |
|--------|-------|--------|
| iframe يمنع الميكروفون | قيود المتصفح | لا يعمل داخل preview |
| `lsof` غير موجود | بيئة NixOS | لا يؤثر على الوظائف |

> **ملاحظة مهمة:** الدردشة الصوتية العربية تعمل بشكل كامل على `app.saddamalkadi.com` وعلى نسخة Android. مشاكل الميكروفون تظهر فقط داخل iframe الـ preview في Replit.

---

## ثالثاً: المشاكل الحرجة المُكتشفة (v8.45)

### 🔴 حلقة لا نهائية في server.mjs

**المشكلة:**
```js
// كود خاطئ:
setTimeout(() => { _portRetries = 0; server.listen(PORT, HOST); }, 3000);
//                  ^^^^^^^^^^^^^^^^ يُعيد العداد لصفر → الحلقة لا تنتهي
```

**الإصلاح (تم في v8.45):**
```js
// كود صحيح:
setTimeout(() => server.listen(PORT, HOST), 2000);
// + استخدام pkill بدلاً من lsof
```

**الأثر:** السيرفر كان عالقًا في حلقة إعادة محاولة بدون نهاية.

---

## رابعاً: ما لا يزال يحتاج إصلاحاً

| المشكلة | الأولوية | الجهد |
|--------|---------|-------|
| Google GSI يُهيَّأ عدة مرات | متوسطة | منخفض |
| حقول كلمة المرور خارج `<form>` | متوسطة | منخفض |
| `ADMIN_PASSWORD_REAL` غير موجود كـ env var | متوسطة | منخفض |
| Responsive design على الشاشات الصغيرة | متوسطة | متوسط |

---

## خامساً: بيانات الاعتماد والإعدادات المهمة

| العنصر | القيمة |
|--------|-------|
| Admin Email | `tntntt830@gmail.com` |
| Admin Password (مكتوب في الكود) | `Saddam@Admin2026!` |
| Cloudflare Account ID | `ea4e90ec8fbd70faefdddd2153064d6f` |
| KV Namespace ID | `49d87e2d4989452fb3c680ad024ae5b7` |
| Worker Name | `book-summarizer-pwa-convert` |
| Google Client ID | `320883717933-d8p8877if6u4udo9tfvhbq1en2ps486m.apps.googleusercontent.com` |

> ⚠️ **تحذير أمني:** كلمة مرور الإدارة مكتوبة مباشرةً في `server.mjs`. يُنصح بنقلها لـ Secret `ADMIN_PASSWORD_REAL` في مرحلة النشر.
