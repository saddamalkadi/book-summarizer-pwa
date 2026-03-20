# دليل بناء Android — AI Workspace Studio v8.47

**App ID**: `com.saddamalkadi.aiworkspace`  
**Version Code**: 847 | **Version Name**: 8.47.0  
**Min SDK**: 24 (Android 7.0) | **Target SDK**: 35 (Android 15)  
**Build System**: Gradle + Capacitor 7  

---

## الحالة الراهنة

| المكوّن | الحالة |
|--------|-------|
| Android project structure | ✅ جاهز (android/) |
| Web assets في android/app/src/main/assets/public/ | ✅ مُزامَن (v8.47) |
| versionCode / versionName | ✅ 847 / 8.47.0 |
| capacitor.config.json | ✅ webDir: "www", androidScheme: https |
| AndroidManifest.xml | ✅ permissions + deep link + rtl |
| keystore.properties.example | ✅ موجود — يحتاج ملء القيم |
| Gradle wrapper (gradlew) | ✅ موجود |
| Android SDK | ❌ غير متوفر في بيئة Replit |

---

## المتطلبات المسبقة (على جهاز Developer)

```
✅ Java JDK 17+ (أو OpenJDK)
✅ Android Studio (Hedgehog أو أحدث) — يتضمن Android SDK تلقائياً
✅ Android SDK 35 (API Level 35)
✅ Node.js 18+
✅ Git
```

---

## الخطوة 1 — استنساخ المشروع

```bash
git clone https://github.com/saddamalkadi/book-summarizer-pwa.git
cd book-summarizer-pwa
npm install
```

---

## الخطوة 2 — مزامنة الملفات

```bash
# ينشئ www/ من ملفات الـ web الرئيسية
node scripts/sync-web.mjs

# ينسخ www/ إلى android/app/src/main/assets/public/
npx cap copy android

# أو مزامنة كاملة (تشمل الـ plugins)
npx cap sync android
```

**يدوياً (بديل):**
```bash
mkdir -p android/app/src/main/assets/public
cp -r www/* android/app/src/main/assets/public/
```

---

## الخطوة 3 — فتح المشروع في Android Studio

```bash
npx cap open android
# أو: افتح Android Studio → Open → اختر مجلد android/
```

### في Android Studio:
1. انتظر حتى يكتمل Gradle sync
2. تأكد أن `Build > Make Project` ينجح بدون أخطاء
3. اتصل بجهاز Android أو افتح Emulator

---

## الخطوة 4 — Debug APK (للاختبار)

### من Android Studio:
```
Build > Build Bundle(s) / APK(s) > Build APK(s)
```
المسار: `android/app/build/outputs/apk/debug/app-debug.apk`

### من Terminal (داخل android/):
```bash
cd android
./gradlew assembleDebug
# APK في: android/app/build/outputs/apk/debug/app-debug.apk
```

> ⚠️ الـ Debug APK موقّع بـ debug keystore تلقائياً — يعمل على أجهزة المطوّرين والمحاكي فقط، لا يُنشر على Play Store.

---

## الخطوة 5 — Release APK (للتوزيع)

### أ. إنشاء Keystore (مرة واحدة فقط):

```bash
keytool -genkey -v \
  -keystore android/release-keystore.jks \
  -alias aiworkspace \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=AI Workspace Studio, OU=Mobile, O=Saddam Alkadi, L=, S=, C=YE"
```

**احتفظ بالـ keystore في مكان آمن — لا يمكن استرجاعه!**

### ب. ملء keystore.properties:

```bash
cp android/keystore.properties.example android/keystore.properties
# ثم حرّر الملف:
```

```properties
storeFile=release-keystore.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=aiworkspace
keyPassword=YOUR_KEY_PASSWORD
```

> ⚠️ **لا ترفع keystore.properties إلى GitHub** — الملف مُدرج في .gitignore

### ج. بناء Release APK:

```bash
cd android
./gradlew assembleRelease
# APK في: android/app/build/outputs/apk/release/app-release.apk
```

### د. بناء AAB (لـ Play Store):

```bash
cd android
./gradlew bundleRelease
# AAB في: android/app/build/outputs/bundle/release/app-release.aab
```

---

## الخطوة 6 — التحقق من APK

```bash
# فحص معلومات APK
aapt dump badging android/app/build/outputs/apk/release/app-release.apk | grep -E "package|sdkVersion|application-label"

# فحص التوقيع
apksigner verify --verbose android/app/build/outputs/apk/release/app-release.apk

# تثبيت على جهاز
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## الخطوة 7 — توزيع APK مباشرة (بدون Play Store)

```bash
# رفع إلى الخادم
scp app-release.apk user@server:/var/www/downloads/

# أو: رفع إلى GitHub Releases
gh release create v8.47.0 app-release.apk \
  --title "AI Workspace Studio v8.47.0" \
  --notes "نسخة Release للتوزيع المباشر"
```

على الهاتف: تفعيل "مصادر غير معروفة" → تنزيل APK → تثبيت

---

## ملاحظات هامة

| البند | التفاصيل |
|------|---------|
| Deep Link | `aiworkspace://auth` — مُعدّ في AndroidManifest.xml ✅ |
| RTL | `android:supportsRtl="true"` ✅ |
| Microphone | `RECORD_AUDIO` permission موجود ✅ |
| HTTPS | `androidScheme: "https"` في capacitor.config.json ✅ |
| Back Button | Capacitor يتعامل معه تلقائياً |
| Splash Screen | `launchShowDuration: 0` (فوري) |

---

## ما يمكن بناؤه الآن مقابل ما يحتاج signing

| المخرج | يُبنى الآن | يحتاج Keystore |
|-------|-----------|--------------|
| Debug APK | ✅ (Android Studio / gradlew) | ❌ |
| Release APK (للتوزيع المباشر) | ✅ (بعد keystore) | ✅ |
| AAB (Play Store) | ✅ (بعد keystore) | ✅ |
| تثبيت على Emulator | ✅ | ❌ |
| نشر على Play Store | ❌ | ✅ + حساب Play Store |

---

## ملخص الخطوات المتبقية

```
[جهازك المحلي فقط]

1. git clone + npm install                          ← 2 دقيقة
2. node scripts/sync-web.mjs + npx cap sync android ← 1 دقيقة
3. ./gradlew assembleDebug                          ← 5-10 دقائق (أول مرة)
4. [اختياري] keytool لإنشاء Keystore               ← 2 دقيقة
5. ملء keystore.properties                          ← 1 دقيقة
6. ./gradlew assembleRelease                        ← 3-5 دقائق
```
