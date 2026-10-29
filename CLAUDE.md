# CLAUDE.md — working notes for Vertigo Gear

Read this first in every session. Keep it current: when a convention changes,
change it here in the same commit.

## What this is

Self-hosted web app for Vertigo (Copenhagen light/laser/projection studio):
gear inventory, availability, projects, packing lists, production plans,
external rentals. Full spec: `SPEC.md`; the spreadsheet we migrate from and
what it implies: `MIGRATION.md`. Plan and data model: `PLAN.md`. Why things are the way they are: `DECISIONS.md`. Ideas:
`BACKLOG.md`. Data model diagram: `docs/ARCHITECTURE.md`.

Current phase: **October spec update done** (wish list, purchase records, sub-hire after 5b). Next: whatever use at Vertigo turns up (BACKLOG.md).

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

Production: the office server runs `docker compose --profile tunnel up -d --build` (see README, Running the server).

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

Modules import each other only through three entries (ESLint-enforced):
`@/modules/<name>` (the barrel: services, queries, schemas, logic; server
code only, never a component), `@/modules/<name>/actions` (server actions,
what client components import) and `@/modules/<name>/components/<file>`
(one component file; pages and other modules' components import
components this way). The barrel must not re-export components: Next puts
every client component the server code can reach into the page's bundle,
so one re-export made `/board` and the share pages ship every dialog of
the module.

## Language

- English and Danish (`appConfig.locales`), no locale in URLs. `src/i18n/request.ts`
  picks per request with `pickLocale` (`src/lib/locale.ts`, pure, tested):
  the user's saved `User.locale`, else the `locale` cookie, else
  Accept-Language, else English. `LanguageToggle` (sidebar, phone "More"
  sheet, sign-in page, account page) calls `setLanguage`, which sets the
  cookie and, when signed in, saves the choice on the user.
- Only the UI chrome is translated. Data people type (model names,
  categories, notes) is stored once and searched as written, whatever the
  UI language. Still English everywhere: PDFs, calendar event titles,
  CSV headers, activity log summaries and service error messages (thrown
  in English from services). Dates and money always use da-DK formats.
- Add a string to both `messages/en.json` and `messages/da.json`
  (same keys; check with the parity snippet in git history or by eye).

## Navigation

- Layout (Settings › Layout, `settings.manage`, one setting for everyone,
  `AppSetting` key `layout` via `appSettings` in
  `src/modules/settings/app-settings.ts`; `LAYOUTS` in the config):
  `AppShell` carries `data-layout`, and the `roomy:` Tailwind variant
  (globals.css) switches the wide parts on. A page root with `data-wide`
  drops the content width cap under roomy (packing list, production
  plan); columns are `roomy:lg:…` / `roomy:xl:…` classes. Compact must
  look exactly like the old single-column layout, so wrap, never reorder.

- Desktop (md+): left sidebar (`sidebar.tsx`). Phone: top bar + bottom tab bar
  with a "More" sheet (`mobile-nav.tsx`). Both read `NAV_ITEMS` in
  `src/components/navigation.ts`; add a section there, not in the components.
- Every nav item has a route. Unbuilt sections render `ComingSoon`.
- Page headings are `<h1>` so the e2e tests and screen readers can find them.
- Nothing may make a page wider than a phone: the content box scrolls
  (overflow-y: auto), so anything too wide makes the whole page scroll
  sideways. A grid that sets columns only from a breakpoint starts with
  `grid-cols-1` (minmax(0, 1fr); an implicit column cannot shrink below a
  truncated name), rows with buttons `flex-wrap`, and tables sit in an
  `overflow-x-auto` box. `e2e/phone-width.spec.ts` checks the main pages
  at 360 px.

## Auth and permissions

- `requireActor()` in layouts/pages redirects anonymous users.
- `requirePermission("inventory.write")` in every server action and service
  mutation. Permissions and roles are defined in `config/app.config.ts`;
  `can(role, permission)` is pure and unit-tested.
- `src/proxy.ts` only does an optimistic cookie check; it is not the
  authorisation layer.
- Two-factor sign-in (TOTP, `src/lib/auth/totp.ts` pure + RFC 6238
  tests; `two-factor.ts` seals the secret with AES-GCM under a key from
  `AUTH_SECRET`, user id as AAD; `twoFactor` in
  `src/modules/users/two-factor.ts`). Login is two steps: a right
  password without a code returns `needCode` and the form asks for it,
  keeping email and password; `authorize` checks password + code
  (`twoFactor.verify`: each 30-second step once via `totpLastStep`,
  recovery codes are sha256 hashes used up once). Roles in
  `TWO_FACTOR_REQUIRED_ROLES` (unset = admin) without 2FA are signed in
  for `/two-factor` only: `requireActor` redirects there, `getActor`
  returns null (APIs answer 401), and only that page uses
  `requireActorForTwoFactorSetup`. The setup secret travels sealed in the
  form until a code matches; the confirm action must not `revalidatePath`
  (the re-render would leave the page before the recovery codes show).
  Admins reset someone's 2FA on the user page; `create-admin.mjs` clears
  it too. CI and Playwright run with `TWO_FACTOR_REQUIRED_ROLES=none`
  (the specs sign in as the seeded admin); set it when you start a server
  for the browser tests by hand. `e2e/two-factor.spec.ts` covers the flow
  with a throwaway `e2e-2fa-*` user that `db:clean-tests` removes.
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
- Numbers with decimals (prices, weights, sizes, discounts, factors,
  metres, number extra fields) use `DecimalInput`
  (`src/components/form/decimal-input.tsx`: text with the decimal keypad,
  since `type="number"` drops a comma) and parse through `decimalText`
  (`optionalNumber`, `decimal(schema)` in `src/lib/forms.ts`): "12,5" and
  "12.5" both work, and with both marks the last is the decimal point
  ("1.234,50"). Whole-number fields (quantities, sort order) stay
  `type="number"`.
