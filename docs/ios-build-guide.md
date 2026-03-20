# دليل بناء iOS — AI Workspace Studio v8.47

**Bundle ID**: `com.saddamalkadi.aiworkspace`  
**Version**: 8.47.0 (Build 847)  
**Min iOS**: 14.0  
**Build System**: Xcode + CocoaPods + Capacitor 7  

---

## الحالة الراهنة

| المكوّن | الحالة |
|--------|-------|
| iOS project structure (ios/App/) | ✅ جاهز |
| Xcode project (App.xcodeproj) | ✅ موجود |
| Xcode workspace (App.xcworkspace) | ✅ موجود |
| Podfile | ✅ مُعدّ (Capacitor 7 + plugins) |
| Info.plist | ✅ Bundle ID + URL schemes |
| MARKETING_VERSION | ✅ 8.47.0 |
| CURRENT_PROJECT_VERSION | ✅ 847 |
| macOS / Xcode | ❌ غير متوفر في بيئة Replit |
| Apple Developer Account | ❌ يحتاج اشتراك ($99/سنة) |

---

## متطلبات البيئة (على Mac فقط)

```
✅ macOS 13+ (Ventura أو أحدث)
✅ Xcode 15+ (من App Store)
✅ CocoaPods (gem install cocoapods)
✅ Node.js 18+
✅ Apple Developer Account (للتوزيع)
✅ Homebrew (اختياري لكن مفيد)
```

---

## الخطوة 1 — استنساخ المشروع

```bash
git clone https://github.com/saddamalkadi/book-summarizer-pwa.git
cd book-summarizer-pwa
npm install
```

---

## الخطوة 2 — مزامنة Web Assets

```bash
# ينشئ www/ من ملفات الـ web
node scripts/sync-web.mjs

# ينسخ www/ إلى ios/App/App/public/
npx cap copy ios

# أو مزامنة كاملة (تشمل الـ plugins)
npx cap sync ios
```

---

## الخطوة 3 — تثبيت CocoaPods

```bash
cd ios/App

# تثبيت Ruby gems (إذا لم يكن CocoaPods مثبّتاً)
sudo gem install cocoapods

# تثبيت pods
pod install

# إذا واجهت مشاكل:
pod repo update
pod install --repo-update
```

**ملاحظة**: `pod install` ينشئ `Podfile.lock` و `Pods/` — هذا طبيعي.

---

## الخطوة 4 — فتح في Xcode

```bash
# من جذر المشروع
npx cap open ios

# أو مباشرة:
open ios/App/App.xcworkspace
```

> ⚠️ **دائماً افتح الـ `.xcworkspace` وليس `.xcodeproj`** — الـ workspace يتضمن الـ Pods.

---

## الخطوة 5 — إعداد Signing في Xcode

### أ. إعداد Team:
1. في Xcode: اختر `App` في Project Navigator
2. اختر Target `App`
3. Signing & Capabilities tab
4. فعّل `Automatically manage signing`
5. اختر Team (Apple Developer account)
6. Bundle Identifier: `com.saddamalkadi.aiworkspace` ✅

### ب. إعداد Provisioning (للتوزيع):
```
Xcode → Preferences → Accounts → + أضف Apple ID
```
- Development: توقيع تلقائي على الأجهزة المسجّلة
- Distribution (Ad Hoc / App Store): يتطلب Provisioning Profile من developer.apple.com

---

## الخطوة 6 — بناء للاختبار (TestFlight / Development)

### تشغيل على جهاز/محاكي:
```
Product → Run (⌘R)
```
اختر: iPhone device أو iOS Simulator

### بناء IPA للاختبار (Ad Hoc):
```
Product → Archive
```
بعد الانتهاء:
```
Distribute App → Ad Hoc → Export
```
المسار: `~/Desktop/AI Workspace Studio.ipa`

---

## الخطوة 7 — بناء للنشر (App Store)

### أ. Archive:
```
Product → Destination → Any iOS Device (arm64)
Product → Archive
```

### ب. التحقق وRafting:
```
Window → Organizer → Archives
→ Validate App (اختياري لكن موصى به)
→ Distribute App → App Store Connect
```

### ج. رفع إلى App Store Connect:
- سجّل دخول على https://appstoreconnect.apple.com
- My Apps → AI Workspace Studio → TestFlight للاختبار الداخلي
- أو: App Store → Submit للمراجعة

---

## الخطوة 8 — TestFlight (للتوزيع التجريبي)

```
App Store Connect → TestFlight → Add Build
→ Add External Testers → أضف البريد الإلكتروني
→ المختبر يستلم دعوة على هاتفه
```

مزايا TestFlight:
- توزيع حتى 10,000 مختبر
- بدون مراجعة App Store الرسمية
- رابط تثبيت مباشر

---

## إعداد iOS الراهن

### Info.plist (مُعدّ ✅):
- Bundle ID: `com.saddamalkadi.aiworkspace`
- URL Scheme: `aiworkspace://` (للـ deep linking والـ OAuth)
- Privacy descriptions: Camera, Microphone, Location
- iOS 14+ minimum

### Podfile (مُعدّ ✅):
```ruby
pod 'Capacitor'
pod 'CapacitorCordova'
pod 'CapacitorCommunitySpeechRecognition'
pod 'CapacitorCommunityTextToSpeech'
pod 'CapacitorApp'
pod 'CapacitorBrowser'
pod 'CapacitorNativeGoogleOneTapSignin'
```

### Capabilities المطلوبة في Xcode:
- **Microphone**: لـ Speech Recognition (STT)
- **Push Notifications**: اختياري
- **Background Modes**: Audio (لـ TTS أثناء الـ background)

---

## مشاكل شائعة وحلولها

| المشكلة | الحل |
|---------|------|
| `pod install` يفشل | `pod repo update` ثم أعد المحاولة |
| Signing error | تأكد من Apple Developer Account في Xcode → Preferences |
| Build error "No such module" | نظّف Build Folder: Product → Clean Build Folder |
| Capacitor plugin لا يعمل | `npx cap sync ios` ثم أعد pod install |
| xcworkspace لا يفتح | احذف Pods/ و Podfile.lock ثم pod install |

---

## ما يتعذّر بدون Apple Developer Account

| الميزة | المتطلب |
|-------|---------|
| تثبيت على جهاز iPhone حقيقي | Apple ID مجاني (محدود) |
| TestFlight | Apple Developer ($99/سنة) |
| App Store | Apple Developer ($99/سنة) |
| IPA للتوزيع المباشر | Apple Developer + Enterprise ($299/سنة) |

---

## ملخص الخطوات المتبقية (على Mac)

```
[Mac فقط]

1. git clone + npm install                    ← 2 دقيقة
2. node scripts/sync-web.mjs + npx cap sync ios ← 1 دقيقة
3. cd ios/App && pod install                  ← 3-5 دقائق
4. open App.xcworkspace                       ← فوري
5. Signing & Capabilities → اختر Team        ← 1 دقيقة
6. Product → Archive                          ← 5-15 دقيقة
7. Distribute → TestFlight أو Ad Hoc          ← 2-5 دقائق
```

---

## مرجع سريع

```bash
# مزامنة كاملة + فتح Xcode (على Mac)
npm install && node scripts/sync-web.mjs && npx cap sync ios && cd ios/App && pod install && open App.xcworkspace
```
