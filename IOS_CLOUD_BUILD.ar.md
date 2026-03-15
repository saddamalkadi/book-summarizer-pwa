# بناء نسخة iPhone سحابياً

هذا المشروع أصبح مجهزاً لمسار بناء iPhone عبر `Codemagic` بدون الحاجة إلى جهاز Mac محلي.

## ما تم تجهيزه داخل المشروع

- ملف إعداد سحابي جاهز: [codemagic.yaml](/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/codemagic.yaml)
- مشروع iOS جاهز في: [ios/App](/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/ios/App)
- معرف الحزمة: `com.saddamalkadi.aiworkspace`
- مخطط Xcode: `App`
- Workspace: `ios/App/App.xcworkspace`
- إصدار iOS الحالي: `8.20.0`
- رابط رجوع من المتصفح للتطبيق: `aiworkspace://auth`

## لماذا اخترنا Codemagic

المشروع مبني بـ `Capacitor`، و`Codemagic` يدعم بناء تطبيقات `Ionic/Capacitor` على macOS سحابياً مع إخراج `IPA`.

المراجع الرسمية:
- [Codemagic for Ionic Capacitor apps](https://docs.codemagic.io/yaml-quick-start/building-an-ionic-app/)
- [Codemagic iOS code signing](https://docs.codemagic.io/yaml-code-signing/ios-code-signing/)
- [Capacitor iOS platform guide](https://capacitorjs.com/docs/ios)

## ما الذي تحتاجه فقط

1. حساب `Apple Developer`
2. حساب `App Store Connect`
3. ربط المستودع في `Codemagic`
4. إضافة شهادات وتوقيع iOS داخل Codemagic

## خطوات البناء السحابي

1. افتح [Codemagic](https://codemagic.io/) واربط مستودع GitHub:
   `saddamalkadi/book-summarizer-pwa`
2. اختر أن المنصة تستخدم ملف الإعداد داخل المستودع:
   `codemagic.yaml`
3. في إعدادات Code Signing داخل Codemagic:
   - أضف `Apple Distribution Certificate`
   - أضف `Provisioning Profile`
   - أو فعّل الإدارة التلقائية إذا كنت تفضل ذلك
4. شغّل Workflow:
   `ios-cloud-ipa`
5. بعد انتهاء البناء ستحصل على ملف:
   `IPA`

## ملاحظات مهمة

- ملف `codemagic.yaml` يغيّر `build number` تلقائياً في كل Build حتى لا ترفض Apple الرفع لاحقاً بسبب تكرار رقم البناء.
- تسجيل Google عبر المتصفح أصبح مناسباً لمسار iPhone أيضًا لأن رابط الرجوع `aiworkspace://auth` تم تجهيزه داخل:
  [Info.plist](/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/ios/App/App/Info.plist)
- إذا أردت لاحقاً الرفع إلى `TestFlight` بدل الاكتفاء بملف `IPA`، أستطيع تجهيز لك Workflow ثانٍ للنشر التلقائي.

## ملفات الأساس

- [codemagic.yaml](/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/codemagic.yaml)
- [prepare_ios_cloud_build.py](/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/scripts/prepare_ios_cloud_build.py)
- [project.pbxproj](/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/ios/App/App.xcodeproj/project.pbxproj)
- [Info.plist](/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/ios/App/App/Info.plist)
