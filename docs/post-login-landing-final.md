# Post Login Landing Final

Date: 2026-03-22

## Root cause

- Post-login routing previously depended on the current tab or bridge fallback.
- There was no canonical destination after auth.

## Local fix direction

Implemented locally in `app.js`:

- add `DEFAULT_POST_LOGIN_PAGE`
- make browser auth builder always send that page
- make auth payload consumption fall back to that page only

## Product note

- The app still does not have a dedicated `home` route.
- Current deterministic landing is therefore a controlled page selection rather than a new standalone home screen.

## Next recommended improvement

- introduce one explicit workspace home page if the product wants a true post-login dashboard rather than entering chat directly.
