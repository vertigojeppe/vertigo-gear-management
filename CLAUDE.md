# CLAUDE.md — working notes for Vertigo Gear

Read this first in every session. Keep it current: when a convention changes,
change it here in the same commit.

## What this is

Self-hosted web app for Vertigo (Copenhagen light/laser/projection studio):
gear inventory, availability, projects, packing lists, production plans,
external rentals. Full spec: `SPEC.md`; the spreadsheet we migrate from and
what it implies: `MIGRATION.md`. Plan and data model: `PLAN.md`. Why things are the way they are: `DECISIONS.md`. Ideas:
`BACKLOG.md`. Data model diagram: `docs/ARCHITECTURE.md`.

Current phase: **6 (pricing engine, rate tables, quote PDF) done**. Next: Phase 5b (export, labels, polish, deployment), then sub-hire catalog, wish list, purchase records.

## Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript strict,
Prisma 7 + PostgreSQL 16 (driver adapter `@prisma/adapter-pg`),
Tailwind 4 + shadcn/ui (Base UI primitives, `cn` from `"cn"`),
Auth.js v5 (Credentials, JWT sessions), next-intl, zod 4, Vitest, Playwright.

**Next.js 16 differs from older training data.** Before writing Next code,
read the matching guide in `node_modules/next/dist/docs/`. Known changes:
`middleware.ts` is `proxy.ts` (Node runtime only); `cookies()`, `headers()`,
`params`, `searchParams` are async; Cache Components are OFF in this project
(see DECISIONS.md), so pages render dynamically by default.

## Run / test / migrate

```bash
docker compose up -d db          # Postgres on localhost:5432
cp .env.example .env             # then set AUTH_SECRET
npm install                      # also runs prisma generate
npm run db:migrate               # apply migrations (dev)
npm run db:seed                  # demo users: admin|member|viewer@vertigo.test / vertigo123
npm run dev                      # http://localhost:3000
npm run dev:https                # https for phone camera testing (self-signed cert)
npm run lint && npm run typecheck && npm run test
npm run test:e2e                 # Playwright; reuses a running dev server or starts one
npm run db:clean-tests           # remove Testlight models / e2e tokens the browser tests leave behind
npm run build
```

Production: `docker compose --profile prod up -d --build` (see README).

## Folder conventions

```
config/app.config.ts   statuses, phases, roles+permissions, label sizes, currency, tz
prisma/schema.prisma   generator + datasource only
prisma/models/*.prisma one file per module
prisma/seed/           re-runnable seeders (upsert on stable keys)
messages/{en,da}.json  every UI string; keys namespaced by feature
src/app/               routes only; thin; (auth) and (app) route groups
src/components/        shared UI (ui/ = shadcn, rest = ours); navigation.ts is the nav source of truth
src/lib/               db, auth, activity, asset-tag, custom-fields, forms, format, storage/, api/
src/modules/<name>/    index.ts | schema.ts | service.ts | actions.ts | queries.ts | components/ | __tests__/
src/generated/prisma   generated client (gitignored)
e2e/                   Playwright specs
```

Modules import each other only via `@/modules/<name>` (ESLint-enforced).
Client components import server actions from `@/modules/<name>/actions`
and, when they need another module's client component (the rental form
renders the projects module's `ClientDialog`), from `@/modules/<name>/ui`,
a second entry that exports components only and never a service.

## Navigation

- Desktop (md+): left sidebar (`sidebar.tsx`). Phone: top bar + bottom tab bar
  with a "More" sheet (`mobile-nav.tsx`). Both read `NAV_ITEMS` in
  `src/components/navigation.ts`; add a section there, not in the components.
- Every nav item has a route. Unbuilt sections render `ComingSoon`.
- Page headings are `<h1>` so the e2e tests and screen readers can find them.

## Auth and permissions

- `requireActor()` in layouts/pages redirects anonymous users.
- `requirePermission("inventory.write")` in every server action and service
  mutation. Permissions and roles are defined in `config/app.config.ts`;
  `can(role, permission)` is pure and unit-tested.
- `src/proxy.ts` only does an optimistic cookie check; it is not the
  authorisation layer.
