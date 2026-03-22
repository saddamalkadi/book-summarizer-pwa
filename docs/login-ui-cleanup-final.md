# Login UI Cleanup Final

Date: 2026-03-22

## Root cause

- The real auth UI is injected by `ensureAccountChrome()` in `app.js`.
- Runtime cleanup must therefore happen in the same injected tree, not by editing unrelated markup.

## Cleanup goals

- faster first comprehension
- less duplicated plan messaging
- clearer distinction between regular sign-in and admin sign-in
- preserve existing visual identity

## Local fix direction

Implemented locally in `app.js`:

- remove duplicated feature grid
- remove duplicated plan row
- remove access note block
- shorten hero copy
- shorten form copy
- clarify that admin email activates admin flow based on server config

## Remaining acceptance check

Need runtime proof in web and Android that the cleaned auth gate is the one actually rendered after load, not an older cached shell.
