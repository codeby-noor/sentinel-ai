# SENTINEL AI — AI-Powered Incident Intelligence & Developer Operations Platform

Monitors services, ingests structured logs, auto-creates deduplicated incidents, investigates probable root causes with an external AI provider (graceful fallback when unconfigured), and coordinates resolution with runbooks, assignments, comments, notifications, analytics, and realtime updates.

> **Demonstration environment:** the seed script creates clearly-labelled **demo** data (`user123@gmail.com / user@123`, MEMBER of Demo Org): 5 services, 6 realistic incidents (payment latency, auth errors, DB pool exhaustion, notification backlog, inventory sync, vendor timeouts — statuses OPEN/ACKNOWLEDGED/INVESTIGATING/RESOLVED/REOPENED, all titled “…(demo)”), supporting logs, timelines, and remediation notes. The UI carries a persistent “Demonstration environment” banner. Seeded demo data is never presented as live production telemetry — all dashboard/analytics numbers are computed from stored records (see “How metrics are calculated” on the Analytics page).

## Architecture

```
apps/web  Next.js 14 (React 18, App Router, custom CSS, recharts)
   │  cookie session (credentials: include) + X-Org-Id header
   ▼
apps/api  NestJS 10 (REST /api/v1 + SSE stream + Socket.IO gateway)
   │  Prisma ORM → PostgreSQL 16 · BullMQ → Redis 7 (with in-process fallback)
   └── OpenAI-compatible chat API (server-side only, redacted, validated JSON)
```

**Main data flows**

- **Health checks:** `QueueService` tick → BullMQ `health-checks` job (or in-process) → `GET service.healthCheckUrl` with timeout → `HealthCheck` row → update `Service.status/latency/consecutiveFails` → on threshold breach, upsert one `Incident` per `dedupKey=health:{serviceId}` → SSE/WS `incident.created`.
- **Log ingestion:** `POST /ingest/events` (X-API-Key, hashed storage, 120/min/org rate limit) → validate → `LogEvent` row → CRITICAL (or HIGH+stack) auto-creates/dedups incident.
- **Incidents:** state machine enforced server-side (`OPEN→ACKNOWLEDGED→INVESTIGATING→RESOLVED`, `RESOLVED→REOPENED`); every mutation writes `IncidentActivity`; assignments create `Notification`s.
- **AI investigation:** gathers logs/history/runbooks → `redactSecrets()` → OpenAI-compatible `chat/completions` with `response_format: json_object` → `AiInvestigationSchema` (zod) validation → persisted as `AiInvestigation`. Never executes actions. When `OPENAI_API_KEY` is empty, returns an honest “not configured” message.
- **Realtime:** `EventsService` fan-out → `GET /events/stream` (SSE) + `EventsGateway` (Socket.IO `subscribe`).

## Features

- Auth (register/login/cookie session/logout), organizations, Owner/Admin/Member RBAC, invites, profile
- Dashboard (real DB metrics, trend + severity charts, time filters via analytics range)
- Services (CRUD, archive, health-check config, latency/availability history, linked incidents/logs)
- Log ingestion (API keys hashed, pagination/filter/search, safe text rendering, rate limiting)
- Incidents (deduplication, lifecycle, assignments, comments, activity timeline, reopen)
- AI root-cause analysis (structured output: summary, probable cause, evidence refs, hypotheses, confidence+note, next steps, remediation, warnings)
- Runbooks (CRUD, search, category/service organization)
- Team (members, roles, notifications, activity)
- Analytics (MTTA/MTTR/error-rate/latency with documented methods)
- Security: bcrypt, JWT httpOnly cookies, org-scoped guards on every query, helmet, CORS allowlist, ValidationPipe, safe error filter (no stack leakage), audit events, secret redaction

## Quickstart (Docker — recommended, verified 2026-10-10)

Requirements: Docker + Docker Compose (verified with Docker 29.8.2 / Compose v5.5.1).

```bash
cp .env.example .env
# Generate a strong JWT secret (required — compose refuses to start without it):
node -e "const fs=require('fs');let s=fs.readFileSync('.env','utf8');s=s.replace(/^JWT_SECRET=.*$/m,'JWT_SECRET='+require('crypto').randomBytes(32).toString('hex'));fs.writeFileSync('.env',s)"
docker compose config   # validates interpolation (expects no errors)
docker compose up --build -d
docker compose ps       # all four services should reach Up (healthy)
# web: http://localhost:3000 · api health: http://localhost:4000/api/v1/health
docker compose exec -T api npm run prisma:seed   # idempotent demo data
```

Demo login: `user123@gmail.com / user@123` (Use-demo-account fill button on the login page; seeded MEMBER of Demo Org). Seeded admin also works: `demo@sentinel.dev / Sentinel123!`.

