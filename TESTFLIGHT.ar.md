# TestFlight - AI Workspace Studio

## ما تم تجهيزه

- معرف التطبيق iPhone: `com.saddamalkadi.aiworkspace`
- إصدار iPhone التسويقي: `8.3.0`
- رقم البناء: `83`
- مشروع iPhone موجود داخل `ios/App`

## ما تحتاجه لإخراج TestFlight

1. افتح المشروع على `macOS` عبر `Xcode`.
2. اختر Team الخاص بحساب Apple Developer من إعدادات Signing.
3. تأكد من تثبيت `CocoaPods` ثم نفّذ `pod install` إذا طُلب.
4. اختر:
   - `Any iOS Device (arm64)`
5. نفّذ:
   - `Product > Archive`
6. من `Organizer` اختر:
   - `Distribute App`
   - `App Store Connect`
   - `Upload`

## ملاحظات

- ملف `ZIP` داخل `downloads/` هو حزمة مشروع iPhone الجاهزة للنقل إلى جهاز macOS.
- الإخراج النهائي `IPA/TestFlight` لا يمكن إنتاجه من Windows وحده.
