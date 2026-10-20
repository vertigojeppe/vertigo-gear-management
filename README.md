# Vertigo Gear

Gear inventory, packing lists and production plans for Vertigo. Self-hosted,
multi-user, works on a phone in the warehouse and a laptop in the office.

Status: **in production use.** Inventory with families and variants,
kits, asset tags and labels; projects with availability and conflict
warnings; external rentals; packing lists with check-out and check-in;
production plans with documents, 3D viewers and markup; pricing with rate
tables and quote PDFs; calendar feeds and Google push; the old
spreadsheet importer; CSV export and whole-database backup. Danish and
English. Ideas and follow-ups live in `BACKLOG.md`. The roadmap and what is done is in `PLAN.md`; why things
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
- **On the phone**: the app installs on the home screen. iPhone: open it
  in Safari, Share › *Add to Home Screen*. Android: Chrome offers
  *Install* (the app also shows the hint). It then opens full-screen with
  its own icon, the camera scanner works, and the home-screen icon has
  shortcuts to Scan, Projects and Inventory. Packing lists you have
  opened stay readable on the phone without a connection (as they were
  when last opened; ticking needs a connection); everything else shows an
  offline page that lists them. Nothing else is cached.
- **Settings › Extra fields**: add your own fields to models and items,
  for every category or just one (projectors get lumen and throw ratio,
  LED controllers get IP and firmware, and so on).
- **Settings › Contacts**: people and companies who are not users. A
  contact or a colleague can be a *person* location ("Mikkel has 2").
- **Colours**: admins give each top category a colour under Inventory ›
  Categories; it shows as a bar in the inventory list, the gear picker and
  packing lists. Cables carry tape by length, so the same page has a
  length → colour table (2,5 m blue, 5 m red, …) and the matching dot
  appears next to each cable size. Screen only, never printed.
- **Consumables and spare parts**: tick *Consumable* on a model for lamps,
  LED strip, alu profile and the like. Count it in pieces (bins, like any
  bulk gear) or in metres (receive a reel, use what you cut, count the
  shelf). *Use* takes it off the stock and can name the unit it went into,
  so that unit's history says "lamp replaced", and the project. Link a part
  to the models it fits with a rule ("1 per 4 units, at least 1"); the
  model page lists its spare parts. Set a minimum and the dashboard lists
  what is running low, with a button to put it on the wish list.
- **Inventory › Wish list**: gear to buy, with quantity, expected price,
  link and notes. When it arrives, *Convert to model* opens the new-model
  form prefilled; the wish is marked bought and points at the model.
- **Inventory › Sub-hire**: gear partners own that you rent in (the
  GearGuys lenses), with owner, cost and your day price. *Rent in* on a
  project puts it on the quote (priced like your own gear, owner named)
  and under *Rented in* on the packing list, its PDF and the shared view.
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
- **My day** on the dashboard: what is on today and tomorrow on your
  projects, your open tasks (overdue first, tick them off right there), and
  the projects you are booked on this week with your call time. "My plan
  (PDF)" prints the schedule with only your tasks and call time.
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

Our chosen route is the first section below: a mini PC at the office
behind a Cloudflare Tunnel. The VPS and Vercel sections after it still
work and stay documented.

### Self-hosting at the office (mini PC + Cloudflare Tunnel) — our chosen route

A small always-on PC at the office runs the same Compose stack. It stays
reachable from the internet over HTTPS without opening a single port on
the office network: `cloudflared` makes outbound connections to
Cloudflare, Cloudflare terminates TLS for `gear.vertigo.dk` (our DNS is
there already) and forwards requests through the tunnel to the app
container. The tunnel is free.

**Hardware.** A mini PC with 8 GB RAM (4 GB is the minimum), a 256 GB or
larger SSD and a wired network port. In the BIOS set "power on after
power loss" (often under power management or ACPI) so it comes back
after an outage; a small UPS is worth it, since a load-in does not wait
for a reboot. Add swap: the Next.js build during `--build` can run out
of memory on 4 GB.

1. Install Ubuntu Server 26.04 LTS (OpenSSH on, nothing else), then
   Docker and automatic security updates. Use the LTS release, not an
   interim ".10" one: LTS gets security updates until 2031, an interim
   release only for nine months. If the Docker install script below
   finishes without errors, Docker supports the release.

   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo adduser deploy && sudo usermod -aG docker deploy
   sudo apt install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades
   ```

   Swap (4 GB; use 2G on a 4 GB machine with a small disk):

   ```bash
   sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

