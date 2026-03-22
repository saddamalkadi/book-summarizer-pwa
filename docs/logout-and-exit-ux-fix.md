# Logout And Exit UX Fix

Date: 2026-03-22

## Root cause

- Logout exists but is buried inside account/settings UI.
- Exit semantics on Android rely on default shell behavior.

## Local status

Current code already contains:

- `logoutCurrentAccount()` in `app.js`
- account logout button inside settings account card

## Improvement direction

- elevate logout action into a clearer account trigger flow
- provide explicit success feedback after logout
- define Android back/exit behavior:
  - first back closes drawers/modals
  - second back exits from the main landing only

## Architecture note

- logout itself does not require backend changes
- improved exit behavior is mainly a client-shell concern
