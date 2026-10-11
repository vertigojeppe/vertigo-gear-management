# CLAUDE.md — working notes for Vertigo Gear

Read this first in every session. Keep it current: when a convention changes,
change it here in the same commit.

## What this is

Self-hosted web app for Vertigo (Copenhagen light/laser/projection studio):
gear inventory, availability, projects, packing lists, production plans,
external rentals. Full spec: `vertigo-gear-system-prompt.md`. Plan and data
model: `PLAN.md`. Why things are the way they are: `DECISIONS.md`. Ideas:
`BACKLOG.md`. Data model diagram: `docs/ARCHITECTURE.md`.

Current phase: **1 (inventory core) done**. Next: Phase 2 (projects, availability, rentals, calendar).

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
- Session is a JWT with `id` and `role`. Role changes apply at next login.

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
- Native `<select>` (`NativeSelect`) in forms so FormData posts without JS.
- REST: handlers under `src/app/api/v1/**` use `handler(permission, fn)`
  from `src/lib/api/respond.ts` and the module zod schemas. Add new
  endpoints to `src/lib/api/openapi.ts` so `/api/docs` stays complete.
- Asset tags come from `nextAssetTag(tx)` inside the creating transaction.
  The seed sets the counter past its highest tag.

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
- `prisma migrate dev` needs the dev Postgres running.
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
- Do not use the build-generated global types (`RouteContext`, `PageProps`,
  `LayoutProps`) in source: CI runs `tsc` before `next build`, so they do not
  exist there. Type `params` explicitly: `{ params: Promise<{ id: string }> }`.
