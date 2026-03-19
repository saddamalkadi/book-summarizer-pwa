# تشخيص أخطاء تسجيل الدخول والدردشة الصوتية

**التاريخ:** مارس 2026  
**الإصدار:** v8.43

---

## أولًا: مشكلة تسجيل الدخول (Login)

### السبب الجذري (Root Cause)

عند تحميل التطبيق، تحدث هذه التسلسل:

```
init()
  └─► initializeAuthExperience()
        ├─► loadRemoteAuthConfig()   → GET https://api.saddamalkadi.com/auth/config
        │     └─► HTTP 401 ← المشكلة الأولى
        ├─► verifyStoredAuthSession() → لا جلسة مخزّنة → null
        └─► openAuthGate()           → تظهر شاشة الدخول
```

### المشاكل المحددة

#### 1. خطأ 401 من gateway المصادقة
- **المصدر:** `GET https://api.saddamalkadi.com/auth/config`
- **السبب:** الـ gateway يرفض الطلب (ربما خادم مؤمّن أو يتطلب token)
- **التأثير:** لا يتم تحميل إعدادات المصادقة من الخادم، يُستخدم fallback محلي
- **الخطورة:** عالية — يمنع تهيئة Google Sign-In ومعرفة حالة المصادقة المطلوبة

#### 2. خطأ 403 من مورد ثانوي
- **المصدر:** طلب آخر إلى `https://api.saddamalkadi.com` (على الأرجح `/auth/session`)
- **السبب:** لا توجد جلسة صالحة، الخادم يرفض الطلب بـ 403
- **التأثير:** تُمسح حالة الجلسة المحلية

#### 3. Google Sign-In: الأصل غير مسموح به
- **الخطأ:** `[GSI_LOGGER]: The given origin is not allowed for the given client ID.`
- **السبب:** نطاق Replit (`*.replit.dev`) غير مضاف في إعدادات Google Cloud Console كـ Authorized JavaScript origin
- **التأثير:** زر Google Sign-In لا يعمل إطلاقًا في بيئة Replit
- **الحل المطلوب:** إضافة `https://77f44e08-4d2e-4759-b860-9c5ce5cb9427-00-29uh3q2g4naso.pike.replit.dev` كـ Authorized Origin — أو استخدام نطاق ثابت

#### 4. Google GSI يُهيَّأ عدة مرات
- **الخطأ:** `google.accounts.id.initialize() is called multiple times`
- **السبب:** الدالة `renderGoogleButton()` أو `renderNativeGoogleButton()` تُستدعى أكثر من مرة بدون تتبع الحالة
- **التأثير:** سلوك غير متوقع لزر Google، قد يُعطّل عمله

#### 5. حقول كلمة المرور خارج عنصر `<form>`
- **الخطأ:** `[DOM] Password field is not contained in a form`
- **السبب:** نموذج تسجيل الدخول يُبنى ديناميكيًا داخل `<div>` وليس `<form>`
- **التأثير:** قد يمنع بعض المتصفحات من حفظ كلمة المرور، وقد يُضعف إمكانية الوصول (accessibility)

### تدفق تسجيل الدخول (Login Flow) المفصّل

```
المستخدم يكتب email + name ← يضغط "متابعة بالخطة المجانية"
  └─► submitUnifiedAuthEntry()
        ├─► يتحقق إذا كان البريد هو بريد الإدارة
        │     ├─► [إدارة] POST /auth/login  {email, password}
        │     └─► [عادي]  POST /auth/register {name, email, upgradeCode}
        └─► applyAuthResponse() ← يحفظ sessionToken في localStorage
              └─► closeAuthGate() ← يُغلق شاشة الدخول
```

**المشكلة العملية:**
- عند محاولة `POST /auth/register` على `https://api.saddamalkadi.com/auth/register`، الخادم قد يرفض الطلب إذا كانت سياسة CORS تمنع نطاق Replit، أو إذا كان الخادم لا يقبل تسجيلات جديدة

### ما يعمل حاليًا
- ✅ واجهة نموذج تسجيل الدخول تظهر وتعمل بشكل مرئي
- ✅ التحقق من صحة البريد الإلكتروني يعمل
- ✅ fallback للإعدادات المحلية يعمل عند فشل الخادم
- ✅ حفظ بيانات الجلسة في localStorage يعمل

---

## ثانيًا: مشكلة الدردشة الصوتية (Voice Chat)

### السبب الجذري (Root Cause)

الدردشة الصوتية لها ثلاثة مستويات:

```
1. Cloud Voice (STT + TTS عبر Gateway)
   ← تعتمد على voiceCloudReady=true من /auth/config
   ← معطّلة الآن بسبب خطأ 401 في جلب auth/config

2. Native Speech Recognition (Web Speech API)
   ← تعمل في Chrome/Edge على سطح المكتب
   ← محدودة على iOS Safari
   ← لا تعمل في بعض بيئات الإطارات المضمّنة (iframes)

3. Capacitor Native Plugin (SpeechRecognition)
   ← تعمل فقط على Android/iOS native
   ← غير متاحة على الويب
```

