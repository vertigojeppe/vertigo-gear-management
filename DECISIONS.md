# Decisions

Why things are the way they are. Newest at the bottom. Reversing one of
these is fine, but add a new entry saying why.

## 2026-10-11 — Postgres only, no SQLite for dev

Spec allowed SQLite in dev. Supporting both doubles migration testing and
blocks JSONB custom fields. Dev uses the same Postgres image as prod via
`docker compose up -d db`.

## 2026-10-11 — Docker on a VPS is the primary target

Vercel is documented as secondary (needs S3 storage and external Postgres;
no PDF thumbnails because that uses `pdftoppm` from poppler inside the
container). This lets us use native tooling and local disk for uploads.

## 2026-10-11 — Next.js 16 without Cache Components

`create-next-app` enabled `cacheComponents` + `partialPrefetching`. Turned
off: every page is behind login and shows live stock, so a static shell buys
nothing and the Suspense/`use cache` rules add friction for non-developers
extending the app. Pages are dynamic by default; nothing is cached unless we
opt in later.

## 2026-10-11 — Auth.js v5 with JWT sessions, password login first

Credentials provider requires JWT sessions. Magic links and Google login
are added by configuring providers, not by rewriting sessions. Passwords
are hashed with bcryptjs (pure JS, no native build step on Windows/Alpine).
No SMTP yet, so no magic link in Phase 0.

## 2026-10-11 — Prisma 7, client generated into `src/generated/prisma`

Prisma 7 needs a driver adapter (`@prisma/adapter-pg`) and keeps the
datasource URL in `prisma.config.ts`. Multi-file schema: one `.prisma` per
module in `prisma/models/`. The `prisma` CLI is a runtime dependency so the
Docker image can run `migrate deploy` on start.

## 2026-10-11 — shadcn/ui on Base UI primitives

shadcn's current default (`base-nova` preset) uses Base UI rather than
Radix. Accepted as-is; it is what the CLI installs and maintains.

## 2026-10-11 — Permissions are a flat list in config

`config/app.config.ts` defines `PERMISSIONS` and which role gets which.
Finance fields (purchase price, insured/replacement value) are behind
`inventory.finance`, granted to admin and member, not viewer. Changing who
sees what is a config edit, no code.

## 2026-10-11 — Reservations at model level; units assigned when packing

A project reserves "2× projector model X" for a date range. Specific
serial numbers are chosen in packing mode. Avoids re-planning when a unit
goes into repair the week before.

## 2026-10-11 — Kits hold real contents

A kit is a serialized item; its contents are items with `parentItemId`.
Bulk contents ("3× XLR") are a bulk item row inside the kit, so those cables
leave the general count. Reserving/packing a kit moves everything in it.

## 2026-10-11 — `in repair` and `missing` are unavailable

They are subtracted from availability for any window. `retired` is not
owned at all.

## 2026-10-11 — Sub-hiring gear in is backlog

No "external item" hook in the model yet. See BACKLOG.md.

## 2026-10-12 — Asset tags from a counter row, not the id

`VG-0042` style tags come from a `Counter` row incremented inside the
creating transaction, so tags are short, printable, sequential and never
duplicated under concurrency. The seed sets the counter past its highest tag.

## 2026-10-12 — Bulk items are bins

A bulk model (cables, clamps) has one `Item` row per *bin* with a quantity,
not one row per cable. Putting 3 cables into a kit creates a bin of 3 inside
the kit and reduces the wall bin. Each bin has its own tag.

## 2026-10-12 — Status changes: reason flags in config

Which statuses require a reason, count as available, or may be set by hand
is data in `ITEM_STATUSES` (config), not code. The pure
`validateStatusChange` is unit-tested; check-out/check-in (Phase 3) reuse it
with `viaFlow`.

## 2026-10-12 — Client components import actions from `@/modules/<name>/actions`

Importing a server action through the module barrel pulled the Prisma/pg
stack into the browser bundle (Turbopack: "Can't resolve 'net'"). The
ESLint import rule now allows `@/modules/<name>/actions` as a second public
entry; the barrel stays for server code. `server-only` was tried and
dropped because it also throws in Vitest and the seed script.

## 2026-10-12 — App shell scrolls inside, not the window

The frame is `h-dvh`; only the content area scrolls. Sidebar and bottom
tabs never move, mobile browser chrome cannot cover the tabs, and
Playwright's phone emulation stops mis-hitting a fixed bar. Route changes
reset the scroll position (`ScrollContainer`).

## 2026-10-12 — OpenAPI from a hand-written operation list

`src/lib/api/openapi.ts` lists endpoints and reuses the zod schemas via
`z.toJSONSchema`. No code-generation dependency; the handlers and the
document share the same schemas, so request shapes cannot drift. Docs UI is
Scalar loaded from a CDN at `/api/docs`.

## 2026-10-12 — Custom field values live in a JSONB column

`customFields` on Model/Item (later Project/Rental) with definitions in
`CustomFieldDefinition`. Validation builds a zod schema per request from the
definitions. Filtering uses Prisma JSON path equality; full-text search over
custom values is backlog.

## 2026-10-12 — Allocations are explicit rows, created by the user

A project reserves gear by adding "N × model" lines (allocations) rather
than deriving demand from a packing list. Rentals create one allocation per
line automatically. Specific units are attached later (rental assign,
Phase 3 packing). Allocation dates default to the project window and move
with it only while they still match it.

## 2026-10-12 — Conflicts warn, they do not block

"Reserve anyway" is always available after the warning. Festival work
needs the override (gear comes back a day early, a unit gets sub-hired).
The over-booking stays visible on the project, the model page and the
calendar until it is resolved.

