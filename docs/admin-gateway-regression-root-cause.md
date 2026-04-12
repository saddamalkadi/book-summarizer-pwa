# Admin / gateway regression — root cause

Date: 2026-04-12

## Symptoms reported

- Admin password field disappeared from the login UI.
- Gateway authentication appeared broken.
- Worker-related errors resurfaced (misleading “not configured” / gateway strings).

## What the code was doing wrong

`loadRemoteAuthConfig()` fetches `GET {authServiceRoot}/auth/config`. On **any** failure (network timeout, DNS blip, **401 `GATEWAY_INVALID_CLIENT_TOKEN`**, 5xx, parse error), the `catch` path called:

```text
setAuthConfigCached(getLocalAuthConfig(settings))
```

`getLocalAuthConfig()` intentionally returns a **safe offline default**: `adminPasswordEnabled: false`, empty `googleClientId`, `clientIdConfigured: false`, etc.

That object was then **written to `localStorage`** via `setAuthConfigCached`, **overwriting** a previously valid cached `/auth/config` snapshot from a successful run.

## Why that surfaces as “admin password disappeared”

`syncUnifiedAuthEntry()` hides the password row when `adminPasswordEnabled !== true`. After a failed config fetch, the cached config became the pessimistic default, so the UI honestly hid admin password login.

## Why that surfaces as “gateway / worker broken”

The same pessimistic snapshot clears `googleClientId` / flags used for Google sign-in and for interpreting runtime readiness. Combined with transient gateway errors, the app looked like production auth was “gone” even when the Worker secrets and routes were still correct.

## UI cleanup pass relationship

The chat-first CSS pass did **not** remove admin auth DOM or routes. The regression is explained by **auth config persistence logic** on fetch failure, not by missing HTML for the gate.

## Files involved

- `app.js`: `loadRemoteAuthConfig`, `setAuthConfigCached`, `getLocalAuthConfig`, `syncUnifiedAuthEntry`, `repairGatewayAfterAccessIssue` (clears in-memory auth cache on gateway repair; the next fetch must not poison storage on failure).