- Session is a JWT with `id` and `role`, but `getActor` looks the user up
  once per request (cached): name and role come from the database, and a
  deleted / deactivated user or a cookie from before a database reset is
  treated as signed out. `requireActor` sends such a session through
  `/api/session/stale`, which clears the cookie before `/login` (a plain
  redirect to `/login` would bounce back via the proxy's cookie check).
- Mutations that write several rows (entity + location + activity row) run
  in one `$transaction` and pass `tx` to `logActivity`, so a failed
  activity row never leaves a half-created entity behind.

## Inventory conventions

- Services live on namespaced objects (`items.create`, `models.update`) and
  take `(actor, input, extra)`. They call `assertCan` first and write
  `ActivityLog` rows; use the transaction client for both when inside
  `$transaction`.
- Forms: client component with `useActionState` → `"use server"` action →
  `parseForm(zodSchema, formData)` → service → `revalidatePath` / `redirect`.
  Errors come back as `FormState { error, fieldErrors, values }`; `errorState()`
  maps domain errors (which carry `.field`). `redirect()` must stay outside
  try/catch.
- Custom fields: inputs are named `cf.<key>`; `customFieldsFromForm` +
  `validateCustomFields` in the action; definitions via
  `customFieldDefinitions.forEntity()` (settings module).
- Dialog forms close on success with `useActionDialog(state)` (no effects).
- Client forms that use `useActionState` render `<ActionForm action={action}>`
  (`src/components/form/action-form.tsx`), not `<form action>`: React 19
  resets all fields after a `<form action>` server action, which wipes the
  user's input when the action returns an error. `SubmitButton` reads the
  pending flag from it. Plain `<form action={serverFn}>` is fine for buttons
  (delete, status) and for the upload form, where a reset is wanted.
- Native `<select>` (`NativeSelect`) in forms so FormData posts without JS.
- REST: handlers under `src/app/api/v1/**` use `handler(permission, fn)`
  from `src/lib/api/respond.ts` and the module zod schemas. Add new
  endpoints to `src/lib/api/openapi.ts` so `/api/docs` stays complete.
- Asset tags come from `nextAssetTag(tx)` inside the creating transaction.
  The seed sets the counter past its highest tag.
- Statuses include `under_construction` (exists, not usable, no reason
  needed). Retiring requires `retiredReason` (sold | scrapped | lost,
  `RETIREMENT_REASONS`) next to the free-text reason; it is cleared when
  the item leaves `retired`.
- `notForRental` on a model or an item means own projects only; the
  rentals service refuses such models (`assertRentable`) and units.
- Locations of type `person` carry `userId` or `contactId`; the dialog
  posts `person=user:<id>|contact:<id>` and `personRefs()` maps it. Cases
  are not locations (kit membership via `parentItemId` already covers it).
- Contacts (`src/modules/contacts`) are people and companies who are not
  users; permissions `contacts.read/write`. Clients stay separate for now.
- Custom field definitions can be scoped to a category
  (`categoryId`, applies to sub-categories). `forEntity(entity)` returns
  every definition with `categoryIds` resolved; `forEntity(entity,
  categoryId)` only the applicable ones. Forms filter with
  `applicableDefs` as the category/model changes; actions validate with
  the category. Seeded sets: projectors, LED controllers, alu profiles,
  computers, truss.

## Availability, projects, rentals

- **One allocation table.** `Allocation` rows (project or rental line,
  model, quantity, optional unit, inclusive dates) are the only source for
  availability. `computeAvailability` / `checkRequest` in
  `src/modules/projects/availability.ts` are pure and unit-tested; services
  load items + allocations with `itemsForModel` / `allocationsFor`.
- A reservation that does not fit throws `ConflictError` with the check;
  actions return it as `state.data.conflict` and the dialog offers
  "reserve anyway" (`force`). Rentals use the same engine.
- Project phase dates live on the project; the reservation window
  (`reserveFrom/To`) is derived in `deriveWindow`. Allocations that still
  match the old window move with the project when dates change.
- Items have a `homeLocationId` (warehouse shelf). Flows that return gear
  (rental return, Phase 3 check-in) put items back there.
- Dates: `src/lib/dates.ts`. Date-only values are YYYY-MM-DD strings
  (Copenhagen days, stored as UTC midnight); datetimes come from
  `datetime-local` via `zonedInputToDate`.

## Packing lists (Phase 3)

- A `PackingList` belongs to a project and goes `draft → checked_out →
  checked_in` (`PACKING_STATUSES`). Lines can only change while it is a
  draft; `canEditLines/canPack/canCheckOut/canCheckIn` in
  `src/modules/packing/logic.ts` are the only place that knows this.
- A `PackingLine` is a model + quantity. A plain line of the same model is
  merged on add. The quantity of a model across a list can never exceed
  what exists in the inventory (`modelStock`: any status except retired);
  `add` throws, and the template / copy / reservation sources pass
  `{ clamp: true }` to cut the line down instead. Lines show an amber
  "only N of M in house today" hint when fewer are in house right now. A kit is one line with `itemId = caseItemId = the kit`; its
  contents are never separate lines (they travel with the case via the
  inventory status cascade).
- Progress is derived from `PackingCheck` rows: phase `out` (ticked while
  packing, one per unit or one per bulk quantity) and phase `in` (outcome
  `ok | damaged | missing`, `CHECK_OUTCOMES` maps outcome → item status).
  `lineProgress/listProgress/listTotals` are pure and unit-tested.
- Check-out moves ticked serialized units to `on_project` at the project
  location (through `items.changeStatus(..., { viaFlow: true })` so the
  kit cascade and status log apply). Bulk quantities split a **travel bin**
  (new Item, new asset tag, `homeLocationId` of the source bin); check-in
  with `ok` merges it back into the source bin and deletes it when empty.
- `finishCheckIn` records anything still out as `missing` and closes the
  list. Lists that are checked out cannot be deleted.
- Scanning in pack mode (`packingChecks.scan`) finds the open line for the
  tag's model and ticks it; the result object (`ticked | unknown |
  not_on_list | error`) drives the message in `PackMode`.
- `ShareLink` rows (`targetType`, `targetId`, random token) are generic;
  `/share/packing/[token]` and `?share=<token>` on the PDF route are the
  Phase 3 consumers. Public pages live under `src/app/share/` outside the
  app shell, and `proxy.ts` lets `/share/` through without a session.
- Templates (`PackingTemplate`) hold model lines only, no units or kits.

## Production plans (Phase 4)

- One `ProductionPlan` per project (`projectId @unique`), created on first
  use by `plans.ensure`. It owns `ScheduleEntry`, `PlanTask` and
  `LogisticsEntry` rows; crew and contacts are the project's own and are
  only shown inside the plan.
- Schedule entries store `startsAt` as an instant; the day they belong to
  is the Copenhagen day (`dayInZone`). The form posts `date` + `time` and
  the service combines them with `zonedInputToDate`. Day sheets filter by
  that day.
- Tasks have a phase (`PLAN_PHASES`), optional assignee and due date, and a
  done flag; `sortTasks` orders them phase → open first → due date.
- Templates (`PlanTemplate`, `PlanTemplateEntry`) hold entries relative to
  an **anchor day** (`dayOffset`, load-in = 0). `materialiseTemplate` dates
  them; `templateFromPlan` is the inverse used by "save as template". Both
  are pure and tested in `src/modules/plans/logic.ts`.
- PDFs: `renderPlan(detail, { day? })` renders the full plan or one day
  sheet; served by `/api/plans/[planId]/plan.pdf` for signed-in users or
  with the plan's share token. Share links reuse `ShareLink` with
  `targetType = "plan"`; the public page is `/share/plan/[token]`.
- Documents (`PlanDocument` → `PlanDocumentVersion` → `File`) live in
  `src/modules/plans/documents.ts`. Same name on the same plan = new
  version; old versions stay. A document may be pinned to one schedule
  entry or one task, and native formats can carry a preview image.
- Uploads are chunked and resumable: `POST /api/uploads` starts an
  `UploadSession`, `PUT /api/uploads/[id]?offset=` appends in order,
  `GET` reports progress for resuming, `POST .../complete` turns the part
  into a `File`. `DocumentUploader` does this client-side; the storage
  adapter grew `appendPart/partSize/finalizePart` (local only; S3 needs
  multipart). `MAX_UPLOAD_MB` caps the size (default 500).
- Viewers (`DocumentViewer`) pick by `documentKind`: images and PDFs get
  the `MarkupLayer` (shapes in 0..1 coordinates, one `Markup` row per
  version and page, author stamped server-side); pdf.js and three.js load
  only on the client through `next/dynamic`. 3D: glTF/GLB, OBJ (+MTL when
  a sibling document has the same base name), STL.
- The plan PDF embeds image documents with their markup; PDF documents are
  rasterised with `pdftoppm` when poppler is installed (the Docker image
  has it), otherwise listed by name. Day sheets include documents pinned
  to that day's entries.

## Pricing (Phase 6)

- `src/modules/pricing`: `engine.ts` is pure (`factorFor`, `gearLinePrice`,
  `extraLinePrice`, `quoteTotals`, `parseTiers`) and unit-tested against
  the seeded tables; `service.ts` has `rateTables`, `quotes.setSettings`,
  `extraLines`; `queries.ts` `quoteFor(kind, id)` builds the priced view
  of a project (allocations) or rental (lines) that the `QuoteSection`,
  the rentals list (`rentalSubtotals`) and `renderQuote` all use.
- Gear lines carry a day-price snapshot (`pricePerDay`, copied from
  `Model.rentalDayPrice` when the line is created, editable) and
  `discountPct`; the factor comes from the rate table at render time.
  Extra lines are fixed amounts. `chargeDays` null = booking window.
- Rate table rules beyond the last tier: `RATE_EXTRA_RULES` in
  `config/app.config.ts`. The default table is the fallback; a table in
  use cannot be deleted. Seed: `prisma/seed/pricing.ts` (also exported as
  `RATE_TABLE_SEED` for tests); the importer creates the sheet's tables
  only when none of that name exists.
- Quote settings and extra-line forms post `holderKind` + `holderId`;
  permission is `projects.write` or `rentals.write` by kind, rate tables
  need `settings.manage`. PDFs: `/api/projects/[id]/quote.pdf`,
  `/api/rentals/[id]/agreement.pdf`.

## Spreadsheet import (Phase 5a)

- `src/modules/importer`: `parse.ts` (exceljs → plain rows per sheet, every
  value keeps its `Sheet!A1`), `plan.ts` (pure: rows → `PlanRow`s in buckets
  `import | assumption | decision | parked` with `Op`s), `commit.ts`
  (`applyOps` in one transaction), `service.ts` (`importer.stash/plan/commit`;
  the upload waits in storage as `imports/<id>.xlsx` until confirmed).
  Pages: `/settings/import` (upload) and `/settings/import/[importId]`
  (preview, decision selects named `decision.<rowKey>`, confirm).
- Nothing is written before confirm. Models match by manufacturer + name,
  units by asset tag, contacts/locations by name, so re-running a file is
  safe. Sheet IDs become asset tags; `normaliseAssetTag` accepts them.
- Every imported row has `importSource`; the ActivityLog row
  (`spreadsheet_imported`) lists every created id, which is how
  `db:clean-tests` removes browser-test imports.
- The real workbook stays out of git (`*.xlsx`, `/import/` (root only: the pattern must not catch `settings/import`) ignored). Tests
  build a synthetic workbook in `__tests__/fixture.ts` with the same sheet
  names and column layouts; extend it when a reader changes.
- Server actions accept 25 MB bodies (`next.config.ts`) for the upload.

## Events, outbox, integrations

- Services call `emitEvent(type, data, { calendar })` (`src/lib/events.ts`)
  after a change. It writes `Outbox` rows: one `webhook.deliver` per
  subscribed webhook and a de-duplicated `calendar.sync_*` job.
- `src/lib/outbox.ts` is the worker (claim → handler → done/retry with
  backoff). Handlers register by type; calendar handlers are in
  `src/modules/calendar/handlers.ts`, started from `src/instrumentation.ts`.
  `POST /api/cron/outbox` processes the queue for serverless hosts.
- Google push (`src/modules/calendar/sync.ts`) is idempotent via
  `googleEventIds` on the row; the REST client is `google.ts` (service
  account JWT, no SDK). Tests inject a fake client.
- iCal feeds: `src/modules/calendar/feeds.ts`, served at
  `/api/calendar/<token>.ics`.
- Set `OUTBOX_DISABLED=1` when running one-off scripts or tests that must
  not deliver anything.

## Adding a new entity end-to-end

1. Model in `prisma/models/<module>.prisma`. Status-like fields are strings
   whose allowed values live in `config/app.config.ts`.
2. `npm run db:migrate -- --name add_<entity>`; commit the migration.
   Never edit applied migrations; never hand-edit the database.
3. Zod schemas in `src/modules/<module>/schema.ts` (shared by forms + API).
4. Service functions in `service.ts` taking `(actor, input)`; permission check
   first; write an `ActivityLog` row for mutations (from Phase 1).
5. Server actions in `actions.ts` (`"use server"`), calling the service and
   `revalidatePath`.
6. Pages under `src/app/(app)/...` compose module components.
7. Strings in `messages/en.json` (+ `da.json`).
8. Seed data in `prisma/seed/<module>.ts`, wired in `prisma/seed/index.ts`.
9. Tests: pure logic in `__tests__/*.test.ts`; flows in `e2e/`.
10. Update this file and `docs/ARCHITECTURE.md` if conventions moved.

## Gotchas

- Prisma 7: datasource URL is in `prisma.config.ts`, not the schema. The
  client is generated into `src/generated/prisma`; import from
  `@/generated/prisma/client`. `npm install` regenerates it (postinstall).
- `prisma migrate dev` needs the dev Postgres running, and it refuses to
  run without a TTY (it prompts on warnings). From a non-interactive shell:
  `npx prisma migrate diff --from-config-datasource --to-schema prisma
  --script -o prisma/migrations/<stamp>_<name>/migration.sql`, then
  `npx prisma migrate deploy` and `npx prisma generate`. Check the SQL
  before deploying: an empty file still gets recorded as applied.
- Auth.js `signIn()` succeeds by throwing a redirect; server actions must
  rethrow anything that is not an `AuthError`.
- Playwright config starts `next dev` locally and `next start` in CI
  (CI builds first). Seed must have run for the login test.
- Shell scripts and the Dockerfile must stay LF (`.gitattributes`).
- Windows dev machine: prefer `npm run` scripts over raw commands.
- After `prisma generate` the running `next dev` keeps the old client in
  memory (global singleton). Restart the dev server after schema changes.
- Multi-file bash heredocs fail in the Windows shell; write files with the
  editor tools instead.
- `items.db.test.ts` hits the real dev database and cleans up after itself.
- Multi-line text replacements in bash `node -e` break on quoting; write a
  patch script to the scratchpad and run it with `node file.js`. Files a
  `git checkout` has touched come back with CRLF on this machine, so a
  patch script must normalise `\r\n` to `\n` when it reads a file (or
  its anchors will not match).
- Only one `next dev` per project (lock in `.next/dev`). For checks while a
  dev server is already running, `npm run build` + `PORT=3001 npx next start`.
- Absolute URLs shown to people (share links, iCal feed addresses, QR
  codes) are built in the browser from `window.location.origin`
  (`ShareUrl`, `QrImage`), never from `APP_URL` or request headers: the
  dev machine is reached over https and a LAN address that the server
  cannot know. Route handlers that must build one server-side use
  `publicOrigin(req)`; only background jobs (iCal feed contents, Google
  Calendar links) rely on `APP_URL`, which production must set.
- A service that needs another module imports `@/modules/<name>/service`
  (or `/tree`, `/logic`) directly with an eslint-disable comment, not the
  barrel: barrels re-export server actions, which import next-auth, which
  does not load under Vitest. Pages and components keep using the barrel.
- `ActionForm` passes the clicked submit button to `new FormData(form,
  submitter)`, so buttons with `name="outcome" value="ok"` work like a
  native submit. Keep that when touching it.
- Do not use the build-generated global types (`RouteContext`, `PageProps`,
  `LayoutProps`) in source: CI runs `tsc` before `next build`, so they do not
  exist there. Type `params` explicitly: `{ params: Promise<{ id: string }> }`.
