#!/usr/bin/env bash
# Sync root web assets → www/ for Capacitor APK builds
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WWW="$ROOT/www"
echo "Syncing from $ROOT → $WWW ..."
for f in index.html app.js sw.js manifest.webmanifest auth-bridge.html logo.svg CNAME; do
  [ -f "$ROOT/$f" ] && cp "$ROOT/$f" "$WWW/$f" && echo "  ✓ $f"
done
[ -d "$ROOT/icons" ] && cp -r "$ROOT/icons/." "$WWW/icons/" && echo "  ✓ icons/"
echo "Done. www/ is up to date."
echo ""
echo "Next step: npx cap sync android"
