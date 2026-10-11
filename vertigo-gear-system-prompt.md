# Build "Vertigo Gear" — gear inventory, packing lists and production plans

## Context

Vertigo is a Copenhagen artist studio (about 6 people) doing light design, laser installations, projection and live visuals for concerts, theatre and festivals. We own a lot of technical gear (projectors, media servers, lasers, LED fixtures, cables, rigging, cases) that constantly moves between our warehouse, our own productions, and external rentals. Today there is no single place that answers "what do we own, where is it right now, and what do we need to pack for next week's show".

Build us a self-hosted web application that solves this. Multiple users, shared data, usable on a phone in the warehouse and on a laptop in the office.

## What the system must do

### 1. Inventory (the core)
- Every piece of gear is either a **serialized item** (one row per physical unit, e.g. a projector with a serial number) or a **bulk item** (tracked by quantity, e.g. 50× 5 m XLR cables).
- Each item belongs to a **model** (manufacturer + model name + specs, weight, dimensions, power draw, default photo, manuals/links) so specs are entered once.
- Models belong to a **category tree** (Video → Projectors → Laser projectors; Lighting → LED; Cables → Signal → SDI, etc.). Categories are user-editable.
- Items can be grouped into **kits/cases** (e.g. "Laser case 1" contains laser head, controller, safety key, 3 cables). Packing a kit packs its contents.
- Each item has a **status**: `in house`, `on project`, `rented out`, `in repair`, `missing`, `retired`. Status changes are logged with who/when/why.
- Each item has a **location**: warehouse shelf/zone, a project, an external renter, or a repair shop.
- Serialized items get a printable **asset tag** (QR code). Scanning the QR on a phone opens the item page. Bulk items get a tag per model/bin.
- Attachments: photos, invoices, manuals.
- Fields for purchase date, purchase price, supplier, insured value, replacement value, condition notes.

### 2. Overview / dashboard
- "What do we have" — browse and filter by category, status, location, model, text search.
- "What is out right now" — grouped by project / renter, with expected return dates and overdue highlighting.
- "What's in repair / missing".
- Per-model availability: owned, in house now, reserved for upcoming projects, available in a given date range.
- A **calendar/timeline view** of projects and rentals so we can see gear conflicts.

### 3. Projects
- A project has: name, client, venue/address, dates (prep, load-in, show dates, load-out, return), status (quote / confirmed / in progress / done / cancelled), notes, contacts, crew (users assigned), Google Drive/Notion link field.
- A project **reserves** gear for its date range. Reserving an item that is already reserved/out in that window must warn clearly (and show what the conflict is).
- From a project we can generate its packing list and its production plan (below).

### 4. Packing lists
- A packing list is tied to a project and lists models + quantities (and optionally specific serialized units once assigned).
- Fast to build: add from catalog with search, add whole kits, add from **templates** (e.g. "Standard laser show", "2× projector mapping rig") that we define ourselves, and duplicate from a previous project.
- Group lines by category or by case for packing.
- **Packing mode** (phone-friendly): check items off as they go in the truck, scan QR to tick a specific unit, see what's still missing. Checking out moves items to `on project`; **check-in mode** on return moves them back to `in house` and flags anything not returned or damaged.
- Printable/PDF export and a shareable read-only link (for a freelance crew member or the client).
- Shows total weight, number of cases, and power draw totals.

