# Vertigo Gear

Gear inventory, packing lists and production plans for Vertigo. Self-hosted,
multi-user, works on a phone in the warehouse and a laptop in the office.

Status: **in production use.** Inventory with families and variants,
kits, asset tags and labels; projects with availability and conflict
warnings; external rentals; packing lists with check-out and check-in;
production plans with documents, 3D viewers and markup; pricing with rate
tables and quote PDFs; calendar feeds and Google push; the old
spreadsheet importer; CSV export and whole-database backup. Danish and
English. Still to come: the sub-hire catalog
(`BACKLOG.md`). The roadmap and what is done is in `PLAN.md`; why things
are the way they are in `DECISIONS.md`.

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

## What you can do

Every screen has an empty state that says what goes there and how to
start, and help text under the fields that need it. The short version:

- **Inventory › Categories / Locations**: build your category tree and
  warehouse zones.
- **Inventory › Models**: one entry per product (manufacturer, model,
  specs, links, photo). Choose *serialized* (one record per unit) or *bulk*
  (tracked by quantity).
- **Models › Add items**: create units in one go with serial numbers;
  every unit gets an asset tag like `VG-0042` and a QR code.
- **Item page**: change status (reason required for repair/missing/retired),
  move, put into a kit, attach photos/invoices/manuals, see history.
- **Labels**: "Print labels" on the item list (whatever the filters show),
  on a model (all its units) and on a unit. Avery L7160 sheets (21 per
  A4, with a "skip the used ones" field) or 62 × 29 mm thermal labels,
  one per page. Each label carries the QR code, the asset tag and the
  model. Sizes live in `config/app.config.ts`.
- **Scan** (phone): point the camera at a tag, or type it. Browsers only
  allow the camera over HTTPS (or localhost), so in production put the app
  behind HTTPS and in development use `npm run dev:https`.
- **Settings › Extra fields**: add your own fields to models and items,
  for every category or just one (projectors get lumen and throw ratio,
  LED controllers get IP and firmware, and so on).
- **Settings › Contacts**: people and companies who are not users. A
  contact or a colleague can be a *person* location ("Mikkel has 2").
- **Inventory › Wish list**: gear to buy, with quantity, expected price,
  link and notes. When it arrives, *Convert to model* opens the new-model
  form prefilled; the wish is marked bought and points at the model.
- **Purchases** on a model (admins and members with the finance
  permission): supplier, date, quote or order number, quantity, list
  price, discount and net price, with the quote PDF attached to the
  record. The importer fills these from the truss supplier quotes.
- **Not for rental**: flag a model or a unit as own-projects-only; the
  rentals screens refuse it. Retiring an item asks whether it was sold,
  scrapped or lost; own-built fixtures can sit as *under construction*.
- **Pricing and quotes**: every model has a rental day price. Settings ›
  Pricing holds the rate tables (days → factor; Standard, Theatre and
  Revised from the old sheet). A project or rental picks a table, can
  override the charged days, add freight / insurance / crew lines and a
  discount, and prints a quote (projects) or rental agreement (rentals)
  with totals excl. and incl. VAT.
- **Settings › Import**: upload the old gear spreadsheet. You get a
  preview first: what imports as is, what imports with a stated guess,
  what needs your decision, and what is parked for later features. Nothing
  is written until you confirm, and importing the same file again adds
  nothing. Every imported row remembers its sheet cell.
- **Export CSV** on every list (models, items, projects, rentals,
  contacts) with the filters you have set; semicolon-separated so Danish
  Excel opens it straight away.
- **Settings › Backup** (admins): the whole database as one JSON file,
  and a restore that replaces everything with such a file. Uploaded files
  are not inside; `scripts/backup.sh` on the server bundles both.
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

The app is one container next to Postgres, with Caddy in front for HTTPS.
Everything is configured through `.env`; nothing secret is in the
repository. It is meant to be reachable from the internet (warehouse
phones, venues, freelancers): every route is behind login except share
links and iCal feeds, the login form is rate-limited, and Caddy serves
HTTPS only.

### Docker Compose with automatic HTTPS (recommended)

On a server with Docker, a DNS name pointing at it, and ports 80 and 443
open:

```bash
git clone https://github.com/vertigojeppe/vertigo-gear-management.git /opt/vertigo-gear
cd /opt/vertigo-gear
cp .env.example .env
```

Set in `.env`:

| Variable | Value |
|---|---|
| `APP_DOMAIN` | the DNS name, e.g. `gear.vertigo.dk` (on a LAN: the machine name, see below) |
| `APP_URL` | `https://gear.vertigo.dk` (encoded in QR labels and feeds) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | a long random password |
| `SEED_PASSWORD` | the first admin's password (used once, see below) |

Then:

```bash
docker compose --profile prod up -d --build
docker compose exec app node node_modules/prisma/build/index.js db seed   # first time only: creates the admin
```

