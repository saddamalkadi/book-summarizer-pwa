# Codex Handoff

## Current status
Project was partially refactored and polished in Replit, but several runtime issues remain unresolved.

## Confirmed unresolved issues
1. Login flow is broken in real usage.
2. auth-bridge / gateway flow shows mismatch error in production.
3. After login, the app lands on the wrong screen instead of the intended home/workspace landing.
4. Sticky chat input does not work correctly on mobile browsers.
5. Scroll-to-bottom floating button does not work or does not appear correctly on mobile.
6. APK does not match the current web version.
7. The actual login route UI was not properly refined.
8. Some fixes were claimed complete based on code inspection, but failed in real runtime testing.

## Rules
- Do not rebuild from scratch.
- Preserve the current visual design and color system.
- Focus on runtime fixes, not redesign.
- Fix one root-cause issue at a time.
- Do not claim completion without runtime verification.
- Prefer minimal safe changes.
- Document every fix in docs/.

## Priority order
1. Root-cause audit
2. Fix login/auth-bridge/gateway mismatch
3. Fix post-login landing
4. Fix sticky chat input on mobile
5. Fix scroll-to-bottom FAB on mobile
6. Fix APK/web parity
7. Fix actual login UI route
