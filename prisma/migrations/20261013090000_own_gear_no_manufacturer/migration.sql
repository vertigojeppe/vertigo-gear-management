-- Own-built gear and generic parts carry no manufacturer (see DECISIONS.md 2026-10-13).
-- The importer had used "Vertigo" and "Generic" as placeholders.
UPDATE "Model" SET "manufacturer" = '' WHERE "manufacturer" IN ('Vertigo', 'Generic');
