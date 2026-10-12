# Backlog

Ideas and requests that are not in the current phase. Add freely; prune
when something ships or stops mattering.

## Later phases (already planned, see PLAN.md)

- Phase 1: inventory core
- Phase 2: projects, availability engine, rentals, calendar
- Phase 4b: documents with versions, resumable upload, image / PDF / 3D
  viewers, markup layer, files pinned to schedule entries and tasks
- Phase 5b: export, labels, polish, deployment docs (the importer shipped as 5a)

## After Phase 4 (from the October 2026 spec update, see SPEC.md and MIGRATION.md)

These came with the spreadsheet migration notes. The schema groundwork
(statuses, not-for-rental, person locations, contacts, category-scoped
fields) is done; the rest waits until production plans have shipped.

- Pricing engine and quote / agreement PDF: shipped as Phase 6. Open
  follow-ups: a quote number sequence and "quote sent / accepted" state on
  projects; per-day extra lines (crew per day); editable default terms in
  Settings instead of the translation text; weekly prices are gone (the
  rate table covers them).
- **Sub-hire catalog**: gear partner companies own that we rent in
  (GearGuys' Panasonic lenses); sub-hire lines on a packing list marked
  "rent in from X" with their cost, so list and quote are complete.
- **Wish list**: models we want to buy (price, link, note), convertible to
  a real model when bought; includes the Dirverse castor references.
- **Purchase records** per model: supplier (a contact), date, quote/order
  number, list price, discount %, net price, attachment (the Urs quotes).
- **Importer follow-ups** (the importer itself shipped as Phase 5a):
  rate tables from `lejefaktor`, the Urs truss quotes, the GearGuys and
  wish-list projector rows and the Dirverse castor references are shown as
  *parked* in the preview; import them when their features exist. Computer
  parts are serialized units without serials; the two media servers'
  component prices are a model note. A CSV/XLSX import for arbitrary lists
  (not this spreadsheet) is still open.
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
- S3/R2 storage driver with multipart upload (the adapter interface is
  ready; local disk only today).
- Markup on 3D models (today: images and PDFs) and on preview images.
- Thumbnails for PDF documents (poppler is in the Docker image already).
- Compare two versions of a drawing side by side.
- Scan tags in check-in mode too (today: tick buttons per unit).
- Print a label for a travel bin straight from the packing list.
- Case contents as a nested view when packing a kit (today: one line).
