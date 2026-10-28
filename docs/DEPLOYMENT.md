# Sentinel AI — deployment notes

## Production checklist
- [ ] `JWT_SECRET` ≥ 32 random chars, unique per environment
- [ ] `DATABASE_URL` points to managed Postgres; `npx prisma migrate deploy` applied
- [ ] `REDIS_URL` set (otherwise scheduler runs in-process on a single replica)
- [ ] `CORS_ORIGIN` = exact web origin(s); `COOKIE_SECURE=true` behind HTTPS
- [ ] `OPENAI_API_KEY` set only if AI investigations are wanted; monitor usage/cost
- [ ] Reverse proxy terminates TLS; API and web on private network where possible
- [ ] Backups enabled for Postgres; Redis persistence for queues (optional)

## Commands
```bash
docker compose up --build -d
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run prisma:seed   # explicit demo-data operation; blocked in production by default
```

The demo seed creates accounts with documented demo credentials and sample telemetry. It never runs during application startup. Do not run it against a production database unless that deployment is explicitly intended to be a public demo and has been authorized; production execution requires `ALLOW_DEMO_SEED_IN_PRODUCTION=1`.

For the separate Vercel and Render origins, configure `CORS_ORIGIN` to the exact Vercel origin and enable credentials. Production auth cookies use `SameSite=None; Secure` so credentialed browser requests can send them across origins. The frontend build must set `NEXT_PUBLIC_API_BASE_URL` to the Render API origin; production code will not fall back to localhost if it is missing. The API uses the hosting provider's `PORT` by default, with `API_PORT` as an explicit override.
