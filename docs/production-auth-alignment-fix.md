# Production Auth Alignment Fix

## Scope
- Make live auth config match the intended production behavior.
- Remove the mismatch between worker health/config and the login UI.

## Intended Production Behavior
Production is intended to support:
- regular user login
- Google login
- admin Google login
- admin password login

So the intended auth mode is:
- `adminPasswordEnabled = true`
- `adminLoginMethod = password_or_google`

## Root Cause
Live production was serving the wrong worker trigger state, not the current deployment, even though Cloudflare had:
- `APP_ADMIN_PASSWORD`
- `OPENROUTER_API_KEY`

This caused live production to report:
- `adminPasswordEnabled = false`
- `adminLoginMethod = google_only`
- `upstream_configured = false`

The worker version metadata showed the latest deployment already had both secrets bound, which proved the issue was not missing configuration in the code bundle. The frontend then rendered the wrong login behavior because it was honestly consuming the stale live `/auth/config` response from the incorrectly bound runtime.

## Fix Applied
1. Re-deployed the current worker from [wrangler.jsonc](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/wrangler.jsonc)
2. Re-applied the live custom-domain trigger with `wrangler triggers deploy`
3. Verified that the active runtime now reads the configured secrets correctly
4. Kept frontend auth behavior tied to live `/auth/config`
5. Ensured stale auth cache is cleared during init in [app.js](C:/Users/Elite/OneDrive/Documenti/GitHub/book-summarizer-pwa/app.js)

## Live Proof

### Live config
`GET https://api.saddamalkadi.com/auth/config`

Confirmed fields:
- `adminEnabled: true`
- `adminPasswordEnabled: true`
- `adminLoginMethod: "password_or_google"`

### Live health
`GET https://api.saddamalkadi.com/health`

Confirmed fields:
- `admin_password_ready: true`
- `admin_login_ready: true`
- `upstream_configured: true`

### Live admin login
`POST https://api.saddamalkadi.com/auth/login`

Confirmed result:
- `ok: true`
- `role: "admin"`
- `plan: "premium"`

## Result
Production auth config and production auth behavior are now aligned again on the API side.
