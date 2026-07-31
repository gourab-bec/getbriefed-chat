#!/usr/bin/env bash
# Interactive key onboarding: paste each key once, it's validated live, then written to .env.
# Providers you skip stay in mock mode automatically (per-provider auto-live).
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=".env"
[ -f "$ENV_FILE" ] || cp .env.example "$ENV_FILE"

put() { # put KEY VALUE — idempotent .env writer
  if grep -q "^$1=" "$ENV_FILE"; then sed -i.bak "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >> "$ENV_FILE"; fi
}

ask() { # ask VAR "prompt" — empty answer skips
  local var="$1" prompt="$2" val
  read -r -p "$prompt (enter to skip): " val
  [ -n "$val" ] && put "$var" "$val" && echo "  ✓ saved $var"
  echo "${val:-}"
}

echo "Clinkit provider key setup — skip anything you don't have yet."

KID=$(ask KROGER_CLIENT_ID "Kroger client id")
if [ -n "$KID" ]; then
  KSECRET=$(ask KROGER_CLIENT_SECRET "Kroger client secret")
  if [ -n "$KSECRET" ]; then
    echo -n "  validating Kroger OAuth… "
    curl -sf -X POST https://api.kroger.com/v1/connect/oauth2/token \
      -H "Authorization: Basic $(printf '%s:%s' "$KID" "$KSECRET" | base64 -w0)" \
      -H 'Content-Type: application/x-www-form-urlencoded' \
      -d 'grant_type=client_credentials&scope=product.compact' >/dev/null && echo OK || echo "FAILED (kept anyway — recheck)"
  fi
fi

SERP=$(ask SERPAPI_KEY "SerpAPI key")
if [ -n "$SERP" ]; then
  echo -n "  validating SerpAPI… "
  curl -sf "https://serpapi.com/account.json?api_key=$SERP" >/dev/null && echo OK || echo "FAILED (kept anyway)"
fi

ask GOOGLE_MAPS_API_KEY "Google Maps API key" >/dev/null
ask WALMART_CONSUMER_ID "Walmart consumer id" >/dev/null
ask INSTACART_API_KEY "Instacart API key" >/dev/null

SK=$(ask STRIPE_SECRET_KEY "Stripe secret key (sk_live_/sk_test_)")
if [ -n "$SK" ]; then
  echo -n "  validating Stripe… "
  curl -sf https://api.stripe.com/v1/balance -u "$SK:" >/dev/null && { echo OK; put STRIPE_MOCK 0; } || echo "FAILED (kept; STRIPE_MOCK unchanged)"
fi

AVA=$(ask AVALARA_ACCOUNT_ID "Avalara account id")
[ -n "$AVA" ] && { ask AVALARA_LICENSE_KEY "Avalara license key" >/dev/null; put AVALARA_MOCK 0; }

put PROVIDERS_MOCK ""   # clear force-mock so keyed providers go live
echo
echo "Done. Providers with keys are now LIVE on next start; the rest stay mock."
echo "Check:  curl localhost:4000/api/admin/providers"