### 5. Production plans
- A production plan is tied to a project and contains:
  - **Schedule**: a day-by-day timeline (load-in Tuesday 08:00, rig 10:00–16:00, focus 16:00–19:00, rehearsal, show, strike…). Entries have time, duration, location, who is responsible, notes.
  - **Tasks/checklist**: to-dos with assignee, due date, done state, grouped by phase (pre-production, build, show, post).
  - **Crew & contacts**: who is on the job, roles, phone numbers, call times.
  - **Logistics**: vehicles, parking, loading dock info, hotel, travel.
  - **Documents, drawings and 3D files**: links and uploads (riders, stage plots, CAD, risk assessments, venue drawings, 3D models of the rig/venue). Requirements:
    - Accept any file type; store with versioning (uploading a file with the same name creates a new version, old versions remain downloadable). Show uploader, date, size.
    - **Inline viewers**: images (incl. SVG), PDF (page navigation), and **3D models** in glTF/GLB, OBJ (+MTL) and STL using a three.js-based viewer with orbit/pan/zoom, grid, basic lighting, and a simple two-point measure tool. Must work on phone.
    - **Native-only formats** (SKP, .blend, DWG, DXF, VWX, AI, PSD) are stored and downloadable, shown with a file-type icon and an optional user-uploaded preview image. Document in the UI that uploading a GLB export alongside gives an inline 3D view.
    - **Markup**: on any image or PDF page, users can draw freehand, arrows, rectangles, and text notes on an overlay layer (projector positions, cable runs, truss, etc.). Markups are saved as a separate layer (not baked into the original), attributed to the user, and included when exporting the plan to PDF.
    - Files can be pinned to a specific schedule entry or task (e.g. the load-in drawing attached to "Rig truss").
    - Upload size limit configurable (default 500 MB per file); use chunked/resumable upload so large 3D files don't fail on mobile.
- Plans can be created from **templates** (e.g. "Festival laser show", "Theatre projection run") and the packing list is visible from within the plan.
- Printable/PDF "day sheet" per day and a full plan export.

### 6. External rentals
- Rent gear to external clients: renter (company/contact), items, dates, price per line (daily/weekly), deposit, notes. Status: reserved / out / returned / overdue.
- Rentals occupy gear in the same availability system as projects.
- Simple rental agreement PDF export. No invoicing integration needed — just totals.

### 7. Google Calendar integration
- **iCal feeds** (read-only, no Google API needed): the app exposes secret-token URLs for `all projects`, `all rentals`, and `my jobs` (per user, only projects where that user is on the crew). Events carry project name, client, venue, phase (prep / load-in / show / load-out / return) and a link to the project page. Users subscribe to these in Google Calendar.
- **Push to a shared Google Calendar** via the Google Calendar API using a service account that has been shared onto the calendar (document the Google Cloud setup step by step in the README). When a project becomes `confirmed` or its dates/venue change, create or update one event per phase on the shared calendar; add assigned crew as attendees if the user has a Google email on file; delete the events if the project is cancelled. Store the Google event IDs on the project so updates are idempotent. Same for rentals on a separate "Rentals" calendar.
- Sync is **one-way (app → Google)**. The app is the source of truth; never read edits back from Google.
- Integration must be optional and configured by env vars; the app runs fine without it.

### 8. Users & permissions
- Login with email + password (magic link optional). Roles: **admin** (everything, user management), **member** (full edit of gear, projects, lists, plans), **viewer** (read-only, e.g. freelancers), plus **share links** for individual packing lists/plans without login.
- Every change is attributed to a user; show an activity log per item and per project.

