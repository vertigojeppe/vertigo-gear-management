-- AlterTable
ALTER TABLE "CustomFieldDefinition" ADD COLUMN     "showInList" BOOLEAN NOT NULL DEFAULT false;

-- The standard extra fields (the same list as prisma/seed/custom-fields.ts). The seed
-- never runs on a server, so a server only had the fields someone created by hand, and
-- the values the spreadsheet importer stored under the standard keys (lumen,
-- throw_ratio, ip_address, firmware, ...) were invisible.
--
-- 1. Each standard field is created where its category path exists and the entity has
--    no field with that key or that label yet (a hand-made "Lumen" with key "lumens"
--    counts: no second Lumen field).
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-model-lumen', 'model', c1."id", 'lumen', 'Lumen', 'number', '[]'::jsonb, false, true, 0, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Video' AND c1."name" = 'Projectors' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'model' AND (d."key" = 'lumen' OR lower(d."label") = lower('Lumen')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-model-throw_ratio', 'model', c1."id", 'throw_ratio', 'Throw ratio', 'text', '[]'::jsonb, false, true, 1, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Video' AND c1."name" = 'Projectors' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'model' AND (d."key" = 'throw_ratio' OR lower(d."label") = lower('Throw ratio')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-model-lens_shift', 'model', c1."id", 'lens_shift', 'Lens shift', 'text', '[]'::jsonb, false, false, 2, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Video' AND c1."name" = 'Projectors' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'model' AND (d."key" = 'lens_shift' OR lower(d."label") = lower('Lens shift')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-model-resolution', 'model', c1."id", 'resolution', 'Resolution', 'text', '[]'::jsonb, false, false, 3, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Video' AND c1."name" = 'Projectors' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'model' AND (d."key" = 'resolution' OR lower(d."label") = lower('Resolution')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-ip_address', 'item', c1."id", 'ip_address', 'IP address', 'text', '[]'::jsonb, false, false, 0, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Lighting' AND c1."name" = 'LED controllers' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND (d."key" = 'ip_address' OR lower(d."label") = lower('IP address')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-board_type', 'item', c1."id", 'board_type', 'Board type', 'select', '["Teensy 3.2","Teensy 4","Teensy 4.0"]'::jsonb, false, false, 1, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Lighting' AND c1."name" = 'LED controllers' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND (d."key" = 'board_type' OR lower(d."label") = lower('Board type')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-firmware', 'item', c1."id", 'firmware', 'Firmware', 'text', '[]'::jsonb, false, false, 2, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Lighting' AND c1."name" = 'LED controllers' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND (d."key" = 'firmware' OR lower(d."label") = lower('Firmware')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-model-finish', 'model', c1."id", 'finish', 'Finish', 'select', '["Raw alu","Black painted"]'::jsonb, false, false, 0, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Rigging' AND c1."name" = 'Alu profiles' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'model' AND (d."key" = 'finish' OR lower(d."label") = lower('Finish')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-cpu', 'item', c0."id", 'cpu', 'CPU', 'text', '[]'::jsonb, false, false, 0, now(), now()
FROM "Category" c0
WHERE c0."parentId" IS NULL AND c0."name" = 'Computers & networking' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND (d."key" = 'cpu' OR lower(d."label") = lower('CPU')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-gpu', 'item', c0."id", 'gpu', 'GPU', 'text', '[]'::jsonb, false, false, 1, now(), now()
FROM "Category" c0
WHERE c0."parentId" IS NULL AND c0."name" = 'Computers & networking' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND (d."key" = 'gpu' OR lower(d."label") = lower('GPU')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-ram', 'item', c0."id", 'ram', 'RAM', 'text', '[]'::jsonb, false, false, 2, now(), now()
FROM "Category" c0
WHERE c0."parentId" IS NULL AND c0."name" = 'Computers & networking' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND (d."key" = 'ram' OR lower(d."label") = lower('RAM')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-storage', 'item', c0."id", 'storage', 'Storage', 'text', '[]'::jsonb, false, false, 3, now(), now()
FROM "Category" c0
WHERE c0."parentId" IS NULL AND c0."name" = 'Computers & networking' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND (d."key" = 'storage' OR lower(d."label") = lower('Storage')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-psu', 'item', c0."id", 'psu', 'PSU', 'text', '[]'::jsonb, false, false, 4, now(), now()
FROM "Category" c0
WHERE c0."parentId" IS NULL AND c0."name" = 'Computers & networking' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND (d."key" = 'psu' OR lower(d."label") = lower('PSU')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-model-length_m', 'model', c1."id", 'length_m', 'Length (m)', 'number', '[]'::jsonb, false, false, 0, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Rigging' AND c1."name" = 'Truss' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'model' AND (d."key" = 'length_m' OR lower(d."label") = lower('Length (m)')))
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-lamp_hours', 'item', NULL, 'lamp_hours', 'Lamp / laser hours', 'number', '[]'::jsonb, false, false, 10, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND (d."key" = 'lamp_hours' OR lower(d."label") = lower('Lamp / laser hours')));
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-last_service', 'item', NULL, 'last_service', 'Last service', 'date', '[]'::jsonb, false, false, 11, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND (d."key" = 'last_service' OR lower(d."label") = lower('Last service')));
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-condition', 'item', NULL, 'condition', 'Condition', 'select', '["A – like new","B – good","C – worn"]'::jsonb, false, false, 12, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND (d."key" = 'condition' OR lower(d."label") = lower('Condition')));

-- 2. Where someone made a standard field by hand with another key ("Lumen" as lumens),
--    the values stored under the standard key are copied into it, where it is empty.
DO $$
DECLARE d record;
BEGIN
  FOR d IN
    SELECT f."entity", f."key" AS mine, s.std
    FROM "CustomFieldDefinition" f
    JOIN (VALUES
      ('model', 'lumen', 'Lumen'),
      ('model', 'throw_ratio', 'Throw ratio'),
      ('model', 'lens_shift', 'Lens shift'),
      ('model', 'resolution', 'Resolution'),
      ('item', 'ip_address', 'IP address'),
      ('item', 'board_type', 'Board type'),
      ('item', 'firmware', 'Firmware'),
      ('model', 'finish', 'Finish'),
      ('item', 'cpu', 'CPU'),
      ('item', 'gpu', 'GPU'),
      ('item', 'ram', 'RAM'),
      ('item', 'storage', 'Storage'),
      ('item', 'psu', 'PSU'),
      ('model', 'length_m', 'Length (m)'),
      ('item', 'lamp_hours', 'Lamp / laser hours'),
      ('item', 'last_service', 'Last service'),
      ('item', 'condition', 'Condition')
    ) AS s(entity, std, label) ON s.entity = f."entity" AND lower(s.label) = lower(f."label")
    WHERE f."key" <> s.std
  LOOP
    IF d.entity = 'model' THEN
      UPDATE "Model" SET "customFields" = jsonb_set("customFields", ARRAY[d.mine], "customFields" -> d.std)
      WHERE jsonb_typeof("customFields") = 'object' AND "customFields" ? d.std AND NOT ("customFields" ? d.mine);
    ELSIF d.entity = 'item' THEN
      UPDATE "Item" SET "customFields" = jsonb_set("customFields", ARRAY[d.mine], "customFields" -> d.std)
      WHERE jsonb_typeof("customFields") = 'object' AND "customFields" ? d.std AND NOT ("customFields" ? d.mine);
    END IF;
  END LOOP;
END $$;

-- 3. Lumen and throw ratio start out as columns in the inventory list, also when made by hand.
UPDATE "CustomFieldDefinition" SET "showInList" = true
WHERE "entity" = 'model' AND ("key" IN ('lumen', 'throw_ratio') OR lower("label") IN ('lumen', 'throw ratio'));