- Native `<select>` (`NativeSelect`) in forms so FormData posts without JS.
  On mouse screens in Chromium, globals.css turns them into customizable
  selects (`appearance: base-select`) so the open list uses the app font
  and colours; options are `display: block` because tree indents are
  runs of spaces. Phones and other browsers keep the native picker.
- List filters use `LiveFilterForm` (`src/components/form/live-filter-form.tsx`):
  a GET form that applies selects and checkboxes at once and typing after
  300 ms via `router.replace` (URL stays the source of truth, page number
  dropped, empty fields left out). Fields follow navigations it did not
  make (Clear, back). Keep a submit button with `group-data-[live]:hidden`
  as the no-JS fallback.
- Search is forgiving everywhere (`src/lib/search.ts`, pure): spaces,
  case, punctuation and accents never matter (`squash`: "qbase" finds
  "Q Base", "vg12" finds "VG-12"), every word must appear in any order,
  and when nothing matches, close matches (one typo per word from four
  letters, two from eight) come back with `close: true`. The list
  queries (models, items, kit candidates, projects, rentals) load the
  id + text fields of the rows the other filters allow, run
  `bestMatches` and filter by `id in`; lists return `closeMatches`
  and the pages say so. The gear picker uses `searchCatalog`. New
  searchable lists go the same way, not through Prisma `contains`.
- Search words (`GlossaryGroup`, Settings › Search words, `settings.manage`,
  `glossary` in `src/modules/settings/glossary.ts`): groups of words that
  mean the same (arbejdslys, worklight). `bestMatches(.., glossary)` and
  `searchCatalog(.., glossary)` let a query word also match its partners
  (`queryTerms`, up to three words form one term; the last word, still
  being typed, from three letters also takes the partners of every term it
  begins, so "flyver" finds what "flyverdragt" finds); partners shorter than
  five letters must start a word ("lamp" not in "clamp"); groups do not
  chain. Used by models (which also match their category path), items,
  kit candidates, apps and the gear picker (groups passed to the browser);
  not by projects or rentals. Names are never translated. The migration
  seeds a starter list; saving replaces the whole list.
- DB tests run in parallel and many pick "any admin / any member": a test
  that creates users must give them the viewer role in the database (act
  with other roles in memory) and delete them afterwards.
- REST: handlers under `src/app/api/v1/**` use `handler(permission, fn)`
  from `src/lib/api/respond.ts` and the module zod schemas. Add new
  endpoints to `src/lib/api/openapi.ts` so `/api/docs` stays complete.
- Deleting a model is refused while items, reservations, rental lines,
  packing lines or template lines point at it (`modelUsage`). Admins
  (`users.manage`) can force it: `models.remove(.., { force })` and
  `models.bulk(.., "delete", { force })` run `cascadeModel`, which removes
  those rows first. The inventory list's `FamilyList` has the bulk bar
  (archive / unarchive / delete, "delete anyway" for admins).
- A **family** is every model with the same name (case-insensitive);
  the manufacturer belongs to each variant and never splits a family.
  Admins edit a family in one go (`models.editFamily`, `EditFamilyDialog`
  on the model page, defaults from `familyState`): name, manufacturer
  (left alone when the variants differ and the field stays empty),
  category and the flags (not for rental, consumable, archived). Refused
  when a renamed variant's size already exists under the new name, or when
  metre consumables with stock would stop being consumables. Sizes, stock,
  weight and prices stay per variant.
