# Mobile Device Validation — v8.47

**Date**: March 2026  
**Status**: ⏳ يتطلب اختباراً يدوياً على أجهزة فعلية  
**Production URL**: https://app.saddamalkadi.com

---

## الأجهزة المستهدفة للاختبار

| الجهاز | المتصفح | الأولوية |
|--------|---------|---------|
| Android (Chrome حديث) | Chrome 120+ | عالية |
| iPhone (iOS 16+) | Safari | عالية |
| Android (Samsung Internet) | Samsung Browser | متوسطة |
| iPad | Safari | متوسطة |

---

## قائمة الاختبار — Android Chrome

### التنقل (Navigation)
- [ ] Sidebar يفتح/يغلق بسلاسة عبر الزر أو Swipe
- [ ] التنقل بين التبويبات (دردشة، ملفات، مشاريع، أدوات، إعدادات)
- [ ] الـ back button ينظّم التنقل داخل التطبيق
- [ ] لا يوجد overflow أفقي غير مقصود

### اللمس والتفاعل
- [ ] الأزرار في chatbar: touch target > 42px × 42px
- [ ] بطاقات الاستخدام (use-case cards): استجابة فورية
- [ ] الـ dropdown lists (model, provider): تعمل بشكل صحيح
- [ ] الـ checkboxes: سهلة اللمس (> 44px area)
- [ ] Scroll في chatlog: سلس (momentum scrolling)

### لوحة المفاتيح
- [ ] فتح لوحة المفاتيح لا يُخفي حقل الإدخال
- [ ] chatbar يرتفع مع لوحة المفاتيح (`--app-vh` var)
- [ ] إغلاق لوحة المفاتيح يعيد الـ layout للوضع الطبيعي
- [ ] Dir="auto" يتعرف على Arabic RTL و English LTR

### الأداء والاستجابة
- [ ] أول تحميل للصفحة < 5 ثوانٍ (3G)
- [ ] Service Worker يعمل (offline shell محفوظ)
- [ ] لا يوجد jank ملحوظ أثناء scroll الردود الطويلة
- [ ] الصور والأيقونات محسّنة

### الصوت والميكروفون
- [ ] طلب صلاحية الميكروفون يظهر بشكل صحيح
- [ ] TTS يشغّل الصوت (Audio API)
- [ ] لا يوجد conflict مع Silent Mode (يُحذّر المستخدم)

### PWA Installation
- [ ] يظهر "Add to Home Screen" prompt أو banner
- [ ] الأيقونة تظهر بشكل صحيح على الـ home screen
- [ ] Splash screen يعمل
- [ ] التطبيق يفتح في standalone mode (بدون browser chrome)

---

## قائمة الاختبار — iPhone Safari (iOS 16+)

### التنقل
- [ ] Sidebar يفتح/يغلق (Safari لا يدعم Swipe gestures بنفس الطريقة)
- [ ] التنقل بين التبويبات
- [ ] Safe Area (الـ notch والـ home indicator) لا يتداخل مع المحتوى
- [ ] Viewport height صحيح (`--app-vh` var تعمل مع iOS)

### اللمس والتفاعل
- [ ] Tap accuracy على الأزرار الصغيرة
- [ ] 300ms tap delay (يجب إلغاؤه عبر `touch-action: manipulation`)
- [ ] Long press لا يفتح context menu غير مرغوب فيه

### لوحة المفاتيح (iOS)
- [ ] لوحة مفاتيح iOS لا تُخفي حقل الإدخال (مشكلة شائعة)
- [ ] Visual Viewport API تعمل لقياس الارتفاع الحقيقي
- [ ] إغلاق لوحة المفاتيح عبر Done أو Swipe

### الصوت (Safari restrictions)
- [ ] Safari يتطلب user gesture لتشغيل الصوت — اختبر بكليك قبل TTS
- [ ] `getUserMedia()` للميكروفون يعمل (يحتاج HTTPS ✅)
- [ ] AudioContext يعمل بعد الـ gesture

### PWA Installation (iOS)
- [ ] "Add to Safari → Home Screen" يعمل
- [ ] Manifest يُحمّل بشكل صحيح (apple-touch-icon, etc.)
- [ ] Standalone mode يعمل (بدون Safari address bar)

---

## المشكلات الشائعة المتوقعة وحلولها

| المشكلة | السبب | الحل |
|---------|--------|-------|
| Viewport height خاطئ على iOS | iOS Safari يتغير ارتفاعه مع scroll | `--app-vh` var يُحدّث عبر visualViewport API ✅ |
| Audio لا يعمل على iOS | Safari يتطلب user gesture | TTS يُشغّل فقط بعد tap event ✅ |
| Keyboard يُخفي chatbar | iOS mobile keyboard issue | Visual Viewport + CSS `--app-vh` ✅ |
| PWA لا تظهر كـ standalone | Manifest غير صحيح | manifest.webmanifest مُعدّ ✅ |
| Tap targets صغيرة | < 44px | CSS min-height: 42px ✅ |

---

## نتائج الاختبار الفعلي

| الجهاز | النتيجة | التاريخ | الملاحظات |
|--------|---------|---------|-----------|
| Android Chrome | ⏳ معلق | — | يحتاج اختبار فعلي |
| iPhone Safari | ⏳ معلق | — | يحتاج اختبار فعلي |
| iPad Safari | ⏳ معلق | — | يحتاج اختبار فعلي |

---

## إجراءات الاختبار

1. افتح https://app.saddamalkadi.com على الجهاز
2. سجّل الدخول بـ Email أو Google
3. اختبر إرسال رسالة قصيرة
4. اختبر رفع ملف PDF صغير
5. اختبر Voice TTS (اطلب من الذكاء الاصطناعي أن يتكلم)
6. جرّب التثبيت كـ PWA (Add to Home Screen)
7. افتح التطبيق من الـ Home Screen وتأكد من الـ standalone mode
