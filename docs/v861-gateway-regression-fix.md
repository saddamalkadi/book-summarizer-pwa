# v8.61 gateway / connection regression — root cause and fix (shipped in v8.62)

## Symptom

Gateway-backed flows (auth config, session, chat via gateway) appeared “broken” again around the v8.61 rollout, sometimes with misleading “not configured” style behavior in the UI.

## Root cause (same mechanism as admin password)

The **boot-time wipe** of `aistudio_auth_config_v2` (`KEYS.authConfigCache`) meant any **transient** failure of `GET {authServiceRoot}/auth/config` produced a persisted config with:

- empty `googleClientId`
- `clientIdConfigured: false`
- pessimistic admin flags (see `v861-admin-password-regression-fix.md`)

The frontend then honestly behaved as if the Worker had not published OAuth / admin settings, even when the Worker was fine and only the **last request** failed.

So this was primarily **frontend persistence on fetch failure**, not (necessarily) wrong `gatewayUrl` or a dead Worker.

## Secondary factors (still user-side)

- Wrong or trailing `/v1` on `gatewayUrl` in settings (the app normalizes many cases, but invalid URLs still break `getAuthServiceRoot`).
- Invalid or rotated `gatewayToken` → `401` on `/auth/config` → same failure path (now **without** destroying the previous good cache).

## Fix (v8.62)

- Stop deleting `authConfigCache` on every `init()`.
- Preserve merged snapshot on failure via `authConfigAfterFetchFailure()` as designed.

## How to verify the real path

1. In DevTools → Network, confirm `GET https://…/auth/config` returns **200** and JSON includes expected flags.
2. Confirm `localStorage['aistudio_auth_config_v2']` survives reload and contains `googleClientId` / admin fields after a successful fetch.
3. Chat request URL should be `{gatewayRoot}/v1/...` with required headers (`Authorization` / `X-Client-Token` per settings).

## Files

- `app.js`: `init()`, `loadRemoteAuthConfig` catch path consumers (`authConfigAfterFetchFailure`)
