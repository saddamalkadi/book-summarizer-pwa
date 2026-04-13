# v864 Dashboard Structured Options Pass

هذا التمرير وسّع التحويل من الإدخال الحر إلى الاختيارات المنظّمة في لوحة المعرفة/الإعدادات.

## التحويلات الأساسية

- `embedModel`:
  - من text input إلى `embedModelPreset` (dropdown) بخيارات embedding جاهزة.
  - إضافة `custom` لعرض حقل يدوي فقط عند الحاجة.
- الاستمرار على التحويلات السابقة المنظمة:
  - `maxOut`, `fileClip`, `ocrLang`, `kbTopK`, `kbChunkSize`, `kbOverlap`.

## التوافق العكسي

- عند وجود قيم قديمة محفوظة، يتم دعمها عبر `ensureSelectHasValue(...)` حتى لا تنكسر الإعدادات السابقة.
- خيار `custom` يضمن عدم إغلاق الباب أمام القيم غير القياسية.
