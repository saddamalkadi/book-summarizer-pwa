# Sidebar / Navigation Implementation

## الهدف
توحيد الشريط الجانبي ومنطق التنقل مع `feature map` و`information architecture` بدون حذف أي ميزة.

## المصدر المرجعي الجديد
- منطق التنقل أصبح معرّفًا في [app.js](/C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js) عبر:
  - `NAV_STRUCTURE`
  - `NAV_TITLES`
  - `renderPrimaryNavigation()`
  - `openWorkspacePage()`

## الترتيب الجديد

### الأقسام الأساسية
- `home`
- `chat`
- `projects`
- `files`
- `knowledge`
- `transcription`
- `downloads`
- `settings`

### الأدوات المتقدمة
- مجموعة `toolsGroup`
  - `canvas`
  - `workflows`

## ما تغير فعليًا

### 1. توحيد بناء الشريط الجانبي
- لم يعد الشريط الجانبي يعتمد على خليط بين HTML ثابت وحقنات متفرقة.
- `renderPrimaryNavigation()` يعيد بناء القائمة من `NAV_STRUCTURE`.

### 2. توحيد الانتقال بين الصفحات
- تمت إضافة `openWorkspacePage(page, options)` لتكون نقطة العبور الواحدة لأي انتقال.
- هذه الدالة لا تكتفي بتبديل الـ active page، بل تشغّل أيضًا الرندر المناسب لكل مساحة:
  - `renderChat()`
  - `renderProjects()`
  - `renderFiles()`
  - `renderKbUI()`
  - `renderTranscribeOperationalState()`
  - `renderDownloads()`
  - `renderCanvasList()`
  - `renderWorkflows()`
  - `renderSettings()`
  - `renderGuidePage()`
  - `renderHomeWorkspace()`

### 3. تقليل التكدس في الشريط الجانبي
- تم إبقاء الأدوات المتقدمة داخل مجموعة واحدة بدل نشرها جميعًا كأزرار رئيسية.
- هذا يحقق `progressive disclosure` من غير أن يجعل أي أداة مفقودة.

### 4. الحفاظ على الوصول لكل ميزة
- `guide` ما زال متاحًا من:
  - زر من الإعدادات
  - بطاقات الـ Home
- `canvas` و`workflows` بقيا ضمن الأدوات
- `downloads` و`settings` بقيا ظاهرين كأقسام رئيسية

## أثر التنفيذ
- التنقل أصبح أوضح على الويب
- الصفحة الرئيسية صارت نقطة دخول فعلية
- أي انتقال من أزرار Home أو بطاقات الاختصار يمر بنفس المنطق الذي يمر به الضغط على عناصر الـ sidebar