### 9. Import / export
- CSV/XLSX import of the existing inventory (we'll supply a spreadsheet; the importer must handle models + serialized units + bulk quantities, and preview before committing).
- CSV export of any filtered list.
- Full JSON backup/restore.

## Technical requirements

- **Stack**: TypeScript throughout. Next.js (App Router) with server actions/API routes, Prisma ORM, **PostgreSQL** (SQLite acceptable for dev). Tailwind + a component library (shadcn/ui is fine). Keep the dependency count reasonable.
- **File storage**: local disk volume by default, with an S3-compatible option (Cloudflare R2 / MinIO) behind the same interface, since 3D files and drawings will make uploads large. Generate thumbnails for images and PDF first pages on upload.
- **Deployment**: runs with a single `docker compose up` (app + Postgres + a volume for uploads). Also document running on a VPS/Hetzner and on Vercel + managed Postgres. Env-var configuration, no secrets in the repo.
- **Mobile-first** for item pages, scanning, packing and check-in modes; desktop layouts for dashboard, project and plan editing.
- QR codes generated server-side; label printing as a PDF sheet of tags (standard Avery-style layout, size configurable) and single labels for a thermal label printer.
- Dates/times in Europe/Copenhagen, UI in English with the structure ready for a Danish translation (all strings in one place).
- Seed script with realistic demo data: ~60 models across categories, ~150 items, 3 kits, 4 projects at different stages, 2 rentals, 1 packing-list template, 1 production-plan template, 3 users.
- Tests for the parts that can lose us real gear or double-book it: availability/conflict logic, check-out/check-in state transitions, import preview/commit, permissions.
- Good empty states and inline help; we are not developers and will configure this ourselves.
- Document everything in `README.md` (setup, deployment, backup, how to import inventory, how to add users) and keep an `ARCHITECTURE.md` with the data model diagram.

## Built for extension

We will keep developing this with Claude Code as we learn what we need. Design for that:

- **`CLAUDE.md` at the repo root**, maintained throughout: architecture overview, folder conventions, how to run/test/migrate, how to add a new entity end-to-end (schema → migration → server actions → UI → tests → seed), and known gotchas. Update it whenever a convention changes. Also keep `DECISIONS.md` (why) and `BACKLOG.md` (ideas we add as we use the tool).
- **Custom fields**: admins can define extra fields (text, number, date, select, checkbox, URL) on models, items, projects and rentals from the UI. Custom fields are searchable/filterable and included in exports and imports.
- **Schema migrations only** (Prisma migrate); never hand-edit the database. Migrations must be safe to run on a live database with data.
- **One feature, one module**: each domain (inventory, projects, packing, plans, rentals, calendar, files, users) in its own folder with the same internal layout. No cross-module imports of internals; modules talk through a small public interface.
- **Internal REST API** with OpenAPI docs at `/api/docs`, used by the UI itself and callable with per-user API tokens. This is how we'll later connect other tools (TouchDesigner, Stream Deck/Companion, spreadsheets, automations).
- **Webhooks**: optional outgoing webhooks on events (item status changed, project confirmed, packing list checked out) so we can plug in notifications later without code changes.
- **Pluggable storage and auth** behind interfaces (local/S3; password/magic link, with room for Google login later).
- **Tests and CI**: a test suite that runs in GitHub Actions on every push, so future Claude Code sessions can change code with confidence. Seed data is re-runnable and used by the tests.
- **Nothing hardcoded that we might change**: statuses, categories, project phases, roles' permissions, label sizes, currency, timezone — all either in the database or in a single config file.

## How to work

1. Start by reading this whole spec, then write a short plan (`PLAN.md`) with the data model, the phases below, and any questions. Ask me the questions before writing code if any decision would be expensive to reverse; otherwise make a sensible choice and note it in `DECISIONS.md`.
2. Build in phases, each ending in a working, committed app I can run and click through:
   - **Phase 1** — auth, users/roles, categories, models, items (serialized + bulk), kits, locations, status log, QR tags, item search/browse, dashboard basics.
   - **Phase 2** — projects, reservations, availability/conflict engine, calendar view, external rentals, iCal feeds and Google Calendar push.
   - **Phase 3** — packing lists, templates, packing/check-in modes with scanning, exports/share links.
   - **Phase 4** — production plans (schedule, tasks, crew, logistics, documents), templates, day-sheet PDF.
   - **Phase 5** — import/export/backup, label sheets, polish, Danish translation hooks, deployment docs.
3. After each phase, tell me in a few lines what works, what to test, and what you'd like feedback on. Update `CLAUDE.md` before ending each phase.
4. Prefer boring, well-documented solutions over clever ones. No feature flags, no microservices, no GraphQL.

## Out of scope (for now)
- Accounting/invoicing integration, e-conomic/Dinero sync.
- Barcode-scanner hardware integration beyond phone camera QR.
- Public rental webshop.
- Two-way Google Calendar sync (reading edits back from Google).
- A full in-app CAD or drawing tool, and server-side conversion of SKP/DWG/.blend files. Markup on images/PDFs and viewing of GLB/OBJ/STL is enough.
- Fine-grained per-project permissions.