### المشاكل المحددة

#### 1. Cloud Voice معطّلة كليًا
- **السبب:** `voiceCloudReady = false` (القيمة الافتراضية)
- **الشرط لتفعيلها:** يجب أن يُعيد `/auth/config` قيمة `voiceCloudReady: true`
- **الحالة الحالية:** الخادم يُعيد 401، لذا تبقى القيمة `false`
- **التأثير:** زر الميكروفون للتحويل السحابي معطّل

#### 2. زر Voice Mode (🎙️) قد يعمل جزئيًا
- يعتمد على `startComposerDictation()` الذي يجرب:
  1. Cloud transcription → معطّل
  2. Native Capacitor plugin → غير متاح على الويب
  3. Web Speech API → يعمل في Chrome إذا أذن المستخدم
- **التأثير:** قد يعمل في Chrome فقط إذا كان الـ gateway غير متاح

#### 3. مشكلة الأذونات (Permissions)
- `getUserMedia()` يتطلب HTTPS أو localhost
- **الحالة:** التطبيق يعمل على HTTPS في Replit → لا مشكلة هنا
- **لكن:** في iframe، قد يُمنع الوصول للميكروفون

#### 4. Web Speech API في بيئة Replit (iframe)
- التطبيق يُعرض داخل iframe في Replit
- بعض المتصفحات تمنع `getUserMedia` و `SpeechRecognition` في iframes بدون `allow="microphone"`
- **التأثير:** قد لا يعمل الصوت مطلقًا داخل الـ preview بسبب قيود iframe

### حالة كل مكوّن صوتي

| المكوّن | الحالة | السبب |
|--------|--------|-------|
| Cloud STT (Transcription) | ❌ معطّل | `voiceCloudReady=false` بسبب 401 |
| Cloud TTS (Synthesis) | ❌ معطّل | `voiceTtsReady=false` بسبب 401 |
| Web Speech API | ⚠️ جزئي | يعمل في Chrome خارج iframe |
| Native Capacitor Plugin | ❌ على الويب | متاح فقط في Android/iOS native |
| MediaRecorder API | ✅ متاح | لكن بدون Cloud STT لا فائدة منه |

---

## ثالثًا: أخطاء console أخرى

| الخطأ | المصدر | الخطورة |
|-------|--------|---------|
| `401` from gateway | `/auth/config` | عالية |
| `403` from gateway | `/auth/session` | متوسطة |
| `GSI_LOGGER: initialize() called multiple times` | `renderGoogleButton()` | منخفضة |
| `GSI_LOGGER: origin not allowed` | Google OAuth | عالية |
| `Password field not in form` | Auth Gate HTML | منخفضة |

---

## رابعًا: ما يحتاج إلى معلومات من المطوّر

لإصلاح هذه المشاكل بشكل كامل، نحتاج إجابة على:

1. **هل الـ gateway `https://api.saddamalkadi.com` يعمل حاليًا؟** — إذا كان المفروض يعمل، ما سبب 401؟
2. **هل تريد إضافة نطاق Replit لـ Google OAuth؟** — يتطلب الوصول إلى Google Cloud Console
3. **هل هناك `gatewayToken` مطلوب؟** — `DEFAULT_SETTINGS.gatewayToken = ''` فارغ حاليًا
4. **هل `voiceCloudReady` مفعّل على الخادم؟** — إذا نعم، سيعمل تلقائيًا بعد إصلاح 401
5. **هل تريد دعم تسجيل الدخول بدون gateway؟** — يمكن تعديل `authRequired: false` محليًا

---

## خامسًا: الإصلاحات الممكنة بدون الخادم

يمكن تطبيق هذه الإصلاحات فورًا بدون الحاجة لتعديل الـ gateway:

1. **تجنب استدعاء `google.accounts.id.initialize()` أكثر من مرة** — إضافة فحص بسيط
2. **وضع حقول الدخول داخل `<form>`** — يُحسّن UX والـ accessibility
3. **إضافة رسالة واضحة عند فشل الاتصال بالخادم** — بدلًا من الفشل الصامت
4. **تحسين Web Speech API fallback** — جعله الخيار الرئيسي عند غياب Cloud Voice
5. **إضافة `allow="microphone"` للـ iframe** — يحتاج تعديل على مستوى Replit

---

## خلاصة التشخيص

| المشكلة | الخطورة | قابل للإصلاح محليًا؟ |
|---------|---------|---------------------|
| Gateway يُعيد 401 | 🔴 عالية | ❌ يتطلب تعديل في الخادم |
| Google OAuth origin غير مسموح | 🔴 عالية | ❌ يتطلب Google Cloud Console |
| Voice Cloud معطّل | 🔴 عالية | ❌ تابع لإصلاح 401 |
| GSI يتهيأ عدة مرات | 🟡 متوسطة | ✅ نعم |
| حقول كلمة المرور خارج form | 🟢 منخفضة | ✅ نعم |
| Web Speech API في iframe | 🟡 متوسطة | ⚠️ جزئيًا |
