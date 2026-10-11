# Vertigo Gear

Gear inventory, packing lists and production plans for Vertigo. Self-hosted,
multi-user, works on a phone in the warehouse and a laptop in the office.

Status: **Phase 0 (skeleton)**. Login, roles, database, tests, CI and Docker
work. Inventory arrives in Phase 1. See `PLAN.md` for the roadmap.

## Quick start (development)

Requirements: Node 22+, Docker.

```bash
git clone https://github.com/vertigojeppe/vertigo-gear-management.git
cd vertigo-gear-management
cp .env.example .env            # set AUTH_SECRET: openssl rand -base64 32
docker compose up -d db         # Postgres on localhost:5432
npm install
npm run db:migrate              # create tables
npm run db:seed                 # demo data
npm run dev                     # http://localhost:3000
```

Demo users (password `vertigo123`, or whatever `SEED_PASSWORD` is):

| Email | Role |
|---|---|
| admin@vertigo.test | admin |
| member@vertigo.test | member |
| viewer@vertigo.test | viewer |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run test` | Unit and integration tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright, starts the app itself) |
| `npm run db:migrate` | Create and apply a migration in dev |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Re-runnable demo data |
| `npm run db:reset` | Drop, migrate, seed (dev only) |
| `npm run db:studio` | Prisma Studio |

## Deployment

### Docker Compose (recommended)

```bash
cp .env.example .env            # set AUTH_SECRET, APP_URL, POSTGRES_PASSWORD
docker compose --profile prod up -d --build
```

Runs the app and Postgres with named volumes for the database and uploads.
Migrations are applied automatically on container start. Put a reverse
proxy with TLS (Caddy, nginx, Traefik) in front of port 3000.

### Hetzner / any VPS

1. Install Docker (`curl -fsSL https://get.docker.com | sh`).
2. Clone the repo, create `.env`, run the Compose command above.
3. Point a DNS name at the server and add Caddy:
   ```
   gear.example.dk {
     reverse_proxy localhost:3000
   }
   ```
4. Backups: see below.

### Vercel + managed Postgres

Works with limitations: set `DATABASE_URL` to a managed Postgres (Neon,
Supabase, …), `STORAGE_DRIVER=s3` with R2/MinIO credentials, and run
`npx prisma migrate deploy` as a build step. PDF thumbnails are unavailable
there (no poppler). Detailed steps follow in Phase 5.

## Backup

Database: `docker compose exec db pg_dump -U vertigo vertigo_gear > backup.sql`.
Uploads: the `uploads` volume (`docker volume inspect` for the path).
Full JSON backup/restore from the UI arrives in Phase 5.

## Project docs

- `PLAN.md` — data model, phases, decisions taken
- `CLAUDE.md` — conventions for working on the code
- `DECISIONS.md` — why
- `BACKLOG.md` — ideas
- `docs/ARCHITECTURE.md` — architecture and data model diagram
