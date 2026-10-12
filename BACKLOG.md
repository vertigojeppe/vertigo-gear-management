# Backlog

Ideas and requests that are not in the current phase. Add freely; prune
when something ships or stops mattering.

## Later phases (already planned, see PLAN.md)

- Phase 1: inventory core
- Phase 2: projects, availability engine, rentals, calendar
- Phase 4b: documents with versions, resumable upload, image / PDF / 3D
  viewers, markup layer, files pinned to schedule entries and tasks
- Phase 5: import/export, labels, polish, deployment docs

## After Phase 4 (from the October 2026 spec update, see SPEC.md and MIGRATION.md)

These came with the spreadsheet migration notes. The schema groundwork
(statuses, not-for-rental, person locations, contacts, category-scoped
fields) is done; the rest waits until production plans have shipped.

- **Pricing engine**: rental day price per model; named, editable rate
  tables (Standard, Theatre, Revised from `lejefaktor`) mapping days →
  factor as a step function with a "+X per extra day / 10 days" rule beyond
  the last tier; line price = day price × factor × quantity; per-line and
  per-document discount %; free-text lines (freight, insurance, crew);
  totals excl. and incl. 25% VAT; default terms text.
- **Quote / rental agreement PDF** from a project or a rental using the
  pricing engine (replaces the Phase 2 agreement PDF totals).
- **Sub-hire catalog**: gear partner companies own that we rent in
  (GearGuys' Panasonic lenses); sub-hire lines on a packing list marked
  "rent in from X" with their cost, so list and quote are complete.
- **Wish list**: models we want to buy (price, link, note), convertible to
  a real model when bought; includes the Dirverse castor references.
- **Purchase records** per model: supplier (a contact), date, quote/order
  number, list price, discount %, net price, attachment (the Urs quotes).
- **Spreadsheet importer** for `import/source/Vertigo_Gearliste___Status.xlsx`
  with the three-bucket preview (will import / imported with assumption /
  needs decision) and `source: sheet!cell` on every record; then the seed
  loads the real inventory (`--demo-only` keeps the synthetic data for CI).
  Blocked until the spreadsheet is in the repo.
- Exclude not-for-rental units from rental availability counts (today the
  flag refuses the line or unit, but the availability number still counts
  them).
- Unify `Client` (renter) with `Contact`, or link them, so a renter is a
  contact too.

## Not scheduled

- Sub-hire: track gear rented *in* from other companies for a project
  (an "external" item or a per-project rented-in line).
- Magic-link login and password reset (needs SMTP; env vars already
  reserved in `.env.example`).
- Google login (add provider to `src/lib/auth/index.ts`).
- Per-user locale (Danish UI) once `messages/da.json` is complete.
- Maintenance log per item (service intervals, lamp hours).
- Low-stock warnings for bulk items (consumables like gaffer, cable ties).
- Barcode (Code128) as an alternative to QR on labels.
- Share links with an expiry date (the column exists, no UI yet).
- Tasks on the dashboard: "my open tasks" and "due this week" across plans.
- Call times per crew member straight from the plan (today: on the project).
- Reorder schedule entries by drag; today ties sort by creation.
- Plan PDF with per-user pages (only my schedule and tasks).
- Scan tags in check-in mode too (today: tick buttons per unit).
- Print a label for a travel bin straight from the packing list.
- Case contents as a nested view when packing a kit (today: one line).
