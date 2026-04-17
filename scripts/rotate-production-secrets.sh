#!/usr/bin/env bash
# rotate-production-secrets.sh
# ONE-SHOT fix script that rotates APP_ADMIN_PASSWORD + OPENROUTER_API_KEY on the
# live sadam-key Cloudflare Worker, deletes the stale KV admin password fallback,
# redeploys the worker from the current repo state, and validates the live runtime
# end-to-end (/health, /auth/config, /auth/diagnose, /auth/login, /v1/credits,
# /v1/chat/completions).
#
# Run this from ANY machine with wrangler + curl + node installed AND with a
# Cloudflare API token that has Workers Scripts:Edit + Workers KV:Edit.
#
# Usage:
#   export CLOUDFLARE_API_TOKEN='cf-token-with-workers-edit-scope'
#   export CLOUDFLARE_ACCOUNT_ID='your-account-id'
#   export OPENROUTER_API_KEY='sk-or-v1-...'   # a key that returns 200 on /v1/credits
#   export APP_ADMIN_PASSWORD='123456'         # or whatever admin pw you want to bind
#   ./scripts/rotate-production-secrets.sh
#
# Exit codes:
#   0  everything live and working
#   1  missing required env vars
#   2  OPENROUTER_API_KEY rejected by OpenRouter BEFORE we bind it
#   3  wrangler binding or deploy failed
#   4  post-deploy live validation failed

set -u
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

WORKER="sadam-key"
KV_NAMESPACE_ID="49d87e2d4989452fb3c680ad024ae5b7"
API_HOST="https://api.saddamalkadi.com"

say()  { printf "${GREEN}[rotate]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[rotate]${NC} %s\n" "$*"; }
die()  { printf "${RED}[rotate][FATAL]${NC} %s\n" "$*" 1>&2; exit "${2:-1}"; }

# ────────────────────────────── 1) preflight ──────────────────────────────
command -v wrangler >/dev/null || die "wrangler not installed. Run: npm i -g wrangler@3"
command -v curl     >/dev/null || die "curl not installed"
command -v python3  >/dev/null || die "python3 not installed"

missing=""
[ -n "${CLOUDFLARE_API_TOKEN:-}" ]  || missing="$missing CLOUDFLARE_API_TOKEN"
[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] || missing="$missing CLOUDFLARE_ACCOUNT_ID"
[ -n "${OPENROUTER_API_KEY:-}" ]    || missing="$missing OPENROUTER_API_KEY"
[ -n "${APP_ADMIN_PASSWORD:-}" ]    || APP_ADMIN_PASSWORD="123456"
[ -n "$missing" ] && die "missing required env vars:$missing" 1

say "Using worker=$WORKER; admin password length=${#APP_ADMIN_PASSWORD}"

