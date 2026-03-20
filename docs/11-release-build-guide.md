# دليل بناء الإصدار — Phase 5J

## الأنواع الثلاثة للإصدار

| النوع | الأداة | الحالة |
|------|-------|-------|
| Web | Cloudflare Workers + GitHub Pages | ✅ جاهز |
| Android | Capacitor + Gradle | ✅ build-ready |
| iPhone (iOS) | Capacitor + Xcode | ⚠️ يتطلب Mac + Apple Developer Account |

---

## 1. Web Release

### المتطلبات:
- Cloudflare account مع `CF_API_TOKEN` و `CF_ACCOUNT_ID`
- GitHub repository مع `GITHUB_TOKEN`
- Domain: `app.saddamalkadi.com` مُعيّن في Cloudflare DNS

### خطوات النشر:
```bash
# الخادم يُنشر تلقائيًا عند بدء التشغيل
PORT=5000 node server.mjs

# الـ Worker يُعيد نشره تلقائيًا عند بدء server.mjs
# (الكود في server.mjs يفحص worker-fix ويُعيد النشر إذا لزم)
```

### الـ Worker (api.saddamalkadi.com):
- **اسم الـ Worker:** `book-summarizer-pwa-convert`
- **KV Namespace:** `USER_DATA` (ID: `49d87e2d4989452fb3c680ad024ae5b7`)
- **Endpoints:** `/auth`, `/voice/transcribe`, `/voice/speak`, `/model-list`

### GitHub Pages (Frontend):
- Frontend يُنشر على `app.saddamalkadi.com`
- ملف `docs/index.html` هو frontend البديل

---

## 2. Android Release

### المتطلبات:
- Node.js + npm
- Java JDK 17+
- Android Studio (لتوقيع APK)
- Capacitor CLI

### خطوات البناء:
```bash
# 1. تثبيت Capacitor
npm install @capacitor/core @capacitor/android

# 2. بناء Web assets
npm run build  # أو نسخ index.html و app.js

# 3. Sync Capacitor
npx cap sync android

# 4. بناء APK
cd android
./gradlew assembleRelease

# 5. توقيع APK (مطلوب للنشر)
jarsigner -keystore my-release-key.jks \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  alias_name

# 6. Align APK
zipalign -v 4 app-release-unsigned.apk app-release-signed.apk
```

### ملف capacitor.config.json الحالي:
```json
{
  "appId": "com.saddamalkadi.aiworkspace",
  "appName": "AI Workspace Studio",
  "webDir": ".",
  "server": { "url": "https://app.saddamalkadi.com", "cleartext": true }
}
```

### نشر على Google Play:
1. إنشاء حساب Google Play Developer ($25 مرة واحدة)
2. إنشاء Keystore لتوقيع التطبيق
3. رفع AAB (Android App Bundle) بدلاً من APK
4. إعداد صفحة التطبيق مع screenshots

---

## 3. iPhone (iOS) Release

### ⚠️ متطلبات خارجية (لا يمكن الأتمتة الكاملة):
- **Mac** مع macOS 14+ (مطلوب إلزامياً لـ Xcode)
- **Apple Developer Account** ($99/سنة)
- **Xcode 15+** مع iOS 16+ SDK
- **Provisioning Profile** و **Code Signing Certificate**

### خطوات البناء:
```bash
# 1. على Linux/Replit: sync capacitor
npx cap sync ios

# 2. على Mac: فتح Xcode
open ios/App/App.xcworkspace

# 3. في Xcode:
# - اختر Team (Apple Developer Account)
# - اختر Bundle ID: com.saddamalkadi.aiworkspace
# - Build → Archive → Distribute App

# 4. نشر على App Store Connect
# - رفع IPA عبر Xcode أو Transporter
# - إضافة metadata، screenshots، description
# - تقديم للمراجعة (يستغرق 1-3 أيام)
```

### توثيق مهم:
- Apple تفرض مراجعة على كل تحديث
- في-App Purchases يجب استخدام StoreKit (Apple)
- PWA كبديل مؤقت: المستخدم يضيف Safari إلى Home Screen

---

## 4. PWA كبديل (للـ iOS بدون App Store)

المستخدمون على iPhone يمكنهم:
1. فتح `https://app.saddamalkadi.com` في Safari
2. Share → Add to Home Screen
3. يظهر التطبيق كـ app مستقل

**ملفات PWA المطلوبة (موجودة):**
- `manifest.webmanifest`
- `icons/icon-192.webp`, `icon-512.webp`
- Service Worker (مطلوب للـ offline)
