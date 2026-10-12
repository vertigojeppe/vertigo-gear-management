# Vertigo Gear

Gear inventory, packing lists and production plans for Vertigo. Self-hosted,
multi-user, works on a phone in the warehouse and a laptop in the office.

Status: **Phase 2 (projects, availability, rentals, calendar)**. Everything
from Phase 1 plus clients, projects with phases and crew, gear reservations
with conflict warnings, a calendar timeline, external rentals with
agreement PDFs, iCal feeds, optional Google Calendar push, and webhooks.
Packing lists arrive in Phase 3. See `PLAN.md` for the roadmap.

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

## What you can do today

- **Inventory › Categories / Locations**: build your category tree and
  warehouse zones.
- **Inventory › Models**: one entry per product (manufacturer, model,
  specs, links, photo). Choose *serialized* (one record per unit) or *bulk*
  (tracked by quantity).
- **Models › Add items**: create units in one go with serial numbers;
  every unit gets an asset tag like `VG-0042` and a QR code.
- **Item page**: change status (reason required for repair/missing/retired),
  move, put into a kit, attach photos/invoices/manuals, see history.
- **Scan** (phone): point the camera at a tag, or type it. Browsers only
  allow the camera over HTTPS (or localhost), so in production put the app
  behind HTTPS and in development use `npm run dev:https`.
- **Settings › Extra fields**: add your own fields to models and items,
  for every category or just one (projectors get lumen and throw ratio,
  LED controllers get IP and firmware, and so on).
- **Settings › Contacts**: people and companies who are not users. A
  contact or a colleague can be a *person* location ("Mikkel has 2").
- **Not for rental**: flag a model or a unit as own-projects-only; the
  rentals screens refuse it. Retiring an item asks whether it was sold,
  scrapped or lost; own-built fixtures can sit as *under construction*.
- **Settings › Import**: upload the old gear spreadsheet. You get a
  preview first: what imports as is, what imports with a stated guess,
  what needs your decision, and what is parked for later features. Nothing
  is written until you confirm, and importing the same file again adds
  nothing. Every imported row remembers its sheet cell.
- **Settings › Users**: invite colleagues as admin, member or viewer.
- **Settings › Your account › API tokens**: call the REST API from other
  tools. Docs at `/api/docs`.
- **Projects**: a project has a client, venue, phase dates (prep, load-in,
  show, load-out, return), crew and contacts. **Reserve gear** per model for
  the project's dates; the app warns when not enough is available and shows
  who holds the rest. You can reserve anyway.
- **Calendar**: a timeline of projects and rentals; days where a model is
  over-booked are marked red, with the models listed below.
- **Rentals**: reserve gear for an external client with daily/weekly prices,
  assign the exact units, hand out and take back, print the agreement PDF.
- **Calendar feeds**: Settings › Calendar gives subscribe links for all
  projects, all rentals and "my jobs". Paste them into Google or Apple
  Calendar.
- **Webhooks**: Settings › Webhooks posts signed JSON to your URL on events
  such as a status change or a confirmed project.
- **Packing lists** (project page): start empty, from the project's
  reservations, from a template, or by copying another list. Add models,
  whole kits, or a template's lines; group by category or by case; see the
  weight, case and power totals; print the PDF.
- **Packing mode** (phone): tick units from a list, or scan a tag to tick
  that unit; bulk gear is taken from a bin by quantity. **Check out** moves
  everything ticked to the project. **Check in** records each unit as OK,
  damaged or missing; finishing marks whatever is still out as missing.
- **Share link**: a read-only page for the crew or the venue, no login
  needed. Revoke it when the job is done.
- **Packing templates** (Projects › Templates): reusable model lists, also
  savable from any packing list.
- **Production plan** (project page › Production plan): a day-by-day
  schedule with times, places and who is responsible; tasks by phase with
  assignee, due date and a big Done button; the project's crew with call
  times and its contacts; logistics such as vans, parking, dock info and
  hotels. Print a **day sheet** per day or the whole plan, and share a
  read-only link with the crew.
- **Plan templates** (Projects › Plan templates): a whole plan relative to
  the load-in day, applied to a project in one go; any plan can be saved
  as one.
- **Documents on the plan**: riders, stage plots, drawings, risk
  assessments and 3D models. Upload anything (chunked, so large files from
  a phone survive); uploading the same name again adds a version. Images
  and PDFs open inline with a **markup** layer (pen, arrow, box, text) that
  is saved separately and shows who drew it; glTF/GLB, OBJ and STL open in
  a 3D viewer with a measure tool; SketchUp, DWG, DXF, Vectorworks, AI and
  PSD are stored for download with an optional preview image. Pin a
  document to a schedule entry or task; it appears on that day sheet.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run dev:https` | Dev server over HTTPS (self-signed). Needed to test the camera scanner from a phone: open `https://<your-pc-ip>:3000` and accept the certificate warning |
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

## Google Calendar push (optional)

The app can create one event per project phase on a shared Google
Calendar, and one event per rental on a second calendar. Sync is one-way:
the app is the source of truth and never reads edits back from Google.

1. In [Google Cloud Console](https://console.cloud.google.com/), create a
   project (or use an existing one) and enable the **Google Calendar API**
   (APIs & Services › Library).
2. Create a **service account** (IAM & Admin › Service Accounts › Create).
   No roles are needed. Open it, go to **Keys › Add key › JSON** and
   download the key file.
3. In Google Calendar, create a calendar "Vertigo projects" (and optionally
   "Vertigo rentals"). Open its settings › **Share with specific people**
   and add the service account's email (`...@...iam.gserviceaccount.com`)
   with **Make changes to events**.
4. Still in the calendar settings, copy the **Calendar ID** from
   "Integrate calendar".
5. Put the key file next to the app (it is git-ignored) and set in `.env`:

   ```
   GOOGLE_SERVICE_ACCOUNT_JSON=./google-service-account.json
   GOOGLE_CALENDAR_ID_PROJECTS=<calendar id>
   GOOGLE_CALENDAR_ID_RENTALS=<calendar id>   # optional
   ```

   With Docker, mount the file into the container and point the variable at
   the mounted path, or paste the JSON itself as the value.
6. Restart the app. Settings › Calendar shows "Configured". Confirming a
   project, changing its dates or venue, or cancelling it queues a sync;
   the delivery queue is visible under Settings › Webhooks.

Crew members with a Google email on their user profile are added as
attendees. Service accounts can only invite attendees when the Workspace
admin grants domain-wide delegation; without it, events are created
without attendees and the sync still succeeds.

## Background work

Webhook deliveries and calendar pushes go through an outbox table processed
by a worker inside the app process every 15 seconds. On a host without a
long-running process (Vercel), set `CRON_SECRET` and have a scheduler call
`POST /api/cron/outbox` with `Authorization: Bearer <secret>` every
minute.

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
