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
docker compose exec api npm run prisma:seed   # demo only, skip in prod
```