2. **Get the code onto the server.** The repository is public, so cloning
   needs no GitHub login. Log in with the user you created in the Ubuntu
   installer (it can use `sudo`; `deploy` cannot), either at the
   server's keyboard or from your PC with `ssh yourname@<server address>`.
   Make the folder and hand it to `deploy`, then become `deploy`:

   ```bash
   sudo mkdir -p /opt/vertigo-gear
   sudo chown deploy:deploy /opt/vertigo-gear
   sudo -iu deploy
   ```

   The prompt now starts with `deploy@`. Clone into the folder and go
   there:

   ```bash
   git clone https://github.com/vertigojeppe/vertigo-gear-management.git /opt/vertigo-gear
   cd /opt/vertigo-gear
   docker ps
   ```

   `docker ps` should print an empty table. If it says "permission
   denied", `deploy` is not in the `docker` group yet: type `exit`, run
   `sudo usermod -aG docker deploy`, and `sudo -iu deploy` again. If
   `git` is missing, `exit` and run `sudo apt install -y git` first.

3. **Write the settings file.** Every setting lives in `.env` in that
   folder. Start from the example and make it private:

   ```bash
   cp .env.example .env
   chmod 600 .env
   ```

   Make two random secrets and keep the window open so you can copy
   them:

   ```bash
   openssl rand -base64 32
   openssl rand -hex 24
   ```

   The first line is for `AUTH_SECRET`, the second for
   `POSTGRES_PASSWORD`. The database password must be the hex one: it
   ends up inside a database address, where the `+`, `/` and `=` of the
   other kind break the connection. Now open the file:

   ```bash
   nano .env
   ```

   Move with the arrow keys and change these lines (leave everything
   else as it is):

   | Line | Set it to |
   |---|---|
   | `POSTGRES_PASSWORD=` | the hex secret |
   | `AUTH_SECRET=` | the base64 secret, inside the quotes |
   | `APP_URL=` | `"https://gear.vertigo.dk"` |
   | `# CLOUDFLARE_TUNNEL_TOKEN=` | remove the `# ` and leave it empty for now; the token comes in step 4 |

   Save with Ctrl+O and Enter, and close with Ctrl+X. The lines you
   changed should now look like this (with your own values):

   ```
   POSTGRES_PASSWORD=4f1c0e9a7b2d...
   AUTH_SECRET="Zk9Qx...="
   APP_URL="https://gear.vertigo.dk"
   CLOUDFLARE_TUNNEL_TOKEN=
   ```

   Leave these alone: `DATABASE_URL` (Compose gives the app the real
   one, built from `POSTGRES_PASSWORD`), `APP_DOMAIN` and `CADDYFILE`
   (Caddy is not used here), `APP_BIND` (the app stays on 127.0.0.1; the
   tunnel reaches it inside Docker) and `SEED_PASSWORD` (demo data for
   development only). Choose the database password now: it is fixed the
   first time the database starts, and changing the line later does not
   change the database. `.env` holds every secret of the installation;
   never paste it anywhere or commit it.

4. **Create the tunnel in Cloudflare.** In the Cloudflare dashboard, open
   *Zero Trust* (the first visit asks you to pick a plan: choose *Free*),
   then *Networks › Tunnels › Create a tunnel*. Choose *Cloudflared*, name
   it (say `vertigo-gear`) and save. The next page shows install
   commands; skip them, and copy only the long string after `--token`.
   Paste it into `.env`:

   ```bash
   nano .env
   ```

   `CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...` on one line, no quotes needed.
   Back in the dashboard, go to the tunnel's *Public Hostname* tab and add
   one: subdomain `gear`, domain `vertigo.dk`, service type **HTTP**,
   URL `app:3000`. Cloudflare creates the DNS record for
   `gear.vertigo.dk` by itself. The token is the whole credential for the
   tunnel: if it ever leaks, rotate it in the same dashboard.

5. **Start it.** Still as `deploy` in `/opt/vertigo-gear`:

   ```bash
   docker compose --profile tunnel up -d --build
   ```

   The first run builds the app image, which takes 5 to 15 minutes. Then
   check that everything runs:

   ```bash
   docker compose --profile tunnel ps
   ```

   `db` and `app` should say *healthy* (the app needs a minute after the
   build) and `cloudflared` *running*. The tunnel turns *Healthy* in the
   Cloudflare dashboard. If something is wrong, the logs say why:
   `docker compose logs app` or `docker compose logs cloudflared`.

6. **Create your admin user.** The database starts empty, without demo
   data. Create the first admin with your own email and name; it asks
   for a password twice:

   ```bash
   docker compose exec app node scripts/create-admin.mjs you@vertigo.dk "Your Name"
   ```

   Open https://gear.vertigo.dk on your phone or PC and sign in. Add your
   colleagues under Settings › Users, and bring in the old spreadsheet
   under Settings › Import. Running the same command again resets that
   user's password, which is also the way back in if the last admin
   forgets theirs. Do not run `db seed` on the server: it loads the demo
   gear and projects.

