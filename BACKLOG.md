# Backlog

Ideas and requests that are not in the current phase. Add freely; prune
when something ships or stops mattering.

## Later phases (already planned, see PLAN.md)

- Phase 1: inventory core
- Phase 2: projects, availability engine, rentals, calendar
- Phase 4: production plans, files, 3D viewer, markup
- Phase 5: import/export, labels, polish, deployment docs

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
- Scan tags in check-in mode too (today: tick buttons per unit).
- Print a label for a travel bin straight from the packing list.
- Case contents as a nested view when packing a kit (today: one line).
