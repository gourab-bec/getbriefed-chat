# Deploy on Your Existing Vercel + getbriefed.to Setup

You already run `palmist.getbriefed.to` and `daytrader.getbriefed.to` on Vercel, which
means: Vercel CLI is authenticated on your machine and `getbriefed.to` DNS is already
pointed at Vercel. **`zipnab.getbriefed.to` therefore costs $0 and ~15 minutes.** Run
these on your machine (I can't run them here — they use your logged-in sessions; never
paste tokens into chat).

## 1. Web → Vercel (~10 min)
```bash
cd clinkit/web
npm install
npx vercel link          # pick your existing scope/team, "create new project: zipnab"
npx vercel --prod        # first deploy
npx vercel domains add zipnab.getbriefed.to    # same pattern as palmist/daytrader
# later, after buying zipnab.com at your registrar:
npx vercel domains add zipnab.com              # Vercel prints the A/CNAME records to set
```

## 2. API → Fly.io (~20 min; Socket.IO needs a persistent process, so not Vercel)
```bash
cd clinkit/server
fly launch --copy-config --no-deploy   # uses ../infra/fly.toml; creates app zipnab-api
fly secrets set JWT_SECRET=$(openssl rand -hex 32) ADMIN_TOKEN=$(openssl rand -hex 16)
fly deploy
curl https://zipnab-api.fly.dev/api/health   # {"ok":true,...}
```
`web/vercel.json` already rewrites `/api/*` to `zipnab-api.fly.dev`, so the web app works
with no client changes. Add Postgres/Redis later (`fly postgres create`, Upstash Redis) —
mock mode needs neither.

## 3. Flip providers live (whenever keys arrive)
```bash
fly secrets set PROVIDERS_MOCK= KROGER_CLIENT_ID=... KROGER_CLIENT_SECRET=... SERPAPI_KEY=...
# each provider auto-switches to live on restart; verify:
curl -H "X-Admin-Token: <ADMIN_TOKEN>" https://zipnab-api.fly.dev/api/admin/providers
```

## 4. Staging
`npx vercel` (no `--prod`) gives per-commit preview URLs; `fly apps create zipnab-api-staging`
+ `fly deploy -a zipnab-api-staging` mirrors the API. Keep staging on `PROVIDERS_MOCK=1` always.

Cost: Vercel hobby $0 · Fly shared-1x ~$0–5/mo with auto-stop · zipnab.com ~$11/yr.
