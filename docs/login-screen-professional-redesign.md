# Login gate — professional cleanup — v8.61

## Goals

- **Stronger visual hierarchy** (brand → single title → short value prop → form).
- **Less low-value text** (removed hero feature grid, plan pills, long “what happens next” essays from the default template).
- **Preserve behavior:** same form IDs, Google slot, remember-me row, admin/password path, and `refineAuthGateLayout` compatibility.

## Template changes (`ensureAccountChrome` in `app.js`)

- Gate root class: `auth-gate auth-gate--v2`.
- Hero: shorter subtitle, single **«تسجيل الدخول»** title, one-line `auth-copy`.
- Card: smaller heading **«متابعة»**, shorter instructional paragraph.
- Status line default: **«جاهز للدخول.»** (runtime messages still use `authGateStatus`).
- Trimmed placeholders and labels; removed `auth-access-note` block from template.
- **Removed** from template: `auth-kicker`, `auth-plan-row`, `auth-feature-grid`, `auth-developer` (hero duplicate credit).

## Follow-up trimming (`refineAuthGateLayout`)

- Removes any legacy `auth-kicker` / `auth-developer` if present.
- Shortens `auth-copy`, form paragraph, `authGatePlanNote`, `authEntryModeHint`.

## CSS (`index.html`)

- `.auth-gate--v2` tightens title size and hero padding for a calmer, premium density.

## Non-goals

- No change to **auth verification**, gateway URLs, or admin detection logic — layout/copy only.
