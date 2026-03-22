# Admin Password Management Fix

Date: 2026-03-22

## Current root cause

- Admin password comes from Worker secret only:
  - `APP_ADMIN_PASSWORD`
- There is no runtime persistence layer or API for password updates.

## What can be fixed immediately

- show the correct live method in the UI:
  - if password login is disabled, do not show password entry
  - route admin email to Google-only flow

## What requires architectural change

To support changing admin password from inside the product, one of these is required:

1. persisted auth store in KV/D1 with hashed password
2. privileged admin API route to update the stored hash
3. migration away from static Worker secret-only password handling

## Minimum professional implementation

Recommended:

- D1 or KV-backed admin credentials
- password hash storage, not raw value
- explicit `change password` route
- confirmation UI and audit logging
