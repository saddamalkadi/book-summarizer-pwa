# دليل النشر — Web Production

**URL**: https://app.saddamalkadi.com  
**الإصدار**: v8.47  
**البنية**: GitHub Pages (Frontend) + Cloudflare Worker (Backend)

---

## النشر التلقائي (الوضع الحالي ✅)

كل push إلى `main` branch يُطلق GitHub Actions التي:
1. تُحدّث `app.saddamalkadi.com` تلقائياً عبر GitHub Pages
2. Worker يُعاد نشره تلقائياً عند start الخادم (server.mjs autoFixWorker)

```
git push origin main  →  GitHub Pages يُحدَّث خلال 30-90 ثانية
```

---

## خطوات النشر النهائي اليدوي

### الخطوة 1: تحقق من الـ Worker

```bash
curl -s https://api.saddamalkadi.com/health | python3 -m json.tool
```

**المتوقع**:
```json
{
  "upstream_configured": true,
  "voice_tts_ready": true,
  "voice_stt_ready": true,
  "session_ready": true,
  "cloud_storage_ready": true,
  "admin_login_ready": true
}
```

### الخطوة 2: تحقق من الـ Frontend

```bash
# تحقق من رأس HTTP الصحيح
curl -I https://app.saddamalkadi.com

# تحقق من Service Worker
curl -s https://app.saddamalkadi.com/sw.js | grep "APP_VERSION"
```

**المتوقع**:
```
HTTP/2 200
content-type: text/html; charset=utf-8
APP_VERSION = "847"
```

### الخطوة 3: تحقق من Chat API

```bash
curl -s -X POST https://api.saddamalkadi.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "مرحبا"}],
    "max_tokens": 50
  }' | python3 -m json.tool
```

**المتوقع**: HTTP 200 + رد من النموذج

### الخطوة 4: تحقق من TTS

```bash
curl -s -X POST https://api.saddamalkadi.com/proxy/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"مرحبا","lang":"ar"}' \
  -o /tmp/test.mp3 \
  -w "Status: %{http_code}, Size: %{size_download} bytes\n"
```

**المتوقع**: `Status: 200, Size: > 5000 bytes`

---

## تحديث الـ Worker يدوياً (إذا احتجت)

الخادم يُجري هذا تلقائياً. لكن يمكنك إجباره:

```bash
# إيقاف الخادم ثم إعادة تشغيله
# (server.mjs يتحقق من الـ health ثم يُصلح تلقائياً)

# أو: استخدم Wrangler مباشرة
wrangler deploy keys-worker.js \
  --name book-summarizer-pwa-convert \
  --compatibility-date 2024-09-23 \
  --var "OPENROUTER_API_KEY:$(echo $OPENROUTER_API_KEY)"
```

---

## التحقق اليدوي بعد النشر

### قائمة التحقق:

```
☐ 1. https://app.saddamalkadi.com يُحمّل بدون خطأ
☐ 2. لا console errors في F12 → Console
☐ 3. /health يُعيد upstream_configured: true
☐ 4. تسجيل الدخول بـ email يعمل
☐ 5. إرسال رسالة دردشة يُعيد ردًّا
☐ 6. TTS يشغّل صوتاً عربياً
☐ 7. رفع ملف PDF يعمل (اختياري)
☐ 8. PWA: Add to Home Screen يعمل (على موبايل)
```

---

## ملفات الـ Web المنشورة

| الملف | الوصف |
|------|------|
| `index.html` | نقطة الدخول الرئيسية |
| `app.js` | Bundle الأساسي (~527KB) |
| `sw.js` | Service Worker (APP_VERSION="847") |
| `manifest.webmanifest` | PWA manifest |
| `auth-bridge.html` | صفحة توسيط OAuth |
| `icons/` | أيقونات التطبيق (WebP + PNG) |
| `CNAME` | app.saddamalkadi.com |

---

## استكشاف الأخطاء

| الخطأ | السبب | الحل |
|------|------|------|
| /health يُعيد upstream_configured: false | Worker key غير محقون | أعد تشغيل server.mjs — autoFixWorker سيُصلح |
| Chat returns 401 | Session منتهية | سجّل خروج + دخول |
| TTS لا يعمل | iOS silent mode | اضغط الصوت يدوياً أولاً |
| "غير متصل" | Service Worker stale | Ctrl+Shift+R (hard refresh) |
| PWA لا يُثبَّت | HTTPS مطلوب | ✅ Cloudflare يوفر HTTPS |

---

## آخر نشر ناجح

```
التاريخ: 20 مارس 2026
الإصدار: v8.47
Cache version: aistudio-cache-v847
Worker version: #373+ (stable)
Health: ✅ جميع الأنظمة خضراء
```