## 2026-10-12 — Google Calendar via a hand-rolled REST client

`googleapis` is ~100 MB of dependencies for three endpoints. A service
account JWT (Node crypto) and plain `fetch` do the job, and tests inject a
fake client. One-way sync only; event ids stored per phase make it idempotent.

## 2026-10-12 — Outbox + in-process poller instead of a queue

One container, no Redis. The `Outbox` table with status/attempts/backoff
plus a 15-second poller from `instrumentation.ts` is enough for webhooks and
calendar pushes. `POST /api/cron/outbox` exists for serverless hosts.

## 2026-10-12 — Rental "overdue" is derived

A rental that is out past its end date shows as overdue; nothing flips the
stored status, so returning it later needs no special case.

## 2026-10-12 — Home location on items

`homeLocationId` is set when an item is created on or moved to a warehouse
location. Rental return (and Phase 3 check-in) sends items home. Avoids a
second "previous location" field.

## 2026-10-12 — Forms submit through a transition, not `<form action>`

React 19 resets every field of a `<form action>` once the server action
resolves. With validation and conflict responses that is exactly when the
user needs their input kept (and native selects were not restored at all).
`ActionForm` submits via `startTransition(() => action(formData))`, so
nothing resets; `SubmitButton` gets the pending flag from context.

## 2026-10-12 — Bulk gear travels in a split-off bin

A packing list takes "5 of the 20 DMX cables". Instead of a quantity field
on the project, check-out creates a new Item (a travel bin with its own tag)
holding that quantity at the project location and reduces the source bin.
The inventory then shows the truth at every moment, QR labels can be printed
for the travel bin, and check-in merges it back (or leaves a damaged/missing
bin behind with that status). Costs one extra asset tag per bulk line.

## 2026-10-12 — A kit is one line on a packing list

Adding a kit (a case with `isKit`) adds one line with the case as the unit.
Its contents are shown but never become lines, and ticking the case ticks
everything inside. Check-out/check-in reuse the inventory status cascade
(`parentItemId`), so a kit's contents are never in a different state than
the case. Taking something out of a kit for a job means removing it from the
kit first (Phase 1 kit section).

## 2026-10-12 — Finish check-in marks the rest missing

The user does not have to click "missing" on every absent unit at 03:00
after load-out. Finishing a check-in records `missing` for everything still
out and closes the list; items get the `missing` status and stay at the
project location, so the inventory keeps asking for them. Finding one later
is a normal status change on the item.

## 2026-10-12 — Share links are generic rows with random tokens

`ShareLink(targetType, targetId, token)` rather than a token column per
entity, so Phase 4 plans reuse it. Tokens are 18 random bytes, base64url.
A share link does not expire by default (the crew uses it until the show
is over); revoking deletes the row. No login, no write access.

## 2026-10-12 — Spec update: schema first, pricing later

`SPEC.md` (the renamed system prompt) and `MIGRATION.md` added statuses,
flags, contacts, person locations, category-scoped fields, a pricing engine,
sub-hire, wish list and purchase records. We land the schema-level changes
now, while the inventory model is still young, and park everything that
needs its own UI and maths (pricing, quotes, sub-hire, wish list, purchase
records) until after Phase 4, so production plans are not delayed.

## 2026-10-12 — A case is not a Location row

The spec lists "a case/kit" among location types. Kits already contain
items through `parentItemId`, and an item inside a kit shows "in Laser
case 1" on its page, so a second representation as a Location would drift.
"Case" stays a property of kit membership; `LOCATION_TYPES` gained only
`person`.

## 2026-10-12 — Person locations point at a user or a contact

"Mikkel has 2" is a Location of type `person` with either `userId` (staff)
or `contactId` (external). Items keep their normal status, so a loan to a
colleague is visible in the inventory without inventing a status for it.
Contacts stay separate from `Client` for now; unifying them is in the
backlog.

## 2026-10-12 — Retired items carry a reason category

`retiredReason` (sold / scrapped / lost) sits next to the free-text reason.
The status log keeps the text; the category makes "what did we sell" a
filter instead of a search.

## 2026-10-12 — Custom fields can be scoped to a category

`CustomFieldDefinition.categoryId` limits a model/item field to a category
and its sub-categories; `null` means every category. Definitions carry the
resolved `categoryIds` so forms filter client-side as the category or model
changes, and actions validate against the applicable set only. The unique
key is (entity, categoryId, key), so "length" can exist on both truss and
cables.

## 2026-10-12 — One production plan per project

A plan is the project's operational side, not a separate entity people
pick from a list. `ProductionPlan.projectId` is unique and the plan is
created when someone first opens it (optionally from a template), so the
project page always has exactly one place to click.

## 2026-10-12 — Plan templates are relative to an anchor day

Template entries carry a day offset from an anchor (load-in = day 0) plus a
time of day. Applying a template asks for the anchor date (defaults to the
project's load-in) and dates every entry from it; saving a plan as a
template does the inverse. This keeps templates reusable across projects
with different dates without a second "relative schedule" model.

## 2026-10-12 — Crew and contacts stay on the project

The plan shows the project's crew (with call times) and contacts rather
than owning copies. One list to maintain, and the packing list, calendar
feed and plan all agree on who is on the job.

## 2026-10-12 — Files and markup split into Phase 4b

The October spec update splits production plans into plans (schedule,
tasks, logistics, templates, PDFs) and documents (uploads with versions,
viewers, 3D, markup). Phase 4 ships the first half so the team can run
shows from it now; 4b adds files on top of the same entries.