Password rule: new passwords (registration and reset) must be **exactly 8 characters** (`Password must be exactly 8 characters.`), enforced on frontend and backend with bcrypt hashing (12 rounds). Existing longer passwords keep working for login.

Password reset: `Forgot password?` on the login page → generic confirmation (never reveals account existence) → short-lived (30 min), single-use token stored as SHA-256 hash only; reset bumps a session version that revokes prior JWTs (HTTP + WebSocket). Rate-limited (5/15 min per IP for requests, 10/15 min for confirmations). Without SMTP configured, development builds expose a dev-only reset link in the forgot-password response (never in production); set `SMTP_HOST/PORT/USER/PASS/FROM` for real delivery.

Verified boot sequence: `postgres` + `redis` reach healthy → `api` runs `prisma migrate deploy` (migration `0001_init`, zero-drift verified against the schema) then starts NestJS with BullMQ on Redis → `web` serves Next.js. All four services expose Docker healthchecks (`docker compose ps` shows `healthy`).

## Local development (without Docker)

Requirements: Node 20+, a PostgreSQL 16 database, Redis 7 (optional — falls back to in-process scheduler).

```bash
cp .env.example .env   # edit DATABASE_URL, JWT_SECRET
npm install --prefix apps/api && npm install --prefix apps/web
npx --prefix apps/api prisma generate
npx --prefix apps/api prisma migrate deploy
npm run prisma:seed --workspace=apps/api
npm run dev            # api :4000 + web :3000 (root uses concurrently)
```

End-to-end smoke test:

1. Register → organization auto-created → select org in topbar.
2. Services → Add service with a health-check URL.
3. Logs → Create API key → `POST /api/v1/ingest/events` with `X-API-Key`:
   ```json
   { "severity": "CRITICAL", "message": "DB pool exhausted", "environment": "production" }
   ```
4. Incidents → new incident appears (deduplicated) → acknowledge → comment → AI investigate → resolve.
5. Analytics → verify MTTA/MTTR/error-rate update.

## Environment

See `.env.example` (placeholders only — never commit real secrets). Key vars: `DATABASE_URL`, `REDIS_URL` (optional), `JWT_SECRET` (≥32 chars), `CORS_ORIGIN`, `OPENAI_API_KEY`/`OPENAI_MODEL`/`OPENAI_BASE_URL` (optional), health-check tuning, `NEXT_PUBLIC_API_BASE_URL`.

## Testing

```bash
npm test --workspace=apps/api        # Jest unit/integration (mocked Prisma — no DB or AI cost)
npm test --workspace=apps/web        # Jest + Testing Library (jsdom)
npm run test:e2e --workspace=apps/web  # Playwright Chromium (needs: npx playwright install chromium)
```

Automated coverage: auth validation, org isolation, service CRUD scoping, health/incident dedup, lifecycle transitions, log validation + rate limits, analytics math (incl. empty-data nulls), AI schema validation + timeout/failure handling, error-shape safety, responsive/a11y E2E.

### Verified results (2026-10-10, Windows 11, Node 20 containers / Node 24 host)

| Check | Result |
|---|---|
| API `tsc --noEmit` | ✅ pass |
| API Jest | ✅ 7 suites / 37 tests pass (incl. exact-8 rule, reset-token lifecycle, seed idempotency) |
| Web `tsc --noEmit` | ✅ pass |
| Web Jest | ✅ 11 tests pass (incl. register/login/forgot/reset form validation) |
| API `nest build` + Web `next build` (12 routes) | ✅ pass |
| `prisma validate` | ✅ schema valid |
| Migration zero-drift (`migrate diff` migrations ↔ schema) | ✅ empty migration |
| Docker `api`/`web`/`postgres`/`redis` | ✅ all `Up (healthy)` |
| API `/health` | ✅ `{"ok":true,"db":"up","queue":{"mode":"bullmq+redis"}}` |
| Live flow harness (login, service CRUD, key issue, CRITICAL ingest → incident, ack → comment → resolve, invalid transition 400, analytics, AI fallback, frontend 200) | ✅ 15/15 |
| Live auth harness (user123 demo login, register exact-8/7/9/mismatch/duplicate, forgot generic ± dev link, reset + session revocation + reuse rejection) | ✅ 15/15 + 7/7 dev-flow |
| Playwright E2E (Chromium) | ✅ 8/8 (auth pages, demo fill, mobile overflow) |
| `npm audit --omit=dev` | ⚠️ API: 21 vulns (2 low / 10 moderate / 9 high, incl. `ws` DoS chain); Web: 4 (3 high / 1 critical, PostCSS via Next 14.2.18). Fixes require breaking major upgrades — intentionally deferred, see Limitations. |