# ────────────────────────── 2) verify OR key first ──────────────────────────
say "Verifying OPENROUTER_API_KEY directly against OpenRouter before binding…"
or_code=$(curl -sS -o /tmp/or-check.json -w "%{http_code}" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  https://openrouter.ai/api/v1/credits || true)
if [ "$or_code" != "200" ]; then
  warn "OpenRouter probe returned HTTP $or_code. Body:"
  head -c 400 /tmp/or-check.json; echo
  die "OPENROUTER_API_KEY is NOT accepted by OpenRouter. Generate a new key at https://openrouter.ai/settings/keys and retry." 2
fi
say "OpenRouter accepts the key (HTTP 200 on /api/v1/credits). Proceeding."

# ───────────────────── 3) pre-check live worker state ─────────────────────
say "Live /health BEFORE rotate:"
curl -sS "$API_HOST/health" | python3 -m json.tool || true

# ─────────────────── 4) drop stale KV admin password ───────────────────
say "Deleting stale KV '_config:admin_password' so env-var secret always wins…"
wrangler kv key delete \
  --binding USER_DATA \
  --namespace-id "$KV_NAMESPACE_ID" \
  '_config:admin_password' \
  --remote || warn "KV delete returned non-zero (maybe already absent). Continuing."

# ─────────────────── 5) bind secrets on the worker ───────────────────
say "Binding APP_ADMIN_PASSWORD on worker '$WORKER'…"
printf '%s' "$APP_ADMIN_PASSWORD" | wrangler secret put APP_ADMIN_PASSWORD --name "$WORKER" \
  || die "wrangler secret put APP_ADMIN_PASSWORD failed" 3

say "Binding OPENROUTER_API_KEY on worker '$WORKER'…"
printf '%s' "$OPENROUTER_API_KEY" | wrangler secret put OPENROUTER_API_KEY --name "$WORKER" \
  || die "wrangler secret put OPENROUTER_API_KEY failed" 3

# ─────────────────── 6) redeploy keys-worker.js ───────────────────
say "Redeploying keys-worker.js from current repo…"
wrangler deploy --config wrangler.jsonc || die "wrangler deploy failed" 3

# ─────────────────── 7) wait for propagation ───────────────────
say "Waiting 20 s for edge propagation…"
sleep 20

# ─────────────────── 8) validate live ───────────────────
say "Live validation…"

pass_all=1
check() {
  local label="$1"; local url="$2"; local method="${3:-GET}"; local body="${4:-}"
  local hdr='-H "Origin: https://app.saddamalkadi.com"'
  local resp
  if [ "$method" = "POST" ]; then
    resp=$(curl -sS -o /tmp/resp.json -w "%{http_code}" -X POST \
      -H "Origin: https://app.saddamalkadi.com" -H "Content-Type: application/json" \
      "$url" -d "$body")
  else
    resp=$(curl -sS -o /tmp/resp.json -w "%{http_code}" \
      -H "Origin: https://app.saddamalkadi.com" "$url")
  fi
  echo ""
  echo "── $label ($resp) ──"
  head -c 600 /tmp/resp.json; echo
  echo "$resp $label" >> /tmp/rotate-summary.txt
  printf "%s" "$resp"
}

: > /tmp/rotate-summary.txt

h=$(check "/health" "$API_HOST/health")
python3 -c "import json,sys; d=json.load(open('/tmp/resp.json')); sys.exit(0 if (d.get('upstream_key_valid') and d.get('admin_password_ready')) else 1)" \
  || { pass_all=0; warn "/health still reports upstream_key_valid=false OR admin_password_ready=false"; }

c=$(check "/auth/config" "$API_HOST/auth/config")
python3 -c "import json,sys; d=json.load(open('/tmp/resp.json')); sys.exit(0 if d.get('adminPasswordEnabled') else 1)" \
  || { pass_all=0; warn "/auth/config still reports adminPasswordEnabled=false"; }

d=$(check "/auth/diagnose (admin pw)" "$API_HOST/auth/diagnose" POST \
  "{\"email\":\"tntntt830@gmail.com\",\"password\":\"$APP_ADMIN_PASSWORD\"}")
python3 -c "import json,sys; d=json.load(open('/tmp/resp.json')); sys.exit(0 if d.get('exactMatchTrim') else 1)" \
  || { pass_all=0; warn "/auth/diagnose says exactMatchTrim=false — stored value does not match the one we just bound"; }

lg=$(check "/auth/login" "$API_HOST/auth/login" POST \
  "{\"email\":\"tntntt830@gmail.com\",\"password\":\"$APP_ADMIN_PASSWORD\"}")
[ "$lg" = "200" ] || { pass_all=0; warn "/auth/login did not 200"; }

cr=$(check "/v1/credits" "$API_HOST/v1/credits")
[ "$cr" = "200" ] || { pass_all=0; warn "/v1/credits did not 200"; }

ch=$(check "/v1/chat/completions" "$API_HOST/v1/chat/completions" POST \
  '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"ping"}],"max_tokens":5}')
[ "$ch" = "200" ] || { pass_all=0; warn "/v1/chat/completions did not 200"; }

echo ""
say "SUMMARY:"; cat /tmp/rotate-summary.txt

if [ "$pass_all" = "1" ]; then
  say "ALL LIVE CHECKS PASS. Admin password + OpenRouter key are live."
  exit 0
else
  die "Live validation failed — see warnings above." 4
fi