7. **Finish in Cloudflare.** Under *SSL/TLS › Edge Certificates*, switch
   on *Always Use HTTPS* and HSTS. They replace the security headers Caddy
   adds in the other setups.

**HTTPS and proxy headers.** Cloudflare terminates TLS, so Caddy's
Let's Encrypt setup cannot be used as is; the `tunnel` profile therefore
runs `cloudflared` straight to the app on plain HTTP inside the Compose
network, and the `prod` profile (Caddy) is unchanged. The app was
checked for life behind a proxy:

- Scheme and host come from `X-Forwarded-Proto` / `X-Forwarded-Host`
  (`src/lib/request-origin.ts`), which Cloudflare sets, so login
  redirects go to `https://gear.vertigo.dk`.
- Auth.js runs with `trustHost` and reads the same headers, so the
  session cookie is marked *Secure*. No `AUTH_URL` is needed.
- The login rate limiter keys on the first address in `X-Forwarded-For`,
  which Cloudflare sets to the visitor, so one locked-out phone does not
  lock the whole internet out. The app container is not reachable except
  through the tunnel, so the header cannot be forged from outside.
- Cloudflare's free plan caps a request body at 100 MB. Document uploads
  go up in small chunks and the other forms accept 25 MB, so nothing hits
  it; keep that in mind before raising `MAX_UPLOAD_MB` elsewhere.
- QR codes and share links use the address the page was opened on, so
  they carry `https://gear.vertigo.dk` whether printed at the office or
  at a venue.

**Backups.** Copies must leave the building. Set `BACKUP_REMOTE` to an
rclone remote (Cloudflare R2 or Backblaze B2 are cheap; `rclone config`
once as `deploy`) and run `scripts/backup.sh` nightly from cron:

```
10 3 * * * cd /opt/vertigo-gear && ./scripts/backup.sh >> backups/backup.log 2>&1
```

On a small disk keep `BACKUP_KEEP_DAYS` low (3 to 7); the remote keeps
the history. Restore one archive on a laptop with `scripts/restore.sh`
every few months so the procedure is known before it is needed.

**Updating.**

```bash
cd /opt/vertigo-gear && git pull && docker compose --profile tunnel up -d --build
```

The GitHub Actions deploy workflow (`deploy.yml`) needs to reach the
server over SSH, which it cannot behind a tunnel, so it does not apply
here: update by hand as above, or leave the `DEPLOY_*` secrets unset and
the workflow simply fails to connect and does nothing.

**Checklist for the IT team.**

- Is outbound HTTPS (443) and port 7844 (TCP and UDP) to Cloudflare
  allowed from the server? That is the only network permission the tunnel
  needs; nothing inbound.
- Can the server get a wired port and a reserved internal IP?
- Can it sit on its own network segment (VLAN), separate from the office
  computers?
- Is a UPS or other power protection available, and are power outages
  or maintenance windows planned?
- Who is responsible for security and updates of the server (OS updates
  are automatic; Docker and the app are updated by us)?
- If a tunnel is refused: can ports 80 and 443 be forwarded to the server
  instead, and is the office IP public and fixed (not behind CGNAT)? Then
  the VPS section applies unchanged, with `--profile prod`.

**Trade-offs.** Self-hosting saves the monthly VPS, and nothing of ours
runs on someone else's machine. In return the mini PC is a single point
of failure during load-ins: uptime, backups and security are our
responsibility, and a dead disk or a power cut at the office takes the
app down until someone is there. The off-site backup plus a spare
machine that can be restored in an hour is the mitigation; a VPS stays
the fallback and is a one-line change.

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
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` (hex: it goes into a database URL) |

Then:

```bash
docker compose --profile prod up -d --build
docker compose exec app node scripts/create-admin.mjs you@vertigo.dk "Your Name"   # first time only
```

Caddy requests the certificate from Let's Encrypt on first start (give it a
minute) and renews it by itself. Migrations run every time the app
container starts. The database starts empty: `create-admin.mjs` makes
your admin (it asks for the password; running it again resets it), and
you add everyone else under Settings › Users. Use a hex password for
`POSTGRES_PASSWORD` (`openssl rand -hex 24`): it goes into a database
URL, where `+`, `/` and `=` break the connection.

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
It needs SSH access to the server, so it does not apply to the office
setup behind a Cloudflare Tunnel (see above).

### Hetzner (or any VPS), step by step

1. Create a server with Ubuntu: a CX23 (2 vCPU, 4 GB, 40 GB) is plenty;
   CX33 (4 vCPU, 8 GB, 80 GB) or the CPX22 / CPX32 are the alternatives,
   and a plan can be sold out in some locations. In the firewall allow
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
