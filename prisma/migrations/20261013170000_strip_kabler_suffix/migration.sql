-- "SplitLED wieland kabler 2,5m": a trailing "kabler" on the family name only says it is a cable,
-- which the category already does (see src/lib/variant.ts familyName). Where the stripped name
-- already exists as a model with the same variant, the two are merged: everything that points at
-- the "kabler" model moves to the existing one and the "kabler" model goes.
CREATE TEMP TABLE kabler_merge AS
SELECT k.id AS from_id, e.id AS to_id
FROM "Model" k
JOIN "Model" e
  ON e.id <> k.id
 AND e."manufacturer" = k."manufacturer"
 AND lower(e."name") = lower(btrim(regexp_replace(k."name", '\s+kabler$', '', 'i')))
 AND coalesce(e."variant", '') = coalesce(k."variant", '')
WHERE k."name" ~* '\skabler$';

UPDATE "Item" i SET "modelId" = m.to_id FROM kabler_merge m WHERE i."modelId" = m.from_id;
UPDATE "Allocation" a SET "modelId" = m.to_id FROM kabler_merge m WHERE a."modelId" = m.from_id;
UPDATE "RentalLine" r SET "modelId" = m.to_id FROM kabler_merge m WHERE r."modelId" = m.from_id;
UPDATE "PackingLine" p SET "modelId" = m.to_id FROM kabler_merge m WHERE p."modelId" = m.from_id;
UPDATE "PackingTemplateLine" t SET "modelId" = m.to_id FROM kabler_merge m WHERE t."modelId" = m.from_id;
DELETE FROM "Model" k USING kabler_merge m WHERE k.id = m.from_id;
DROP TABLE kabler_merge;

-- The rest just lose the word.
UPDATE "Model"
SET "name" = btrim(regexp_replace("name", '\s+kabler$', '', 'i'))
WHERE "name" ~* '\skabler$' AND btrim(regexp_replace("name", '\s+kabler$', '', 'i')) <> '';
