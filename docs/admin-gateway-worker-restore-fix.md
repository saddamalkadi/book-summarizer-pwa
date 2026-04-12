# Admin / gateway / worker — restore fix

Date: 2026-04-12

## Fix summary

1. **`authConfigAfterFetchFailure(settings)`** (in `app.js`)  
   When `/auth/config` cannot be loaded, merge the last persisted `KEYS.authConfigCache` snapshot over the pessimistic local defaults so we **do not downgrade**:
   - `adminPasswordEnabled` (preserve `true` from disk)
   - `adminEnabled`, `adminLoginMethod`
   - `googleClientId` / `clientIdConfigured`
   - `adminEmail` and voice-related fields carried in the same blob

2. **Use that helper everywhere the old code wrote bare `getLocalAuthConfig()` on failure**  
   - `!getAuthServiceRoot(activeSettings)` branch  
   - outer `catch` after `repairGatewayAfterAccessIssue`  
   - inner `catch` after retry with repaired settings  

3. **Stricter merge on success**  
   `adminPasswordEnabled` now respects an explicit boolean from the Worker when present (`typeof remote.adminPasswordEnabled === 'boolean'`), instead of coercing only with `??`.

## Worker / gateway expectations (unchanged)

- `keys-worker.js` continues to expose `/auth/config` with `adminPasswordEnabled` derived from `APP_ADMIN_PASSWORD` / `ADMIN_PASSWORD`.
- Gateway routes still expect `X-Client-Token` when `GATEWAY_CLIENT_TOKEN` is set; the client already sends `settings.gatewayToken` on auth calls.

## Parity

No native-only branches: the same `app.js` ships to **web** and **APK** via `www` + `npm run cap:sync`.
