# Backlog

Ideas and requests that are not in the current phase. Add freely; prune
when something ships or stops mattering.

## Later phases (already planned, see PLAN.md)

- Phase 1: inventory core
- Phase 2: projects, availability engine, rentals, calendar
- Phase 4b: documents with versions, resumable upload, image / PDF / 3D
  viewers, markup layer, files pinned to schedule entries and tasks
- (Phases 1 to 5b have shipped; see PLAN.md)

## After Phase 4 (from the October 2026 spec update, see SPEC.md and MIGRATION.md)

These came with the spreadsheet migration notes. The schema groundwork
(statuses, not-for-rental, person locations, contacts, category-scoped
fields) is done; the rest waits until production plans have shipped.

- Pricing engine and quote / agreement PDF: shipped as Phase 6. Open
  follow-ups: a quote number sequence and "quote sent / accepted" state on
  projects; per-day extra lines (crew per day); editable default terms in
  Settings instead of the translation text; weekly prices are gone (the
  rate table covers them).
- **Sub-hire follow-ups**: rent-in lines are listed on packing lists but
  not ticked or checked in (they never pass through our warehouse); a
  "collected from partner / returned to partner" tick could come later.
  Sub-hire on external rentals is not supported (own projects only).
- **Importer follow-ups** (the importer itself shipped as Phase 5a):
  nothing is parked any more (rate tables, wish rows, the castor
  references, the Urs truss quotes and the GearGuys rows all import). The truss
  inventory rows' own list/discount/net columns stay a model note; only
  the quotes become purchase records. Computer
  parts are serialized units without serials; the two media servers'
  component prices are a model note. A CSV/XLSX import for arbitrary lists
  (not this spreadsheet) is still open.
- Unify `Client` (renter) with `Contact`, or link them, so a renter is a
  contact too.

## Not scheduled

- Magic-link login and password reset (needs SMTP; env vars already
  reserved in `.env.example`).
- Google login (add provider to `src/lib/auth/index.ts`).
- Per-user locale (Danish UI) once `messages/da.json` is complete.
- Maintenance log per item (service intervals, lamp hours).
- Consumables: *Use* from the scan screen (scan the bin, then the unit),
  and a parts-used list on the unit page beyond the activity feed.
- Barcode (Code128) as an alternative to QR on labels.
- Share links with an expiry date (the column exists, no UI yet).
- Call times per crew member straight from the plan (today: on the project).
- Reorder schedule entries by drag; today ties sort by creation.
- S3/R2 storage driver with multipart upload (the adapter interface is
  ready; local disk only today).
- Markup on 3D models (today: images and PDFs) and on preview images.
- Thumbnails for PDF documents (poppler is in the Docker image already).
- Compare two versions of a drawing side by side.
- Scan tags in check-in mode too (today: tick buttons per unit).
- Print a label for a travel bin straight from the packing list.
- Case contents as a nested view when packing a kit (today: one line).
