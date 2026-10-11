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
