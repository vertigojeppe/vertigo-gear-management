# Vertigo Gear

Gear inventory, packing lists and production plans for Vertigo. Self-hosted,
multi-user, works on a phone in the warehouse and a laptop in the office.

Status: **in production use** at `gear.vertigo.dk`, on a mini PC at the
office behind a Cloudflare Tunnel. Danish and English, chosen per person.

More documents: `SPEC.md` (what it should do), `PLAN.md` (roadmap and
data model), `DECISIONS.md` (why things are the way they are),
`BACKLOG.md` (ideas and follow-ups), `CLAUDE.md` (conventions for
working on the code).

- [Quick start (development)](#quick-start-development)
- [What you can do](#what-you-can-do)
- [Scripts](#scripts)
- [Running the server](#running-the-server)
- [Other ways to host](#other-ways-to-host)

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

Admins must set up two-factor sign-in. To skip that in development, put
`TWO_FACTOR_REQUIRED_ROLES=none` in `.env`.

## What you can do

Every screen has an empty state that says what goes there and how to
start, and help text under the fields that need it. The short version:

### Inventory

- **Categories and locations** (Inventory › Categories / Locations): the
  category tree and the warehouse zones. A person can be a location too
  ("Mikkel has 2").
- **Models, families and variants.** A model is one product. Models with
  the same name form a *family*, and each model is one size of it
  ("DMX 5-pin" in 1 m, 5 m, 10 m). Stock, weight and prices belong to
  each size. The manufacturer is shown small after the name. Admins
  change a whole family at once with *Edit family* on the model page
  (name, manufacturer, category, flags). Choose *serialized* (one record
  per unit) or *bulk* (counted by quantity).
- **Serialized or bulk** can be switched later by an admin on the model
  page (*Convert to bulk* / *Convert to serialized*). The dialog lists
  exactly which asset tags merge, split or stay before anything changes.
- **Items**: *Add items* on a model creates units in one go. Every unit
  gets an asset tag like `VG-0042` and a QR code. On the item page you
  change its status (a reason is required for repair, missing and
  retired), move it, put it in a kit, attach photos, invoices and manuals,
  and see its history.
- **Search** forgives you: spaces, case, punctuation and accents do not
  matter ("qbase" finds "Q Base"), and a typo still finds close matches.
  Under Settings › Search words you list words that mean the same
  (arbejdslys = worklight), so either finds the other, even while you are
  still typing the word.
- **Sorting**: the inventory list sorts by name, category, manufacturer,
  most units, most out right now, most packed in the last 12 months,
  newest, day price or weight.
- **Labels**: *Print labels* on the item list (whatever the filters
  show), on a model (all its units) and on a unit. Avery L7160 sheets (21
  per A4, with a field for skipping used labels) or 62 × 29 mm thermal
  labels, one per page. Each label carries the QR code, the asset tag and
  the model. Sizes live in `config/app.config.ts`.
- **Colours**: admins give each top category a colour under Inventory ›
  Categories. It shows as a bar in the inventory list, the gear picker and
  packing lists. Cables carry tape by length, so the same page has a
  length → colour table (2,5 m blue, 5 m red, …), and the matching dot
  appears next to each cable size. Screen only, never printed.
- **Consumables and spare parts**: tick *Consumable* on a model for lamps,
  LED strip, alu profile and the like. Count it in pieces (bins, like any
  bulk gear) or in metres (receive a reel, use what you cut, count the
  shelf). *Use* takes it off the stock and can name the unit it went into
  (that unit's history then says "lamp replaced") and the project. Link a
  part to the models it fits with a rule ("1 per 4 units, at least 1").
  Set a minimum, and the dashboard lists what is running low, with a
  button to put it on the wish list.
- **Not for rental**: flag a model or a unit as own projects only, and
  the rental screens refuse it. Retiring an item asks whether it was
  sold, scrapped or lost. Own-built fixtures can sit as *under
  construction*.
- **Wish list** (Inventory › Wish list): gear to buy, with quantity,
  expected price, link and notes. When it arrives, *Convert to model*
  opens the new-model form prefilled, and the wish is marked bought.
- **Sub-hire** (Inventory › Sub-hire): gear partners own that we rent in,
  with owner, their price and ours.
- **Purchases** on a model (admins, and members with the finance
  permission): supplier, date, quote or order number, quantity, list
  price, discount and net price, with the quote PDF attached.
- **Extra fields** (Settings › Extra fields): your own fields on models
  and items, for every category or just one (projectors get lumen and
  throw ratio, LED controllers IP and firmware). Tick *Show in the
  inventory list* on a model field to see it on every row of the list,
  next to the weight and power draw.

### Projects and calendar

- **Projects**: client, venue, phase dates (prep, build-up, show,
  pack-down, return; build-up and pack-down can run over several days
  with one call time), crew and contacts.
- **Gear on projects is switched off for now**: reserving gear with
  availability warnings, renting in sub-hire gear, and the project
  quote. The data and code stay; see [Settings in `.env`](#settings-in-env)
  to turn it back on.
- **Calendar**: a timeline of projects and rentals with weekday names,
  week numbers and the year. Days where a model is over-booked are red,
  with the models listed below.
- **Calendar feeds** (Settings › Calendar): subscribe links for all
  projects, all rentals and "my jobs", for Google or Apple Calendar. The
  app can also push to a shared Google Calendar; see
  [Google Calendar push](#google-calendar-push-optional).
- **Meetings, time off and assignments** (Calendar › *New entry*, or on a
  project): a meeting with colleagues and outside guests, whole days
  someone is off, or a small dated job that does not need a project. They
  show on the calendar, the office screen, people's *My day* and their
  calendar subscription, and each has *Add to Google Calendar* and a
  download for other calendars. With Google Calendar push set up, they go
  on the shared calendar; with *Invitations* switched on under Settings ›
  Calendar (after a Workspace admin grants domain-wide delegation, the page
  shows what to enter), they land in people's own Google calendars as
  real invitations instead.
- **My day** on the dashboard: today's and tomorrow's schedule on your
  projects, your open tasks (overdue first, tick them off right there),
  and this week's projects with your call time. *My plan (PDF)* prints
  the schedule with only your tasks.

### Packing lists

- **Packing lists** (on the project page): start empty, from a template,
  or by copying another list. Add models, whole kits or a template's lines
  with one search box (a barcode scanner works too). Group by category or
  by case, see weight, case and power totals, print the PDF. Spares for
  the gear on the list are suggested ("2× lamp for your 6 projectors").
- **Packing mode** (phone): tick units, or scan a tag to tick that unit.
  Bulk gear is taken from a bin by quantity. *Pack all* ticks every unit
  of a line in one go, and every tick has an *Undo*. **Check out** moves
  everything ticked to the project. **Check in** records each unit as OK,
  damaged or missing, and spares as *Used*. Finishing marks whatever is
  still out as missing.
- **Share link**: a read-only page for the crew or the venue, no login.
  Revoke it when the job is done.
- **Packing templates** (Projects › Templates): reusable model lists,
  also saved from any packing list.

### Production plans

- **Production plan** (project page › Production plan): a day-by-day
  schedule with times, places and who is responsible; tasks by phase
  with assignee, due date and a big Done button; crew with call times and
  contacts; logistics such as vans, parking, dock info and hotels. Print
  a **day sheet** per day or the whole plan, and share a read-only link.
- **Plan templates** (Projects › Plan templates): a whole plan relative
  to the first build-up day, applied to a project in one go. Any plan can
  be saved as one.
- **Documents**: riders, stage plots, drawings, risk assessments and 3D
  models. Uploads go up in chunks, so large files from a phone survive.
  The same name again adds a version. Images and PDFs open with a
  **markup** layer (pen, arrow, box, text) that shows who drew what.
  glTF/GLB, OBJ and STL open in a 3D viewer with a measure tool. SketchUp,
  DWG, DXF, Vectorworks, AI and PSD are stored for download with an
  optional preview image. A document pinned to a schedule entry or task
  appears on that day sheet.

### Rentals and pricing

- **Rentals**: gear for an external client, with the exact units, hand
  out and take back, and the agreement PDF.
- **Pricing**: every model has a rental day price. Settings › Pricing
  holds the rate tables (days → factor: Standard, Theatre and Revised
  from the old sheet). A rental picks a table, can override the charged
  days, add freight, insurance and crew lines and a discount, and prints
  totals excl. and incl. VAT.

### Everything else

- **Apps** (in the menu): one shared list of what the crew uses a lot.
  Files and small HTML tools keep every version; links just open. Tools
  run in a sandbox and cannot act as the person who opens them. Admins
  and members add, only admins delete.
- **On the phone**: the app installs on the home screen (iPhone: Safari,
  Share › *Add to Home Screen*; Android: Chrome offers *Install*). It
  opens full-screen with shortcuts to Scan, Projects and Inventory.
  Packing lists you have opened stay readable without a connection
  (ticking needs one).
- **Scan**: point the phone camera at a tag, or type it. Browsers only
  allow the camera over HTTPS, so in development use `npm run dev:https`.
- **Language**: English or Danish, switched in the menu, on the sign-in
  page and under Settings › Your account. Each person's choice is saved.
  Only the screens are translated: gear names and notes are stored as
  typed, and PDFs, CSV files and calendar events stay in English.
- **Two-factor sign-in** with an authenticator app (Google Authenticator,
  Microsoft Authenticator, 1Password …), required for admins and optional
  for everyone else under Settings › Your account. Setup gives ten
  recovery codes. An admin can reset someone who lost their phone under
  Settings › Users.
- **Layout** (Settings › Layout, admins): *Roomy* lets the packing list,
  production plan, project page, pack mode and check-in use a wide screen with columns;
  *Compact* keeps every page narrow and in one column. It applies to
  everyone.
- **Office screen** (`/board`): a full-screen page for a screen on the
  office wall. Job cards for the next 14 days with phases, crew and
  packing progress, today and tomorrow (call times, the plan schedule,
  rentals going out and coming back), and a timeline of the next six
  months at the bottom (`/board?months=12` for a year). It refreshes
  itself every minute. Make a user with the role *Office screen* under
  Settings › Users, sign in with it once in the screen's browser (full
  screen or kiosk mode), and it stays signed in and sees nothing but the
  board. Anyone else can open it from the Calendar page.
- **Users** (Settings › Users): admin, member, viewer, or office screen.
  **Contacts** (Settings › Contacts): people and companies who are not
  users.
- **Import** (Settings › Import): the old gear spreadsheet. A preview
  shows what imports as is, what imports with a stated guess, and what
  needs your decision. Nothing is written until you confirm, and
  importing the same file again adds nothing. *Import specs* on the same
  page fills in weight, size, power, description, links and extra fields
  (a column named like the field: Lumen, Throw ratio) on existing models from a CSV keyed by the export's Id column;
  the preview lets you tick which values to save.
- **Export CSV** on every list, with the filters you have set,
  semicolon-separated so Danish Excel opens it straight away.
- **Backup** (Settings › Backup, admins): the whole database as one JSON
  file, and a restore from such a file. Uploaded files are not in it; the
  server's nightly backup has both (see [Backups](#backups)).
- **API and webhooks**: API tokens under Settings › Your account, docs at
  `/api/docs`. Settings › Webhooks posts signed JSON to your URL on events
  such as a status change or a confirmed project.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run dev:https` | Dev server over HTTPS (self-signed), for the camera scanner on a phone: open `https://<your-pc-ip>:3000` and accept the warning |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run test` | Unit and database tests (Vitest) |
| `npm run test:backup` | The backup restore test, which wipes the database (run alone) |
| `npm run test:e2e` | Browser tests (Playwright; starts the app itself) |
| `npm run db:clean-tests` | Remove what the browser tests leave behind |
| `npm run db:migrate` | Create and apply a migration in development |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Re-runnable demo data |
| `npm run db:reset` | Drop, migrate, seed (development only) |
| `npm run db:studio` | Prisma Studio |

## Running the server

The app runs on a small always-on PC at the office, as a Docker Compose
stack: Postgres, the app, and `cloudflared`. The server needs no open
ports: `cloudflared` connects out to Cloudflare, which serves
`gear.vertigo.dk` over HTTPS and forwards the requests through the
tunnel. Every route is behind login except share links and calendar
feeds, and the login form is rate-limited. The tunnel is free.

Everything is configured in `.env` on the server; nothing secret is in
the repository.

### Setting up the server

**Hardware.** A mini PC with 8 GB RAM (4 GB is the minimum), a 256 GB or
larger SSD and a wired network port. In the BIOS set "power on after
power loss" (often under power management or ACPI) so it comes back
after an outage. A small UPS is worth it, since a load-in does not wait
for a reboot.

**Network.** The server needs outbound HTTPS (443) and port 7844 (TCP and
UDP) to Cloudflare. Nothing inbound. Reserve its address in the router's
DHCP settings so SSH on the office network always finds it.

1. **Install Ubuntu Server** 26.04 LTS (tick *OpenSSH server*, nothing
   else). Use an LTS release: it gets security updates until 2031, an
   interim ".10" release only for nine months. The user you create in
   the installer is the admin user (it can use `sudo`). Logged in as
   that user, install Docker, a `deploy` user for the app, automatic
   security updates, and set the clock to Danish time (the nightly backup
   runs by it):

   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo adduser deploy && sudo usermod -aG docker deploy
   sudo apt install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades
   sudo timedatectl set-timezone Europe/Copenhagen
   ```

   Add swap: the app build can run out of memory on 4 GB (use 2G on a
   small disk):

   ```bash
   sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

   Now set up [remote access](#remote-access-ssh-and-tailscale), so the
   rest can be done from a PC with copy and paste.

2. **Get the code onto the server.** The repository is public, so
   cloning needs no GitHub login. As the admin user, make the folder and
   hand it to `deploy`, then become `deploy`:

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

   `deploy` cannot use `sudo`. To go back to the admin user, type `exit`.

3. **Write the settings file.** Start from the example and make it
   private:

   ```bash
   cp .env.example .env
   chmod 600 .env
   ```

   Let the server fill in the secrets itself. Each line finds one setting
   and replaces it:

   ```bash
   sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$(openssl rand -base64 32)\"|" .env
   sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env
   sed -i 's|^APP_URL=.*|APP_URL="https://gear.vertigo.dk"|' .env
   sed -i 's|^# CLOUDFLARE_TUNNEL_TOKEN=|CLOUDFLARE_TUNNEL_TOKEN=|' .env
   ```

   Check the result:

   ```bash
   grep -E '^(AUTH_SECRET|POSTGRES_PASSWORD|APP_URL|CLOUDFLARE_TUNNEL_TOKEN)=' .env
   ```

   You should see a long random `AUTH_SECRET` in quotes, a long hex
   `POSTGRES_PASSWORD`, the address, and an empty
   `CLOUDFLARE_TUNNEL_TOKEN=` (the token comes in step 4). The database
   password is hex on purpose: it ends up inside a database address,
   where `+`, `/` and `=` break the connection. It is fixed the first
   time the database starts; changing the line later does not change the
   database. To edit `.env` by hand: `nano .env`, save with Ctrl+O and
   Enter, close with Ctrl+X.

   Leave `DATABASE_URL`, `APP_DOMAIN`, `APP_BIND` and `SEED_PASSWORD`
   alone; they are for development or the other setups.

   **Keep a copy of the finished `.env` in the password manager.** The
   backups leave it out because it holds the secrets, and a restored
   server needs the same `AUTH_SECRET` for two-factor sign-in to work.
   Never paste it anywhere else or commit it.

4. **Create the tunnel in Cloudflare.** In the Cloudflare dashboard, open
   *Networking › Tunnels* and create a tunnel of type *Cloudflared* named
   `vertigo-gear`. On its *Overview* page, under *Install cloudflared
   connector*, pick *Docker* and copy the
   `docker run cloudflare/cloudflared:latest tunnel …` command. Do not run
   it: Compose starts cloudflared itself. Paste it into Notepad and copy
   only the long string after `--token ` (it starts with `eyJ`). On the
   server, `nano .env` and put it on the token line, one line, no quotes:
   `CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...`.

   Back on the tunnel page, *Routes › Add route*, and choose a route that
   publishes an application on a public hostname (not a private network
   route): subdomain `gear`, domain `vertigo.dk`, service
   `http://app:3000` (or type *HTTP* and URL `app:3000` when they are
   separate fields). Cloudflare creates the DNS record itself. The token
   is the whole credential for the tunnel: if it ever leaks, use *Rotate
   token* on the same page and put the new one in `.env`.

5. **Start it.** As `deploy` in `/opt/vertigo-gear`:

   ```bash
   docker compose --profile tunnel up -d --build
   ```

   The first run builds the app, which takes 5 to 15 minutes. Then check:

   ```bash
   docker compose --profile tunnel ps
   ```

   `db` and `app` should say *healthy* (the app needs a minute after the
   build) and `cloudflared` *running*. The tunnel turns *Healthy* in the
   Cloudflare dashboard. If something is wrong, the logs say why:
   `docker compose logs app` or `docker compose logs cloudflared`.

6. **Create your admin user.** The database starts empty. Create the
   first admin with your own email and name; it asks for a password
   twice:

   ```bash
   docker compose exec app node scripts/create-admin.mjs you@vertigo.dk "Your Name"
   ```

   Open https://gear.vertigo.dk and sign in. The app then sets up
   two-factor sign-in: scan the QR code with an authenticator app and keep
   the ten recovery codes somewhere safe. Add colleagues under Settings ›
   Users, and bring in the old spreadsheet under Settings › Import.

   Running the same command again resets that user's password and turns
   their two-factor sign-in off: the way back in if the last admin forgets
   the password or loses both the phone and the recovery codes. Never run
   `db:seed` on the server: it loads the demo data.

7. **Finish in Cloudflare.** Under *SSL/TLS › Edge Certificates*, switch
   on *Always Use HTTPS* and HSTS.

8. **Turn on the nightly backup**, see [Backups](#backups).

**Behind the proxy.** Cloudflare terminates HTTPS and passes the visitor's
scheme, host and address in `X-Forwarded-*` headers, which the app reads
(`src/lib/request-origin.ts`). Login redirects therefore go to
`https://gear.vertigo.dk`, the session cookie is marked *Secure*, and the
login rate limit counts per visitor, not per tunnel. The app is reachable
only through the tunnel, so the headers cannot be forged from outside.
Cloudflare's free plan caps a request at 100 MB; uploads go in small
chunks and forms accept 25 MB, so nothing hits it. QR codes and share
links use the address the page was opened on.

### Remote access (SSH and Tailscale)

SSH gives you a terminal on the server from a PC, with normal copy and
paste. It works on the office network and, through
[Tailscale](https://tailscale.com), from anywhere. It is never open to
the internet: do not forward port 22 on the office router (the tunnel
needs no open ports). Log in with the user's normal password. Anyone on
the office network can try it, so use proper passwords for both users.

1. **SSH on the server.** If OpenSSH was not ticked in the installer:

   ```bash
   sudo apt install openssh-server
   sudo systemctl enable --now ssh
   ```

   If `sudo ufw status` says `active`, also run `sudo ufw allow OpenSSH`.

2. **On the office network.** `hostname -I` on the server prints its
   address (the first one, like `192.168.1.50`). From PowerShell on a PC:

   ```bash
   ssh deploy@192.168.1.50
   ```

   Use the admin user's name instead of `deploy` for anything that needs
   `sudo`. The first time, it asks whether to trust the server: type
   `yes`.

3. **Tailscale on the server**, as the admin user:

   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```

   Open the link it prints and sign in. Then, in the Tailscale admin
   console (login.tailscale.com), *Machines*, the server's `…` menu,
   **Disable key expiry**. Otherwise the server drops off Tailscale after
   about six months.

4. **Tailscale on your PC or phone**: install it from
   tailscale.com/download and sign in with the same account. Then, from
   anywhere:

   ```bash
   ssh deploy@<server name>
   ```

   The server name is its Ubuntu hostname. If it is not found, use the
   `100.x.x.x` address the Tailscale app shows.

To take someone's access away, remove their device in the Tailscale
console and change the passwords they knew.

### Updating

As `deploy`:

```bash
cd /opt/vertigo-gear && git pull && docker compose --profile tunnel up -d --build
```

Database migrations run when the app starts. The GitHub deploy workflow
(`deploy.yml`) is for a server GitHub can reach over SSH, so it does not
apply here; with its `DEPLOY_*` secrets unset it does nothing.

### Backups

`scripts/backup.sh` writes one archive with the database dump and every
upload to `backups/`, keeps 14 days of them (`BACKUP_KEEP_DAYS`), and
copies each archive off-site with [rclone](https://rclone.org) to
`BACKUP_REMOTE`, pruning the remote the same way. Copies must leave the
building, so set up the remote first.

**Dropbox (also Business team spaces).** Install rclone on the server
(`sudo apt install rclone`). Log in from a PC with a browser:
`rclone authorize "dropbox"` prints a token. On the server, as `deploy`,
run `rclone config`: new remote `dropbox`, type `dropbox`, no client
id or secret, no advanced config, *no* to auto config / web browser, then
paste the token. On a Business account `dropbox:folder` is the signed-in
member's own folder and `dropbox:/` the team root (`rclone lsd dropbox:/`
lists the team folders). Keep backups out of folders the whole team can
open: they hold the full database. Then, in `/opt/vertigo-gear`:

```bash
rclone mkdir "dropbox:/Server Account/vertigo-gear-backups"
echo 'BACKUP_REMOTE="dropbox:/Server Account/vertigo-gear-backups"' >> .env
./scripts/backup.sh
```

Cloudflare R2, Backblaze B2, S3 and Google Drive work the same way with
their own rclone remote.

**Every night.** As `deploy`, `crontab -e` and add this line (03:10
server time):

```
10 3 * * * cd /opt/vertigo-gear && ./scripts/backup.sh >> backups/backup.log 2>&1
```

`tail backups/backup.log` shows how the last runs went.

**Restoring.** `scripts/restore.sh <archive>` stops the app, replaces the
database and the uploads with the archive's contents, and starts the app
again (migrations run if the code is newer than the backup). It asks for
a typed `yes` first. A backup that was never restored is a guess: try it
on a spare machine now and then.

### Recreating the server from a backup

When the server is gone (dead disk, stolen, replaced), a new one is the
setup above plus a restore. Have three things ready:

- **A backup archive**, normally the newest one in Dropbox.
- **The old `.env`** from the password manager. Most important in it is
  `AUTH_SECRET`: two-factor sign-in only works with the same one (see
  "If the old `.env` is lost" below).
- **Access to Cloudflare and Dropbox.**

1. **Set up the machine** as in [Setting up the server](#setting-up-the-server),
   steps 1 and 2: Ubuntu, Docker, the `deploy` user, remote access, and
   the code in `/opt/vertigo-gear`. Use the newest code: the restore runs
   any newer database migrations on start.

2. **Put the old `.env` back.** As `deploy` in `/opt/vertigo-gear`:
   `nano .env`, paste it in, save. It holds the tunnel token too, so the
   same tunnel and address carry over. **Switch the old server off first**
   if it still runs, or both answer on the same address. Cloudflare's
   tunnel page lists its connectors.

3. **Start the stack once.** This builds the app and creates an empty
   database:

   ```bash
   docker compose --profile tunnel up -d --build
   ```

   Do not create an admin user: the restore brings all the users back.

4. **Fetch the backup.** Connect rclone to Dropbox as described under
   [Backups](#backups), list the backups and copy the newest one down:

   ```bash
   rclone ls "dropbox:/Server Account/vertigo-gear-backups"
   mkdir -p backups
   rclone copy "dropbox:/Server Account/vertigo-gear-backups/vertigo-gear-YYYYMMDD-HHMM.tar.gz" backups/
   ```

5. **Restore it.** Type `yes` when asked:

   ```bash
   ./scripts/restore.sh backups/vertigo-gear-YYYYMMDD-HHMM.tar.gz
   ```

6. **Check.** Open the address and sign in as usual, with your two-factor
   code. Open a model with photos and a production plan with documents
   to see that the uploads came back.

7. **Turn the nightly backup back on** (the cron line under
   [Backups](#backups)), and check that `BACKUP_REMOTE` is in `.env`.

**If the old `.env` is lost**, write a new one as in step 3 of the setup,
and get a new tunnel token from Cloudflare (*Rotate token* on the tunnel
page). Then restore as above. Everything comes back, but:

- Everyone has to sign in again.
- Two-factor sign-in no longer accepts app codes, because the secrets
  were sealed with the old `AUTH_SECRET`. Each person can sign in once
  with one of their recovery codes. An admin without one runs
  `docker compose exec app node scripts/create-admin.mjs <email> "<name>"`,
  which also resets that person's two-factor sign-in. Admins then reset
  everyone else's under Settings › Users, and people set it up again.
- The Google Calendar key and calendar ids have to go into `.env` again,
  if you use them.

Practise this once on a spare PC or a virtual machine, so it is not the
first time when it matters.

### Settings in `.env`

Besides the ones the setup writes, these change how the app behaves.
After editing `.env`, recreate the app so it reads them:

```bash
docker compose --profile tunnel up -d --force-recreate app
```

| Setting | What it does |
|---|---|
| `PROJECT_GEAR=on` | Brings back gear on projects: reserving gear, renting in sub-hire gear, the project quote, and starting a packing list from the reservations. Off by default; nothing is deleted while it is off. Rentals are not affected. |
| `TWO_FACTOR_REQUIRED_ROLES` | Who must use two-factor sign-in: `admin` when unset, `admin,member`, or `none`. |
| `MAX_UPLOAD_MB` | Largest document upload (500 by default). |
| `BACKUP_REMOTE`, `BACKUP_KEEP_DAYS` | Where backups are copied and how many days are kept (see [Backups](#backups)). |

### Google Calendar push (optional)

The app can put every job on a shared Google Calendar, and one event per
rental on a second calendar. A job is one all-day event over its whole
span, with the phases in its description, plus timed events for the show
and for each build-up and pack-down day from its call time (how long those
last is set under Settings › Calendar). The subscribe feeds show jobs the
same way. Sync is one-way:
the app is the source of truth and never reads edits back from Google.

1. In [Google Cloud Console](https://console.cloud.google.com/), create a
   project (or use an existing one) and enable the **Google Calendar API**
   (APIs & Services › Library).
2. Create a **service account** (IAM & Admin › Service Accounts ›
   Create). No roles are needed. Open it, go to **Keys › Add key › JSON**
   and download the key file. If an organisation policy blocks creating
   the key ("Disable service account key creation"), a Workspace super
   admin has to override it for this one project; project Owner is not
   enough. Switch it back on once the key is downloaded: existing keys
   keep working.
3. In Google Calendar, create a calendar "Vertigo projects" (and
   optionally "Vertigo rentals"). In its settings › **Share with specific
   people**, add the service account's email
   (`...@...iam.gserviceaccount.com`) with **Make changes to events**, and
   copy the **Calendar ID** from "Integrate calendar".
4. Put the key into `.env` on the server, as **one line in single
   quotes** (double quotes would turn the `\n` in the private key into
   real line breaks). Copy the key file to the server, from PowerShell on
   your PC:

   ```bash
   scp $HOME\Downloads\<key file>.json deploy@<server name>:/opt/vertigo-gear/google-key.json
   ```

   then, on the server in `/opt/vertigo-gear`, write it into `.env` and
   delete the file (if it is not valid JSON, nothing is written or
   deleted):

   ```bash
   KEY=$(python3 -c 'import json,sys;print(json.dumps(json.load(open(sys.argv[1])),separators=(",",":")))' google-key.json) && printf "GOOGLE_SERVICE_ACCOUNT_JSON='%s'\n" "$KEY" >> .env && rm google-key.json
   ```

   Add the calendar ids the same way and recreate the app:

   ```bash
   echo 'GOOGLE_CALENDAR_ID_PROJECTS=<calendar id>' >> .env
   echo 'GOOGLE_CALENDAR_ID_RENTALS=<calendar id>' >> .env
   docker compose --profile tunnel up -d --force-recreate app
   ```

   In development, `GOOGLE_SERVICE_ACCOUNT_JSON` can instead be the path
   to the key file (it is git-ignored).
5. Settings › Calendar now shows "Configured". Confirming a project,
   changing its dates or venue, or cancelling it queues a sync; the
   delivery queue is visible under Settings › Webhooks.

Crew members with a Google email on their user profile are added as
attendees. Service accounts can only invite attendees when the Workspace
admin grants domain-wide delegation; without it, events are created
without attendees and the sync still succeeds.

### Background work

Webhook deliveries and calendar pushes go through an outbox table that a
worker inside the app processes every 15 seconds. On a host without a
long-running process (Vercel), set `CRON_SECRET` and have a scheduler call
`POST /api/cron/outbox` with `Authorization: Bearer <secret>` every
minute.

## Other ways to host

The office setup above is the one in use. These still work.

### A VPS with Caddy

On a server with Docker (a Hetzner CX23 with 2 vCPU and 4 GB is plenty),
an A record such as `gear.vertigo.dk` pointing at it, and ports 22, 80 and
443 open: set it up as in steps 1 to 3 above, with these in `.env`
instead of the tunnel token:

| Variable | Value |
|---|---|
| `APP_DOMAIN` | the DNS name, e.g. `gear.vertigo.dk` |
| `APP_URL` | `https://gear.vertigo.dk` |

Then start the `prod` profile and create the admin:

```bash
docker compose --profile prod up -d --build
docker compose exec app node scripts/create-admin.mjs you@vertigo.dk "Your Name"
```

Caddy gets the certificate from Let's Encrypt on first start and renews
it by itself. The database and the app listen on the server only; Caddy
is the way in. `GET /api/health` answers `{ "ok": true }` when the app
reaches its database, and Compose restarts the container when it does
not. Update with `--profile prod` instead of `--profile tunnel`.

GitHub can deploy for you: `.github/workflows/deploy.yml` runs after CI
passes on `main` and runs the update over SSH. Add these repository
secrets (Settings › Secrets and variables › Actions): `DEPLOY_HOST`,
`DEPLOY_USER`, `DEPLOY_KEY` (a private key whose public half is in that
user's `~/.ssh/authorized_keys`), `DEPLOY_PATH` (`/opt/vertigo-gear`).
The workflow waits for the health check and prints the app log if it
fails.

### Vercel and managed Postgres

The app runs on Vercel with a managed database and object storage, with
two gaps: PDF pages in plan exports need poppler, which Vercel does not
have (documents are listed by name instead), and the outbox worker needs
a scheduler.

1. Create a Postgres database (Neon, Supabase, Vercel Postgres) and a
   bucket on Cloudflare R2 or another S3-compatible store.
2. Import the repository in Vercel. Set the environment variables from
   `.env.example`: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` (the Vercel
   domain), `STORAGE_DRIVER=s3` with the `S3_*` values, `CRON_SECRET`,
   `OUTBOX_DISABLED=1`.
3. Build command: `npx prisma generate && npx prisma migrate deploy && npm run build`.
4. Add a Vercel cron (`vercel.json`) that calls `POST /api/cron/outbox`
   every minute with `Authorization: Bearer <CRON_SECRET>`.
5. Create the first admin from your machine with `DATABASE_URL` pointing
   at the managed database:
   `node scripts/create-admin.mjs you@vertigo.dk "Your Name"`.