- A model is one **variant** of a family: `name` is the family ("DMX
  5-pin", "16 mm rustfri rods"), `variant` the size ("5 m", "150 cm", or
  null). Stock, weight and price stay per model. The inventory list groups
  by family (`groupFamilies`), `ModelSelect` renders families as
  `<optgroup>`s, the gear picker groups results (`groupCatalog`), and
  the importer matches models by name + variant (`modelKey(name, variant)`;
  an existing model without a manufacturer gets the sheet's), the seed by
  (manufacturer, name, variant).
  `splitVariant` / `compareVariants` in `src/lib/variant.ts` split a
  legacy combined name and sort sizes numerically.
- Names lead, the manufacturer follows. `modelLabel(m)` is name +
  variant ("Pointe", "DMX 5-pin 5 m") and is what text uses everywhere
  (packing lists, PDFs, labels, quotes, calendar, activity). On screen
  `ModelName` (`src/components/model-name.tsx`) adds the manufacturer
  small and grey after the name; dropdown options use
  `modelLabelWithMaker` ("Pointe (Robe)"); `makersOf` lists a family's
  manufacturers. `Model.manufacturer` may be empty (own-built gear,
  cables, rods). Never build labels by hand from manufacturer + name.
- Sorting (`src/modules/inventory/sorting.ts`, pure, tested): the model
  list takes `?sort=` (`MODEL_SORTS`: name, category, manufacturer,
  units, out, packed, newest, price, weight) and sorts families after
  search and before paging (`sortFamilies`, Danish collation, largest
  first for numbers, missing values last, ties by name); `packed` sums
  packing-line quantities of the last 12 months (one groupBy, only when
  chosen). The row shows the sorted-by value; category sort adds headings.
  The item list maps `ITEM_SORTS` to a Prisma orderBy (`itemOrderBy`).
- Labels: `LABEL_SIZES` in `config/app.config.ts` (sheet grids with gaps,
  or `page: "single"` for thermal rolls); `label-layout.ts` is the pure
  geometry (centred grid, offset, page count) and `labels.tsx` renders the
  PDF with react-pdf + qrcode. `GET /api/labels/sheet.pdf` takes `ids=` or
  the item list's filters plus `size` and `offset`; `LabelsDialog` builds
  that URL (with the browser origin for the QR, like `QrImage`).
- Tracking (serialized / bulk) is fixed in the model form once items
  exist, but admins can convert on the model page (`ConvertTrackingDialog`
  → `models.convertTracking`; `planTrackingChange` in `tracking-change.ts`
  is pure). To bulk: in-house loose units merge into one bin, the lowest
  asset tag, and the other units are deleted with their own data; units
  that are out, in repair, missing, retired or in a case stay as their own
  rows; cases with contents block it. To serialized: bins of several in
  house split into units with new asset tags (date and supplier copied,
  prices not); a bin of several that is out blocks it. Unit pins on
  allocations, rental lines and draft packing lines are cleared.
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
- Contacts (`src/modules/contacts`) are the contact library: people and
  companies who are not users (venue people, freelancers, suppliers,
  partners, borrowers); permissions `contacts.read/write`. Own nav item
  `/contacts` (forgiving search over name, organisation, email, phone,
  address; person / company filter) and a page per contact
  (`contactDetail`: its projects with the job's role, gear it holds,
  sub-hire items it owns, purchases for finance readers, activity).
  `/settings/contacts` redirects there. `ProjectContact` is a link
  (`contactId`, Restrict) plus the job's `role` and `notes`; name, phone
  and email come from the contact (`projectContactsInclude` +
  `projectContactRow` in projects/queries.ts flatten it for the project
  page, plan, PDF and API). `projects.addContact` takes a `contactId`
  or a new person (`contacts.write`), who is created in the library in
  the same transaction; a contact is on a project once. `contacts.remove`
  is refused while the contact is on a project, owns sub-hire items or
  holds gear. Clients stay separate for now.
- Colour coding (screen only): `Category.color` is a palette key from
  `COLOR_PALETTE` (`src/lib/colors.ts`, hex rendered inline, never
  Tailwind classes), set on top-level categories by admins
  (`categories.setColor`, swatches on the categories page) and inherited
  downwards (`categoryColorMap` in `color-map.ts`, pure). A top-level
  category with `lengthColors` on means its models are cables with tape
  by length: `LengthColor` rows (metres → colour, `lengthColors`
  service, table on the categories page) give a variant that parses to
  that length (`variantMetres`) a dot (`lengthColorFor`).
  `loadColorMaps()` loads both maps once per page; rows carry `color` /
  `lengthColor` and the `ColorBar` / `ColorDot` atoms
  (`src/components/color-marks.tsx`) draw them in the inventory list, on
  the model page, in the gear picker and on packing list groups and lines.
  Never on labels, PDFs or the calendar.
- Consumables (`src/modules/inventory/consumables.ts`, pure helpers in
  `consumables-logic.ts`): `Model.consumable` + `unit` (`pcs` | `m`) +
  `minStock`. Pieces (lamps) keep stock in bulk bins as before; metres
  (LED strip, alu profile) have no items and keep stock in the
  `StockMovement` ledger (sum of `quantity`; `received` / `used` /
  `count`). `consumables.use` takes from the fullest bins (pieces) or the
  ledger (metres), writes a `used` row with the optional unit
  (`itemId`, so the unit's activity shows "part used") and project;
  `receive` / `count` are metres only. `stockByModel` is the one stock
  answer; `lowStock()` feeds the dashboard's "Running low" with a
  wish-list button (`wishes.fromModel`). `PartFit` links a part to the
  models it fits with the spare rule (`perUnits`, `minQty`;
  `sparesFor` / `suggestSpares` are pure). A model's unit cannot change
  once it has items or ledger rows. Metre consumables are left out of the
  gear picker and have no items, labels or reservations on their page.
- Custom field definitions can be scoped to a category
  (`categoryId`, applies to sub-categories). `forEntity(entity)` returns
  every definition with `categoryIds` resolved; `forEntity(entity,
  categoryId)` only the applicable ones. Forms filter with
  `applicableDefs` as the category/model changes; actions validate with
  the category. Seeded sets: projectors, LED controllers, alu profiles,
  computers, truss. The seed never runs on a server, so the same list
  (`FIELDS` in `prisma/seed/custom-fields.ts`) is also created by the
  migration `extra_fields_standard_set` where the category path exists and
  no field with that key or label does (values stored under a standard key
  are copied into a hand-made field of the same label); keep the two in step when adding a standard
  field (a new migration, never an edit of the old one).
- `showInList` (models only, Settings › Extra fields) puts a field on the
  inventory list: `listModels` returns `listFields` (`listFieldText` in
  `src/lib/custom-fields.ts`: "3.500 Lumen", "Throw ratio 1.15–1.5"), and
  `FamilyList` shows them with weight and power draw as aligned columns
  right after the name (fixed name width from `lg`; one line under the
  name below that), the count stays at the far right. Sizes in a family share
  columns; models without sizes share one set across the page.

## Availability, projects, rentals

- **Gear on projects is hidden for now.** `projectGearEnabled()`
  (`src/lib/features.ts`, env `PROJECT_GEAR=on`, off by default) gates the
  project page's Reserved gear, Rent in and quote sections, the reservation
  count on the projects list, the "Gear reserved" subtitle and "from the
  reservations" when starting a packing list. Only the UI is hidden: data,
  services, routes and rentals are untouched. CI and Playwright run with it
  on so the hidden parts stay tested; pass it when starting a server for
  the browser tests by hand.
- **One allocation table.** `Allocation` rows (project or rental line,
  model, quantity, optional unit, inclusive dates) are the only source for
  availability. `computeAvailability` / `checkRequest` in
  `src/modules/projects/availability.ts` are pure and unit-tested; services
  load items + allocations with `itemsForModel` / `allocationsFor`, pages
  that check many models with `itemsForModels` / `allocationsForModels`
  (one query each, maps by model id). Pass the window being checked:
  only live allocations (holder not done, cancelled or returned) that
  touch it are loaded, never a model's whole history. The
  rentals service and rental pages pass `{ forRental: true }`, which
  leaves units flagged not-for-rental out of `owned` (reported as
  `notRentable`), so a rental can never be promised gear it cannot have.
- A reservation that does not fit throws `ConflictError` with the check;
  actions return it as `state.data.conflict` and the dialog offers
  "reserve anyway" (`force`). Rentals use the same engine.
- Project phase dates live on the project. Prep, build-up and pack-down
  are continuous day ranges (`prepStart/End`, `buildStart/End`,
  `packStart/End`, date-only) and build-up / pack-down carry one call
  time each (`buildCall`, `packCall`, "HH:MM"); the show is two instants
  and return one day. One end alone means a single day (`dayRange`). The
  calendar phase keys stay `load_in` / `load_out` (Google event ids are
  stored under them) but read "Build-up" / "Pack-down"; `PHASE_DATES`
  maps each phase to its fields. In the project form every later date
  field gets a `min` from `dateFloors` (projects/date-floors.ts, pure): the
  latest phase start filled in above it, so its picker opens on the job;
  phases may overlap but not start before an earlier phase. Calendars (Google push and iCal feeds)
  use `jobEvents` (`src/modules/calendar/job-events.ts`, pure): one
  all-day banner per job over its whole span with every phase in the
  description, build-up / pack-down as timed events from the call time
  (one per day, key `load_in:<day>`, `appSettings.callHours()` long,
  Settings › Calendar, default `CALL_HOURS`), the show timed; prep,
  return and call-less build-up days only appear in the banner.
  `syncProject` deletes stored event ids it no longer produces; saving
  the length queues `queueAllProjectSyncs`. The reservation window
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
- Pack mode lists lines still to pack plus lines packed in the last 15
  minutes; older finished lines fold into "Packed". Every out-check has an
  Undo (`UndoTick` → `untickCheck`, which answers `{ ok, error }`; a
  repeat undo is a no-op), and so has the last scan (`checkId` in the
  ticked result). "Pack all" (`packingChecks.tickAll`) ticks the first
  in-house units of a serialized line in asset-tag order, up to what it
  needs, and reports `{ packed, missing }`.
- `ShareLink` rows (`targetType`, `targetId`, random token) are generic;
  `/share/packing/[token]` and `?share=<token>` on the PDF route are the
  Phase 3 consumers. Public pages live under `src/app/share/` outside the
  app shell, and `proxy.ts` lets `/share/` through without a session.
- Templates (`PackingTemplate`) hold model lines only, no units or kits.
- Spare suggestions: `spareSuggestions(listId)` applies the `PartFit`
  rules to the models on a draft list (`suggestSpares`, pure; in-house
  stock minus what the list already holds, since draft lines are still on
  the shelf) and `SpareSuggestions` shows them under the picker: *Add*
  posts an ordinary line, a shortfall goes to the wish list, *Not this
  time* stores the part id in `PackingList.dismissedSpares`. Metre
  consumables are never suggested. Check-in has a fourth outcome,
  `used` (consumable bulk lines only): the quantity leaves the travel
  bin for good and a `StockMovement` linked by `packingCheckId` records
  it on the project; `undoCheckIn` deletes that row and puts the
  quantity back. `LineProgress.used` counts it as answered.
- Lines are added with the `GearPicker` (one search box over
  `gearCatalog()`: models with stock and asset tags, kits in house, and
  what is already on the list); `filterCatalog` in `picker.ts` is pure
  and tested. Enter adds the highlighted row, so a barcode scanner that
  types a tag + Enter adds the model. The same picker feeds templates.

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
  an **anchor day** (`dayOffset`, first build-up day = 0). `materialiseTemplate` dates
  them; `templateFromPlan` is the inverse used by "save as template". Both
  are pure and tested in `src/modules/plans/logic.ts`.
- "My day" (`myDay(userId)` in `src/modules/plans/my-day.ts`,
  `MyDaySection` on the dashboard): today's and tomorrow's schedule on
  the projects I crew (or where I am responsible), my open tasks with
  overdue / due-soon flags and a done button, and "Coming up": projects
  starting in the next seven days (not the calendar week) with my call
  time. Finished and cancelled projects are left
  out. `renderPlan(detail, { forUser })` is the "my plan" PDF (whole
  schedule, only my tasks and call time), served with `?me=1`.
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
- Word files (`fileConfig.convertToPdf`: .docx .doc .odt .rtf,
  `convertsToPdf` in logic.ts) get a PDF copy when added:
  `documents.add` runs `convertToPdf` (`src/lib/office-convert.ts`:
  LibreOffice headless, one at a time, own profile dir per run, 2 min
  timeout; `SOFFICE_PATH` or `soffice` on the PATH; the Docker image has
  libreoffice-writer plus Carlito/Liberation fonts) and stores it as
  `PlanDocumentVersion.pdfFileId`. A version with a copy has `kind` "pdf"
  and `viewUrl` = the copy: viewer, markup pages and plan PDF use it,
  `url` stays the original (download). No LibreOffice or a file it cannot
  read: the version stays a download, and the document page offers *Make
  PDF* (`documents.makePdf`) when the server can convert. Tests pass a
  fake converter (`{ convert }`). `deleteFileIfUnused` and
  `fileIdsForPlan` know the copies.

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

## Export and backup

- `GET /api/export/<list>.csv?<filters>` (models, items, projects,
  rentals, contacts) walks the list query's pages and writes CSV via
  `src/lib/csv.ts` (BOM, semicolons, formula-safe). "Export CSV" links on
  the list pages pass the page's search params through.
- `src/modules/backup`: `TABLES` is every Prisma model in insert order
  (a test compares it with `Prisma.ModelName`; add new models there),
  `backup.export` dumps all rows, `backup.restore` deletes in reverse and
  re-inserts in one transaction (self-referencing tables sorted parents
  first, nullable Json nulls as `Prisma.DbNull`). Admin only. Its DB
  tests wipe and refill the database, so they only run alone:
  `npm run test:backup` with `BACKUP_RESTORE_TEST=1` (a separate CI
  step), never inside the parallel `npm run test`.

## Wish list

- `WishItem` (`src/modules/wishlist`) is gear to buy: the model fields
  (manufacturer, name, variant, category) plus quantity, expected price,
  expected rental day price, link and notes; status `open | bought`. A
  wish is never a model and takes no part in availability or packing.
- Converting: the list links to `/inventory/models/new?wish=<id>`, which
  prefills `ModelForm` (prop `prefill: Partial<ModelDto>`, hidden
  `wishId`); `saveModel` creates the model and calls
  `wishes.markBought(actor, wishId, modelId)`. "Bought" without a model
  (`wishes.setStatus`) is for reference material and consumables.
- Permissions are the inventory ones (`inventory.read/write`); the page is
  an inventory tab (`/inventory/wishlist`, `?status=bought`), and
  `/api/export/wishes.csv` exports it.
- The importer writes the projector "Ønsker" rows and the Dirverse castor
  references as `WishOp`s (idempotent on `importSource` + name).

## Calendar entries (agenda)

- `CalendarEntry` (`src/modules/agenda`, `agenda.write`: admin, member) is
  anything in the calendar that is not a project or rental: kind
  `meeting | time_off | assignment` (`ENTRY_KINDS`, with bar colour), an
  optional job (`projectId`, set null when the project goes), `allDay`
  (time off always; whole days are UTC midnight first/last day like other
  date-only values, timed ones are instants), `CalendarEntryPerson` rows
  (time off is exactly one person, default the actor), `guests` (emails).
  `logic.ts` is pure (`entryTimes`: an end before the start runs past
  midnight; `entryTitle`, `parseGuests`, `googleTemplateLink`).
- Shown on: the calendar timeline (bars of kind `entry`, merged in the
  calendar page), `/calendar/entries/[id]` (edit, delete, "Add to Google
  Calendar", `/api/agenda/[id]/entry.ics`), the project page ("Meetings and
  assignments"), My day (rows with `href`), the office screen agenda, and
  the "mine" iCal feed. The office screen account is never a person.
- Google: every change queues `calendar.sync_entry` (`queueCalendarSync` in
  `src/lib/events.ts`; a deleted entry hands its `googleEvent` to the job).
  `syncEntry` (calendar/sync.ts) uses `entryGoogle` (`entry-events.ts`,
  pure): with Settings › Calendar › Invitations on (`appSettings
  .calendarInvites`, needs domain-wide delegation for `CALENDAR_SCOPE`)
  the client acts as the person (`GoogleCalendar(account, fetch, subject)`,
  JWT `sub`): time off in the person's own calendar, meetings and
  assignments from the creator's with attendees and `sendUpdates=all`.
  Off, or `GoogleDelegationError` (not a Workspace address, delegation
  withdrawn): the shared projects calendar with names in the title. When
  the target changes, the old event is deleted first. Toggling queues
  `queueAllEntrySyncs`.

## Office screen

- `/board` (`src/app/board/page.tsx`, outside the app shell) is the
  screen on the office wall: job cards for the next 14 days
  (confirmed / in progress, with phases, crew and packing progress),
  today and tomorrow (phases with call times, plan schedule, rentals out
  and back) and a long timeline at the bottom (`?months=` 1–12, default
  6; bars packed into rows by `packLanes`, from `timelineBars`, which
  skips the calendar's conflict check). Data: `boardData`
  (`src/modules/board`, pure parts in `logic.ts`; packing lists of all
  jobs in one query via `listsForProjects`). `BoardRefresh` re-reads
  every minute while the page is visible (at once when it comes back) and
  touches `/api/auth/session` every half hour so the cookie never expires.
- Its theme is its own, per screen: localStorage `boardTheme`, dark
  unless set to light. `boardThemeScript` (`theme-script.ts`, a plain
  module so the server page can call it) runs inline before paint and
  stores `?theme=light|dark`; `BoardThemeToggle` in the footer switches
  it and puts the app's theme back when the board unmounts.
- Permission `board.read` (every role). The `display` role has only that:
  the (app) layout redirects it to `/board`, the APIs refuse it, and the
  user pickers (crew, assignees, person locations) leave it out. The seed
  has `screen@vertigo.test`.

## Apps

- `App` (`src/modules/apps`, page `/apps`, nav "Apps" under tools) is one
  shared list of what the crew uses a lot, kind `file | link | tool`
  (`APP_KINDS`, fixed once created), with a free-text `category` the list
  groups by and the forgiving search. Permissions `apps.read` (everyone)
  and `apps.write` (admin, member); deleting an app or a version is admin
  only (`users.manage`), and the files go with it (`deleteFileIfUnused`
  knows `AppVersion`).
- Files and tools keep every `AppVersion` (label, notes, `File`), newest
  first. Uploads use the chunked uploader; its browser half is
  `uploadFile` in `src/lib/upload-client.ts` (shared with plan documents).
- A tool is one HTML file (≤ 10 MB). `/apps/[id]/run` frames
  `/api/apps/versions/[id]/run` with `sandbox` (no allow-same-origin),
  and the route sends the same sandbox as a CSP header, so the tool gets an
  opaque origin and cannot read cookies or call the API as the user, framed
  or opened in a tab. Never serve tool HTML from `/api/files` inline.

## Sub-hire catalog

- `SubHireItem` (`src/modules/subhire`) is gear a partner company owns
  that we rent in: owner (a company contact, required), the model fields,
  `costPerDay` (what they charge us) and `rentalDayPrice` (what we
  charge), links, archived flag. Not inventory: no items, no availability.
  Catalog page `/inventory/subhire` (inventory tab; `inventory.write`).
- `SubHireLine` is "rent in N of this from X" on a project
  (`projects.write`): dates default to the window, cost and price are
  snapshots of the item (filled from it when left empty). Lines are
  removed with the project; an item on a line cannot be deleted, only
  archived.
- Where they surface: `quoteFor("project")` adds them as gear lines with
  `modelId: null`, the owner in the label and `subHire: { owner,
  costPerDay }` for the internal view (`QuoteGearLine.modelId` is
  nullable; link only when set). `listDetail` returns them as
  `subHire` and the packing page, PDF and share page list them under
  "Rented in"; they are never packing lines, so nothing is ticked or
  checked in for them.
- The importer writes the GearGuys projector rows as `SubHireOp`s (owner
  contact GearGuys, the sheet's day price as our charge), idempotent on
  `importSource` + name. Nothing on the current sheet is parked any more.

## Purchase records

- `Purchase` (`src/modules/purchases`): one row per quote / order /
  invoice line on a model: supplier (a company contact), date, reference,
  quantity, list price, discount %, net price per unit (computed by
  `netFrom` when left empty), notes. Cascades with the model; the
  supplier link is set null when the contact goes.
- Reading needs `inventory.finance` (same gate as unit purchase prices),
  writing `inventory.write` too. The model page shows `PurchasesSection`
  only to finance readers; each record has its own page
  (`/inventory/purchases/[id]`) where the quote PDF is attached through
  the files module (`entityType = "purchase"`, allowed in
  `files/actions.ts`). `/api/export/purchases.csv` exports them.
- The importer reads the truss quotes line by line (`readTruss().quotes`,
  `parseQuoteTitle` for the number and Danish date) and writes a
  `PurchaseOp` per line that matches a truss model by code; the order
  total, invoice discount and unpriced lines go in the notes. Idempotent
  on `importSource` + model.

## Spreadsheet import (Phase 5a)

- `src/modules/importer`: `parse.ts` (exceljs → plain rows per sheet, every
  value keeps its `Sheet!A1`), `plan.ts` (pure: rows → `PlanRow`s in buckets
  `import | assumption | decision | parked` with `Op`s), `commit.ts`
  (`applyOps` in one transaction), `service.ts` (`importer.stash/plan/commit`;
  the upload waits in storage as `imports/<id>.xlsx` until confirmed).
  Pages: `/settings/import` (upload) and `/settings/import/[importId]`
  (preview, decision selects named `decision.<rowKey>`, confirm).
- Nothing is written before confirm. Models match by name + variant,
  units by asset tag, contacts/locations by name, so re-running a file is
  safe. Sheet IDs become asset tags; `normaliseAssetTag` accepts them.
- Every imported row has `importSource`; the ActivityLog row
  (`spreadsheet_imported`) lists every created id, which is how
  `db:clean-tests` removes browser-test imports.
- The real workbook stays out of git (`*.xlsx`, `/import/` (root only: the pattern must not catch `settings/import`) ignored). Tests
  build a synthetic workbook in `__tests__/fixture.ts` with the same sheet
  names and column layouts; extend it when a reader changes.
- Server actions accept 25 MB bodies (`next.config.ts`) for the upload.
- Spec lookup (model page, `inventory.write`, on when
  `configuredExtractor()` finds a provider key: `GEMINI_API_KEY`,
  `SPEC_LOOKUP_MODEL`, `SPEC_LOOKUP_PROVIDER`): three swappable parts.
  A **source** (`lookup-source.ts`, `SpecSource.gather`) turns a model
  into documents as plain text; today `linkSource`: the pasted product
  page or PDF via `fetchPublic` (every redirect hop checked against
  private addresses, 15 MB, 20 s), `htmlToText` plus `embeddedText`
  (JSON / ld+json data: script-built sites like Robe keep their specs
  there), and the first datasheet link on the page (`datasheetLinks`:
  datasheet / spec sheet words, then PDF manuals; never legal papers),
  PDFs read with pdf.js (`pdfToText`, `serverExternalPackages`). An
  **extractor** (`lookup-extract.ts`, `SpecExtractor.extract`) gets one
  provider-neutral request (`buildRequest`: standard fields + the
  category's extra fields as `x:<key>`, evidence per value, never guess)
  and returns an `Extraction`; `geminiExtractor` calls the Interactions
  API with a JSON schema, `store: false` and **no Google Search** (its
  terms forbid storing grounded results). `toSpecRow` turns it into a
  spec-sheet row (`foundNumber`: dot decimals, comma thousands), so
  `specLookup.preview/apply` (`lookup.ts`) plan and write exactly like
  the spec sheet (`planSpecs`, `writeSpecRow`, `specsCheckedAt`), with
  the quotes shown under each value (`SpecChangeTable`). Tests pass a fake
  source and extractor (`LookupDeps`). A search-based source or another
  provider only adds an implementation; automatic lookups would call
  `specLookup` from an outbox job and apply the fills.
  A product page also offers up to eight pictures (`productImages`:
  Product data, og:image, then the page's own images; no marker is
  reliable, so the reviewer picks one or none); `apply` fetches the chosen
  one with `fetchPublic`, checks it with sharp, attaches it through
  `files.upload` and makes it the model's default photo. Every model
  photo (`entityType` model, kind photo) gets its thumbnail with the
  background made transparent (`removeBackground` in
  `src/modules/files/background.ts`); the original file is never
  changed. With `BG_REMOVE_MODEL` + `BG_REMOVE_DEVICE` (the image ships
  BiRefNet; `docker-compose.gpu.yml` sets `cuda`) onnxruntime-node draws
  the mask (1024² planar ImageNet input, sigmoid output; pure helpers
  tested). Otherwise, or when it fails, `cutOutBackground`
  (`cutout.ts`, pure: border colour, flood fill, soft edge; busy or
  already transparent pictures are left alone).
- Spec sheets (`/settings/import/specs`, `settings.manage`): a CSV keyed
  by model `Id` (from the models export) with weight, width, height,
  depth, power, description and links; any other column whose header
  matches an extra field of the model's category by label or key
  (`squashHeader`: case, spaces and punctuation ignored) fills that
  field, read by its type (numbers take Danish thousands / decimals).
  `specs.ts` is pure (`readSpecSheet`, `planSpecs`, `specUpdate`;
  semicolons or commas, Danish decimals, Excel's Windows-1252),
  `specs-service.ts` plans against the models as they are now on both
  preview and apply. Each change is a checkbox (`pick` = `pickKey(model,
  field)`): empty fields start ticked, values the model already has start
  unticked (ticked = replaced); links are appended by URL; a known extra column the category lacks
  shows as skipped. Each changed model
  gets a `specs_imported` activity row (filled in / replaced). Every
  model in an applied sheet gets `Model.specsCheckedAt` (only shown in
  the models CSV export, "Specs checked"), so a later lookup can skip
  them. The sheet's text travels in a hidden field between preview and
  confirm; nothing is stashed.

## Deployment

- `docker compose --profile prod` runs db + app + Caddy; Caddy (`Caddyfile`,
  `APP_DOMAIN`) terminates HTTPS, the app listens on 127.0.0.1 only
  (`APP_BIND` widens it).
  `docker compose --profile tunnel` is the office setup behind a
  Cloudflare Tunnel: `cloudflared` (token in `CLOUDFLARE_TUNNEL_TOKEN`)
  forwards to `app:3000` over the Compose network, Cloudflare terminates
  HTTPS and sets the `X-Forwarded-*` headers the app already honours; no
  Caddy, no open ports, `deploy.yml` does not apply. This is the setup in
  use; SSH reaches the server on the LAN and over Tailscale (README,
  *Remote access*). The container
  healthcheck and `deploy.yml` poll `GET /api/health`.
- The image is Debian (build) and `nvidia/cuda` Ubuntu (runtime), not
  Alpine: onnxruntime-node and CUDA need glibc. The app user keeps the
  Alpine ids 100:101 so the uploads volume stays writable. CI sets
  `ONNXRUNTIME_NODE_INSTALL=skip` (no CUDA download); the image fetches
  the CUDA provider in `deps-prod`. The GPU is opt-in via
  `COMPOSE_FILE=docker-compose.yml:docker-compose.gpu.yml` in `.env`,
  since a GPU reservation fails on a host without the NVIDIA toolkit.
- The production image has no `tsx` and no `src/`, so the dev seed cannot
  run there (and would load demo data). The first admin on a server comes
  from `scripts/create-admin.mjs` (plain Node, `pg` + `bcryptjs`, copied
  into the image): `docker compose exec app node scripts/create-admin.mjs
  <email> "<name>"`; it also resets a password. Keep its bcrypt rounds and
  password minimum in step with `src/lib/auth/password.ts` and
  `passwordSchema`.
- `scripts/backup.sh` / `scripts/restore.sh`: one tar.gz with `db.sql` and
  `uploads.tar`, optional rclone off-site copy (`BACKUP_REMOTE`). Keep
  them POSIX sh and LF.
- Login is rate-limited in `src/app/(auth)/login/actions.ts` with the
  in-memory `loginLimiter` (`src/lib/rate-limit.ts`): ten failures per
  email + address, then fifteen minutes. One process, no store.

## Installable on phones (PWA)

- `src/app/manifest.ts` serves `/manifest.webmanifest` (standalone,
  start at `/dashboard`, shortcuts to Scan / Projects / Inventory);
  icons are PNGs in `public/icons/` rendered by
  `npx tsx scripts/make-icons.ts` (committed, re-run after changing the
  mark). The root layout sets `manifest`, `appleWebApp` and the
  light/dark `themeColor`.
- `public/sw.js` is the service worker: navigations go to the network and
  fall back to `/offline` (a public page) when it is unreachable; only
  `/_next/static` and the icons are cached. The one exception is packing
  lists: every `/projects/<id>/packing/<listId>` page and its
  `list.pdf` that was opened is kept in the pages cache (last 20, with
  an index of titles at `/__offline-index`, built from the page's
  `<title>`, which `generateMetadata` sets from `listTitle`), and
  served when the network fails; `/offline` lists them (`SavedLists`).
  Reading only: ticks, check-out and check-in are server actions and need
  a connection. Other API responses and uploads are never cached.
  `RegisterServiceWorker` (root layout) registers it in production only.
  Bump `VERSION` in `sw.js` when the caching rules change.
- `proxy.ts` lets `/manifest.webmanifest`, `/sw.js` and `/offline`
  through without a session. `InstallHint` (phone layout) shows the iOS
  "Share › Add to Home Screen" text or Android's install prompt until
  installed or dismissed (localStorage).

## Events, outbox, integrations

- Services call `emitEvent(type, data, { calendar })` (`src/lib/events.ts`)
  after a change. It writes `Outbox` rows: one `webhook.deliver` per
  subscribed webhook and a de-duplicated `calendar.sync_*` job.
- `src/lib/outbox.ts` is the worker (claim → handler → done/retry with
  backoff). Handlers register by type; calendar handlers are in
  `src/modules/calendar/handlers.ts`, started from `src/instrumentation.ts`.
  `POST /api/cron/outbox` processes the queue for serverless hosts.
  The worker prunes `done` rows older than `outboxConfig.doneRetentionDays`
  once an hour (`pruneOutbox`); failed rows stay until retried.
- Google push (`src/modules/calendar/sync.ts`) is idempotent via
  `googleEventIds` on the row; the REST client is `google.ts` (service
  account JWT, no SDK). Tests inject a fake client.
- iCal feeds: `src/modules/calendar/feeds.ts`, served at
  `/api/calendar/<token>.ics`. Project feeds go back
  `FEED_HISTORY_DAYS` (a year, by `reserveTo`); calendar apps poll them,
  so they select only the fields the events use.
- Foreign keys get an `@@index` when anything filters on them or the
  referenced row can be deleted (Postgres does not index them itself, and
  SetNull / Restrict then scan the table).
- Set `OUTBOX_DISABLED=1` when running one-off scripts or tests that must
  not deliver anything.

## Branches and pull requests

- Every change is a branch off `main` with a pull request against `main`.
  Stack on another branch only when the change cannot build without it,
  and say so in the PR body.
- The repository is public. The real spreadsheet (`*.xlsx`), `.env` and
  uploads are ignored; keep client data out of seeds, fixtures and PR text.
- A ruleset on `main` requires the CI job `test` (lint, typecheck, unit
  and DB tests, build, browser tests) and an up-to-date branch. Auto-merge
  is allowed: arm it per PR (`gh pr merge <n> --auto --merge`) and GitHub
  merges when `test` is green. Auto-fix in the desktop app repairs failing
  CI and merge conflicts before that.

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
  does not load under Vitest. Pages keep using the barrel for queries and services.
- `ActionForm` passes the clicked submit button to `new FormData(form,
  submitter)`, so buttons with `name="outcome" value="ok"` work like a
  native submit. Keep that when touching it.
- Do not use the build-generated global types (`RouteContext`, `PageProps`,
  `LayoutProps`) in source: CI runs `tsc` before `next build`, so they do not
  exist there. Type `params` explicitly: `{ params: Promise<{ id: string }> }`.
