# جاهزية الصوت للإطلاق — Phase 5F

## ملخص النظام الصوتي

التطبيق يدعم نظام صوت متكامل (STT + TTS) بطبقات متعددة:

---

## Architecture الصوت

```
المستخدم يضغط المايك
       ↓
startComposerDictation()
       ↓
┌─────────────────────────────┐
│ 1. Capacitor SpeechRecognition (native) │
│ 2. Web Speech API (web)                 │
│ 3. MediaRecorder → Cloud Whisper        │
└─────────────────────────────┘
       ↓
نص → chatInput → إرسال تلقائي
       ↓
AI response → speakAssistantReply()
       ↓
┌─────────────────────────────┐
│ 1. Proxy TTS (Arabic MeloTTS)     │
│ 2. Cloud TTS (OpenAI tts-1)       │
│ 3. Native device TTS (fallback)   │
└─────────────────────────────┘
```

---

## حالات UI للصوت (States)

| الحالة | المؤشر البصري | الآلية |
|-------|--------------|--------|
| **Idle** | زر مايك عادي | `syncVoiceInputButton()` |
| **Listening** | زر أحمر + animation pulse + "الإملاء الصوتي يعمل..." | `data-state="listening"` + CSS animation |
| **Processing** | زر برتقالي + animation | `data-state="processing"` |
| **Speaking** | `VOICE_RUNTIME.speaking = true` | audio.onended |
| **Error** | toast message | `onerror` → `toast()` |

*في Phase 5: أُضيف CSS لـ voice pulse animation وألوان الحالات.*

---

## اختبارات مطلوبة قبل الإطلاق

### الجوال (Android/iPhone):
- [ ] طلب صلاحية المايك → يظهر dialog واضح
- [ ] الضغط على المايك → يبدأ الاستماع
- [ ] التوقف عن الكلام → يُرسل تلقائيًا
- [ ] error handling عند رفض الصلاحية
- [ ] TTS يُشغّل الرد باللغة العربية

### المتصفح (Web):
- [ ] Web Speech API في Chrome/Edge
- [ ] Fallback إلى Cloud Whisper عند الفشل
- [ ] Arabic TTS via Cloudflare Workers AI

---

## مشاكل معروفة وحلول

| المشكلة | السبب | الحل |
|--------|-------|------|
| TTS لا يعمل في Safari iOS | Safari يمنع تشغيل Audio بدون user gesture | `new Audio()` داخل click handler |
| STT لا يعمل في Firefox | Firefox لا يدعم Web Speech API | Fallback إلى Cloud Whisper |
| تأخير في TTS العربية | Cloudflare Workers AI قد يكون بطيئًا | إضافة loading state واضح |
| انقطاع الـ voice mode loop | خطأ في `scheduleVoiceConversationRestart()` | يُعيد المحاولة بعد 2 ثانية |

---

## توصيات الإطلاق

1. اختبار Arabic TTS مع الموديل `@cf/myshell-ai/melotts` في بيئة الإنتاج
2. إضافة مؤشر تحميل أوضح خلال فترة معالجة الصوت (Cloud Whisper)
3. اختبار على iPhone 14+ مع Safari 17
4. التأكد من أن voice mode لا يبدأ تلقائيًا دون إذن المستخدم
