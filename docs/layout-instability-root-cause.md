# Layout Instability Root Cause

## Symptom
The production UI could feel unstable or "shake", especially around:
- sticky bars
- mobile keyboard transitions
- viewport changes
- sidebar/chat layout updates

## Root Cause
There were two main runtime causes:

1. Competing viewport/keyboard state handlers
   - [index.html](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html) had an inline viewport manager that updated `--app-vh` and toggled `body.keyboardEditing`
   - [app.js](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js) also toggled keyboard editing state and refreshed shell layout
   - On non-mobile or borderline viewport changes, this produced unnecessary reflow churn

2. Heavy resize loop behavior
   - `scheduleShellLayoutRefresh()` was calling:
     - `syncKeyboardEditingState()`
     - `resizeComposerInput()`
     - `applyShellLayout()`
     - `refreshStrategicWorkspace()`
   - `refreshStrategicWorkspace()` is relatively heavy and should not run on every resize/layout fluctuation

## Fix Applied

### In [index.html](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/index.html)
- Limited viewport management to mobile/coarse-pointer contexts only
- Increased the minimum height delta threshold before updating `--app-vh`
- Prevented repeated `keyboardEditing` class toggles when the value did not actually change

### In [app.js](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js)
- Removed `refreshStrategicWorkspace()` from the resize/layout refresh loop
- Kept only the layout-critical work in the timed resize handler

## Expected Runtime Effect
- Fewer unnecessary repaints
- More stable sticky bars
- Less layout jump during focus/keyboard transitions
- Reduced sidebar/chat jitter

## Note
This fix targets the identified root reflow loop.  
Visual confirmation still depends on the freshly loaded production web bundle in the browser.