Caddy requests the certificate from Let's Encrypt on first start (give it a
minute) and renews it by itself. Migrations run every time the app
container starts. Sign in as `admin@vertigo.test` with `SEED_PASSWORD`,
create your own user under Settings › Users, then delete the demo users.

The database listens on the server only (127.0.0.1); the app container
is not exposed except through Caddy. `GET /api/health` answers `{ "ok":
true }` when the app reaches its database; Compose restarts the
container when it does not.

### Office server on the LAN (no public DNS name)

The same stack runs on a machine in the office that is not reachable from
the internet. Let's Encrypt cannot issue a certificate for a name the
internet does not know, so Caddy signs one itself; phones need that
certificate installed once, or the camera scanner stays off (browsers
only open the camera on HTTPS).

1. Give the machine a fixed name on the network (the router's DHCP
   reservation plus its hostname, say `gear`; `gear.local` works on most
   phones through mDNS).
2. In `.env`: `APP_DOMAIN=gear.local`, `APP_URL=https://gear.local`,
   `CADDYFILE=./Caddyfile.lan`. Then `docker compose --profile prod up -d
   --build` as above.
3. Export Caddy's root certificate and install it on every phone and
   laptop (iOS: AirDrop or mail the file, install the profile under
   Settings › General › VPN & Device Management, then enable it under
   Settings › General › About › Certificate Trust Settings; Android:
   Settings › Security › Install a certificate › CA certificate):

   ```bash
   docker compose --profile prod cp caddy:/data/caddy/pki/authorities/local/root.crt vertigo-gear-ca.crt
   ```

4. Print labels only after `APP_URL` is final: the QR codes carry it.

Without HTTPS at all (fine for laptops, no camera scanning on phones):
leave Caddy out, set `APP_BIND=0.0.0.0` and `APP_URL=http://gear.local:3000`,
and start only the database and the app: `docker compose --profile prod
up -d --build db app`.

### Updating

```bash
cd /opt/vertigo-gear && git pull && docker compose --profile prod up -d --build
```

Or let GitHub do it: `.github/workflows/deploy.yml` runs after CI passes on
`main` and performs the same commands over SSH. Add these repository
secrets (Settings › Secrets and variables › Actions): `DEPLOY_HOST`,
`DEPLOY_USER`, `DEPLOY_KEY` (a private key whose public half is in that
user's `~/.ssh/authorized_keys`), `DEPLOY_PATH` (`/opt/vertigo-gear`). The
workflow waits for the health check and prints the app log if it fails.

### Hetzner (or any VPS), step by step

1. Create a server (a CX22 with Ubuntu is plenty). In the firewall allow
   22, 80 and 443. Point `gear.vertigo.dk` (an A record) at its address.
2. SSH in and install Docker: `curl -fsSL https://get.docker.com | sh`.
   Create a user for the app: `adduser deploy && usermod -aG docker deploy`.
3. As `deploy`, clone the repository to `/opt/vertigo-gear`, create
   `.env` as above, and run the Compose command.
4. Enable backups (next section) with a cron line, and add the deploy
   secrets to GitHub if you want pushes to `main` to deploy.
5. Keep the server itself updated: `apt install unattended-upgrades`.

### Vercel + managed Postgres

The app runs on Vercel with a managed database and object storage, with
two gaps: PDF thumbnails and PDF pages in plan exports need poppler, which
Vercel does not have (documents are listed by name instead), and the
outbox worker needs a scheduler.

1. Create a Postgres database (Neon, Supabase, Vercel Postgres) and a
   bucket on Cloudflare R2 or another S3-compatible store.
2. Import the repository in Vercel. Set the environment variables from
   `.env.example`: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` (the Vercel
   domain), `STORAGE_DRIVER=s3` with the `S3_*` values, `CRON_SECRET`,
   `OUTBOX_DISABLED=1`.
3. Build command: `npx prisma generate && npx prisma migrate deploy && npm run build`.
4. Add a Vercel cron (`vercel.json`) that calls `POST /api/cron/outbox`
   every minute with `Authorization: Bearer <CRON_SECRET>` so webhooks and
   calendar pushes go out.
5. Seed once from your machine with `DATABASE_URL` pointing at the managed
   database: `npm run db:seed`.

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

## Backup and restore

`scripts/backup.sh` writes one archive with the database dump and every
upload to `backups/` (`BACKUP_DIR`), keeps `BACKUP_KEEP_DAYS` of them (14
by default), and, when `BACKUP_REMOTE` is set, copies each archive off-site
with [rclone](https://rclone.org) (Cloudflare R2, Backblaze B2, S3, Google
Drive) and prunes the remote the same way. Run it nightly:

```
10 3 * * * cd /opt/vertigo-gear && ./scripts/backup.sh >> backups/backup.log 2>&1
```

`scripts/restore.sh <archive>` stops the app, replaces the database and
the uploads with the archive's contents, and starts the app again
(migrations run if the code is newer than the backup). It asks for a
typed `yes` first. Test it on a fresh server now and then; a backup that
was never restored is a guess.
