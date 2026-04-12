# v8.61 admin password visibility regression — root cause and fix (shipped in v8.62)

## Symptom

After deploying v8.61, the admin password row on the auth gate disappeared again for some sessions, even when the Worker still advertised password-capable admin login.

## Root cause (verified in code)

In `init()` the app executed **on every cold load**:

```js
localStorage.removeItem(KEYS.authConfigCache);
AUTH_RUNTIME.config = null;
```

That **deleted the last good snapshot** of `GET /auth/config` from `localStorage`.

Immediately after, `initializeAuthExperience()` calls `loadRemoteAuthConfig(true)`. If that request **fails or is slow** (network, `401 GATEWAY_INVALID_CLIENT_TOKEN`, worker blip), the catch path runs:

```js
setAuthConfigCached(authConfigAfterFetchFailure(settings));
```

`authConfigAfterFetchFailure` merges the previous cache into safe defaults **only if `prev` exists**. After the wipe, **`prev` was always `null`**, so the merged config collapsed to `getLocalAuthConfig()`:

- `adminPasswordEnabled: false` (default)
- `adminLoginMethod: 'google_only'` (default)

`syncUnifiedAuthEntry()` hides the password row when those flags do not allow password — so the UI correctly reflected the **poisoned** cached config, not the live Worker.

This is **state/cache handling + boot order**, not missing DOM or Worker suddenly disabling password without a config change.

## Fix (v8.62)

- **Removed** the unconditional `removeItem(KEYS.authConfigCache)` from `init()`.
- Kept `AUTH_RUNTIME.config = null` so memory is refreshed from persisted storage on first read.
- **Hardened** `authConfigAfterFetchFailure`: if a stored snapshot has `adminEnabled === true` but an empty `adminLoginMethod`, infer `'password_or_google'` when merging after failure (legacy snapshots).

## Files

- `app.js`: `init()`, `authConfigAfterFetchFailure()`

## How to verify

1. With a known-good `/auth/config` once stored, toggle airplane mode / block `/auth/config` briefly and reload: password row should still follow **last good** cache until a successful fetch overwrites it.
2. After a **successful** fetch with `adminPasswordEnabled: true` or `adminLoginMethod: password_or_*`, enter admin email: password row visible.
