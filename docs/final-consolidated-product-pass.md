# Final consolidated product pass — v8.61.0

Single high-impact iteration from v8.60.x baseline: voice pacing, reading mode, honest task-execution foundation, home dashboard tiles, login cleanup, version + sync alignment.

## Scope summary

| Area | Implementation |
|------|----------------|
| Voice | Cloud silence-based end + longer caps; shared auto-send delay; Web Speech end grace; see `voice-end-of-speech-tuning.md` |
| Reading mode | Toggle + FAB + Escape; CSS hides chrome on `body.chat-reading-mode`; see `reading-mode-and-toolbar-hide.md` |
| Agent | No fake autonomy; `task_exec_honest` + toolbar strip; see `agent-mode-feasibility-and-foundation.md` |
| Dashboard | «انتقال سريع» tile grid on home; see `dashboard-selection-redesign.md` |
| Login | `auth-gate--v2` slimmer copy; see `login-screen-professional-redesign.md` |
| Parity | `npm run cap:sync`; see `final-web-apk-parity-proof.md` |

## Related docs

- `docs/voice-end-of-speech-tuning.md`
- `docs/reading-mode-and-toolbar-hide.md`
- `docs/agent-mode-feasibility-and-foundation.md`
- `docs/dashboard-selection-redesign.md`
- `docs/login-screen-professional-redesign.md`
- `docs/final-web-apk-parity-proof.md`

---

## التقرير النهائي (عربي فقط)

### 1) ما الذي تغيّر في سلوك نهاية الكلام والإرسال الصوتي؟

- **الإملاء السحابي:** لم يعد الاعتماد على زمن ثابت قصير فقط؛ يُراعى **صمتًا أطول (~1.5 ثانية)** بعد أن يُسمع كلام فعلي قبل إيقاف التسجيل، مع **حد أقصى أطول** للمقطع. بعد التفريغ، أصبح هناك **تأخير أوضح قبل الإرسال التلقائي** (~480 مللي) ليعطي الواجهة وقتًا لاستقرار النص.
- **المتصفح (Web Speech):** بعد انتهاء المحرك (`onend`) أصبح الإرسال التلقائي يُؤجَّل **~1.2 ثانية** لتقليل الإرسال أثناء توقّف قصير داخل الجملة.
- **الأصلي (Android عبر الإضافة):** نفس تأخير **ما بعد النص** تقريبًا كالسحابة بدل ~90 مللي.

### 2) كيف يعمل وضع القراءة؟

- من شريط الإجراءات السريعة في الدردشة: زر **«قراءة»** يخفي الشريط العلوي، شريط الإجراءات، أدوات الدردشة، والمدخل والشرائح لزيادة مساحة القراءة.
- **زر عائم «✕ واجهة»** أو مفتاح **Escape** يعيد كل الواجهة.
- الإعداد يُحفظ **محليًا على الجهاز** (لا يُزامَن بين أجهزة).

### 3) ماذا يمكن تنفيذه «وكيلًا» بصدق اليوم؟

- التطبيق **ليس** وكيل تحكم حقيقي بالمتصفح أو الجهاز مثل وكيل ChatGPT الكامل.
- **الأساس الواقعي:** قالب **`task_exec_honest`** يفرض توضيح **ما يُنفَّذ داخل المحادثة** مقابل **ما يحتاج خطوة خارجية**، وشريط أزرار في أعلى أدوات الدردشة يجهّز مسارات جاهزة (لوحة مهام، معرفة، تحليل) عبر `applyQuickPrompt` — هذا **تنظيم مهام وصريح** وليس استقلالًا آليًا.

### 4) كيف تُحسِّن لوحة الرئيسة (الداشبورد)؟

- إضافة قسم **«انتقال سريع»** ببطاقات/بلاطات تفتح الصفحات مباشرة (دردشة، ملفات، لوحة، معرفة، تفريغ، إعدادات) **دون أوامر نصية**.

### 5) كيف تُحسِّن شاشة الدخول؟

- قالب أخف (`auth-gate--v2`) مع **عناوين أقصر** ونصوص أقل، مع الإبقاء على نفس الحقول ومسار Google والإدارة وكلمة المرور حسب البريد.

### 6) هل الويب والـ APK متطابقان الآن؟

- **نعم من ناحية الحزمة:** `npm run cap:sync` ينسخ نفس `index.html` و`app.js` إلى أصول أندرويد ضمن `android/app/src/main/assets/public/`. أي سلوك في الويب يظهر في الـ APK بعد المزامنة والبناء.

### 7) مسار مخرجات الـ APK بالضبط

- بعد بناء Debug ناجح:  
  `android/app/build/outputs/apk/debug/app-debug.apk`  
- إصدار موقّع (إن وُجدت إعدادات التوقيع):  
  `android/app/build/outputs/apk/release/app-release.apk`  
- **ملاحظة البيئة الحالية:** فشل البناء هنا بسبب **`JAVA_HOME` غير صالح**؛ يجب ضبط JDK ثم تشغيل `.\gradlew.bat assembleDebug` داخل `android`.

### 8) رقم الإصدار الجديد

- **8.61.0** (رمز أندرويد **861**، تسمية الويب **v8.61**).
