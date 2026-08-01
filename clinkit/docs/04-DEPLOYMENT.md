# Clinkit — AWS Deployment (low-cost → scalable)

## Topology

| Component | Service | MVP size | Scale path |
|---|---|---|---|
| Web (Next.js) | Amplify Hosting (or Vercel) | free tier | CloudFront + ISR |
| API + WS | ECS Fargate behind ALB (sticky WS target group) | 2 × 0.5 vCPU/1 GB | target-tracking autoscale on CPU + ALB RPS |
| Aggregator jobs | SQS + Fargate worker (same image, `ROLE=worker`) | 1 × 0.25 vCPU | scale on queue depth |
| DB | RDS Postgres 16 + PostGIS | db.t4g.small, 20 GB gp3 | read replica → Aurora |
| Cache/RT | ElastiCache Redis 7 | cache.t4g.micro | cluster mode |
| Assets | S3 + CloudFront | — | — |
| Mobile | Expo EAS build → App Store / Play | — | — |

Estimated MVP burn: **~$120–180/mo**.

## Pipeline
1. GitHub Actions: lint → `node --test` → build Docker image → push ECR → `aws ecs update-service`.
2. Migrations run as one-off Fargate task (`node src/db/migrate.js`) before service flip.
3. Blue/green via ECS deployment circuit breaker; Socket.IO uses Redis adapter so any task serves any client.

## Local dev

```bash
cd clinkit/server && cp .env.example .env
docker compose -f ../infra/docker-compose.yml up -d   # postgres + redis
npm install && npm run db:migrate && npm run dev       # API on :4000 (PROVIDERS_MOCK=1)
cd ../web && npm install && npm run dev                # web on :3000
cd ../mobile && npm install && npx expo start          # RN app
```

No external keys are needed in mock mode; the full buyer→runner flow works locally.
