#!/usr/bin/env bash
# ZipNab standup Q&A — walks the founder item-by-item through every credential and
# decision needed to go live, in dependency order. Answers land in .env (secrets) and
# founder-answers.json (decisions). Skip anything with Enter; re-run anytime — it only
# asks for what's still missing. Secrets never leave this machine.
set -uo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=".env"; ANSWERS="founder-answers.json"
[ -f "$ENV_FILE" ] || cp .env.example "$ENV_FILE"
[ -f "$ANSWERS" ] || echo '{}' > "$ANSWERS"

put_env() { grep -q "^$1=" "$ENV_FILE" && sed -i.bak "s|^$1=.*|$1=$2|" "$ENV_FILE" || echo "$1=$2" >> "$ENV_FILE"; }
put_ans() { node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('$ANSWERS'));j['$1']='$2';fs.writeFileSync('$ANSWERS',JSON.stringify(j,null,2));"; }
have_env() { grep -q "^$1=..*" "$ENV_FILE"; }
have_ans() { node -e "const j=require('./$ANSWERS');process.exit(j['$1']?0:1);" 2>/dev/null; }
qa() { # qa TYPE KEY "question" "why/how"
  local type="$1" key="$2" q="$3" how="$4" val
  if { [ "$type" = env ] && have_env "$key"; } || { [ "$type" = ans ] && have_ans "$key"; }; then
    echo "  ✔ $key already set — skipping"; return
  fi
  echo; echo "Q: $q"; echo "   ($how)"
  read -r -p "A: " val
  [ -z "$val" ] && { echo "   ⏭ skipped — re-run later"; return; }
  [ "$type" = env ] && put_env "$key" "$val" || put_ans "$key" "$val"
  echo "   ✔ saved"
}

echo "════════ ZipNab Standup Q&A ════════"
echo "Everything below maps to a dashboard task (launch-dashboard.html)."

echo; echo "── 1. Brand & domains ──"
qa ans BRAND_CONFIRMED "Confirm brand 'ZipNab' (yes / other name)" "docs/brand/BRAND.md; zipnab.com+.co probed available 2026-07-31 — verify at registrar + USPTO TESS"
qa ans DOMAIN_PURCHASED "Have you purchased zipnab.com? (yes/no/date)" "~\$11 at your existing registrar; then: npx vercel domains add zipnab.com"

echo; echo "── 2. Entity & banking (blocking for Stripe) ──"
qa ans ENTITY_STATE "What state is GetBriefed Inc/LLC formed in?" "Determines CA foreign-qualification need (docs/legal/00)"
qa ans OWNERSHIP_FILED "Ownership amendment signed? (51% Sompriya Chanda / 49% you)" "docs/legal/08-ownership-restructure.md — attorney review first"
qa ans BIZ_BANK "Business checking account exists? (bank name)" "Required for Stripe payouts; Chase biz checking also strengthens the funding ask"

echo; echo "── 3. Payments & tax ──"
qa env STRIPE_SECRET_KEY "Stripe SECRET key (sk_test_ now, sk_live_ at launch)" "dashboard.stripe.com → Developers → API keys; activate Connect Express"
qa env STRIPE_WEBHOOK_SECRET "Stripe webhook signing secret" "Developers → Webhooks → endpoint https://zipnab-api.fly.dev/api/webhooks/stripe"
qa env AVALARA_ACCOUNT_ID "Avalara account id (or skip to keep mock CA-exempt table)" "avalara.com free tier <200 txn/mo"

echo; echo "── 4. Price-data providers (each key auto-flips that provider live) ──"
qa env KROGER_CLIENT_ID "Kroger client id" "developer.kroger.com → register app → Products+Locations scopes (5 min, free)"
qa env KROGER_CLIENT_SECRET "Kroger client secret" "same page"
qa env GOOGLE_MAPS_API_KEY "Google Maps/Places key" "console.cloud.google.com (free \$200/mo credit)"
qa env SERPAPI_KEY "SerpAPI key (WinCo/local prices)" "serpapi.com — 100 free searches; \$75/mo only when you scale"
qa env WALMART_CONSUMER_ID "Walmart consumer id (or skip; mock covers)" "developer.walmart.com + RSA keypair"

echo; echo "── 5. Compliance & safety ──"
qa ans CDTFA_DONE "CDTFA seller's permit registered? (yes/no)" "onlineservices.cdtfa.ca.gov — free, ~30 min"
qa ans CITY_LICENSE "Tracy business license filed? (yes/no)" "~\$75, city portal"
qa ans INSURANCE_QUOTE "Cyber+E&O quote requested? (broker name/no)" "Vouch/Hiscox/Next — bind ≤\$350/mo"
qa ans CHECKR_ACCOUNT "Background-check vendor account? (yes/no)" "checkr.com — pay-per-check"

echo; echo "── 6. Deploy ──"
qa ans VERCEL_DEPLOYED "Web deployed to zipnab.getbriefed.to? (yes/no)" "docs/08-DEPLOY-VERCEL.md §1 — same flow as palmist/daytrader"
qa ans FLY_DEPLOYED "API deployed to Fly.io? (yes/no)" "docs/08-DEPLOY-VERCEL.md §2"

echo; echo "════════ Summary ════════"
node -e "
const fs=require('fs');
const ans=JSON.parse(fs.readFileSync('$ANSWERS'));
const env=fs.readFileSync('$ENV_FILE','utf8');
const envSet=(k)=>new RegExp('^'+k+'=..*','m').test(env);
const items=[['Brand confirmed',!!ans.BRAND_CONFIRMED],['Domain purchased',/^y|20/i.test(ans.DOMAIN_PURCHASED||'')],
 ['Entity state known',!!ans.ENTITY_STATE],['Ownership amendment',/^y/i.test(ans.OWNERSHIP_FILED||'')],
 ['Business bank',!!ans.BIZ_BANK],['Stripe key',envSet('STRIPE_SECRET_KEY')],['Kroger live',envSet('KROGER_CLIENT_ID')],
 ['Maps key',envSet('GOOGLE_MAPS_API_KEY')],['SerpAPI',envSet('SERPAPI_KEY')],['CDTFA',/^y/i.test(ans.CDTFA_DONE||'')],
 ['City license',/^y/i.test(ans.CITY_LICENSE||'')],['Insurance quoted',!!ans.INSURANCE_QUOTE&&ans.INSURANCE_QUOTE!=='no'],
 ['Web deployed',/^y/i.test(ans.VERCEL_DEPLOYED||'')],['API deployed',/^y/i.test(ans.FLY_DEPLOYED||'')]];
let done=0; for(const [n,ok] of items){console.log((ok?' ✔ ':' ✗ ')+n); if(ok)done++;}
console.log('\n'+done+'/'+items.length+' complete. Open launch-dashboard.html for the sequenced view with ETAs.');
"