## Production build & deploy

```bash
npm run build --workspace=apps/api && npm run build --workspace=apps/web
```

- API `Dockerfile` runs `prisma migrate deploy` on boot; set `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`, `COOKIE_SECURE=true` behind HTTPS.
- Web `Dockerfile` is a standalone Next.js build; set `NEXT_PUBLIC_API_BASE_URL` to the public API origin.
- CI (`.github/workflows/ci.yml`) runs typecheck, tests, and web production build on every PR.

## API reference (base `/api/v1`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | `{name,email,password,orgName}` → sets session cookie |
| POST | `/auth/login` | — | `{email,password}` |
| GET | `/auth/me` | cookie | user + memberships |
| POST | `/orgs` | cookie | create org (become OWNER) |
| GET/POST | `/orgs/:id/members` | cookie+X-Org-Id | list / invite (Owner/Admin) |
| GET/POST | `/services` | cookie+X-Org-Id | list / create |
| GET/PATCH | `/services/:id` | cookie+X-Org-Id | detail (checks+incidents+logs) / update |
| GET/POST | `/api-keys` | cookie+X-Org-Id | manage ingestion keys (plaintext shown once) |
| POST | `/ingest/events` | X-API-Key | ingest log event |
| GET | `/logs` | cookie+X-Org-Id | paginated `?severity&serviceId&env&search&from&to&page` |
| GET/POST | `/incidents` | cookie+X-Org-Id | list / create (deduped) |
| PUT | `/incidents/:id/status` | cookie+X-Org-Id | state-machine transition |
| POST | `/incidents/:id/comments` | cookie+X-Org-Id | note |
| POST | `/incidents/:id/investigate` | cookie+X-Org-Id | AI investigation (or not-configured message) |
| GET/POST | `/runbooks` | cookie+X-Org-Id | list (search) / create |
| GET | `/analytics/overview?from&to` | cookie+X-Org-Id | metrics + methods |
| GET | `/analytics/dashboard` | cookie+X-Org-Id | dashboard bundle |
| GET | `/events/stream?orgId=` | cookie (SSE) | realtime incident/service events |
| GET | `/notifications` | cookie | inbox |

## Limitations (honest)

- No claimed “production-secure” status. Verified controls: bcrypt (12 rounds), httpOnly + SameSite=Lax session cookies (Secure in prod), CORS allowlist, helmet, global `ValidationPipe` (whitelist + forbid), `JwtAuthGuard` + `OrgGuard` on every org route with organization-scoped queries as second layer, SHA-256-hashed ingest keys (plaintext shown once, revocation supported), safe error filter (no stack leakage), AI secret redaction before external calls, JWT fail-fast (no fallback secret). Remaining gaps: rate limiting is in-memory (use Redis-backed limiting + WAF for multi-instance), CSRF relies on SameSite=Lax (add double-submit tokens for high-risk deployments), audit coverage is core actions only, `GET /health` is unauthenticated (returns only status counters).
- Known vulnerable dependencies (verified via `npm audit`, fixes deferred as breaking changes): API `ws` DoS chain via `@nestjs/platform-socket.io` (fix: v12 major); Web PostCSS CVEs via Next 14.2.18 (fix: Next 16 major). Mitigations until upgraded: run behind a reverse proxy/WAF, keep the apps on a private network, track advisories GHSA-96hv-2xvq-fx4p, GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849.
- Semantic/embedding search over runbooks is **not** implemented (plain `contains` search); pgvector wiring is intentionally deferred until core flows are solid.
- Availability % is derived from stored health-check rows only — no synthetic uptime is invented.
- AI investigation has **not** been tested against a live provider (no `OPENAI_API_KEY` configured); only the graceful-fallback path is verified. Set the key server-side and exercise “AI investigate” before demoing AI output.
- E2E tests cover static/accessibility flows against the running stack; destructive/edge flows (volume loss, Redis outage) are untested.
- Local dev default DB password (`sentinel_dev_password`) ships in compose/`.env.example` for convenience — use managed Postgres + unique credentials in any shared environment.

## Screenshots

Capture from the running stack (`demo@sentinel.dev / Sentinel123!`) and save under `docs/screenshots/` (1280px desktop + 375px mobile for the dashboard):

1. `01-dashboard.png` — operations overview with KPIs, trend + severity charts
2. `02-incident-ai.png` — incident detail showing an AI investigation (or the honest not-configured state)
3. `03-services.png` — service list with health statuses
4. `04-analytics.png` — metrics + “How metrics are calculated” panel
5. `05-mobile.png` — dashboard at 375px width (no horizontal overflow)

Reference the images here once added. No screenshots are committed yet.
