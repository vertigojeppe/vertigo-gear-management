-- AlterTable
ALTER TABLE "CustomFieldDefinition" ADD COLUMN     "showInList" BOOLEAN NOT NULL DEFAULT false;

-- The standard extra fields (the same list as prisma/seed/custom-fields.ts). The seed
-- never runs on a server, so a server only had the fields someone created by hand, and
-- the values the spreadsheet importer stored (lumen, throw ratio, IP address, firmware,
-- ...) were invisible and the spec sheet import skipped them. Each field is created
-- where its category path exists and no field with that key exists yet for the entity.
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-model-lumen', 'model', c1."id", 'lumen', 'Lumen', 'number', '[]'::jsonb, false, true, 0, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Video' AND c1."name" = 'Projectors' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'model' AND d."key" = 'lumen')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-model-throw_ratio', 'model', c1."id", 'throw_ratio', 'Throw ratio', 'text', '[]'::jsonb, false, true, 1, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Video' AND c1."name" = 'Projectors' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'model' AND d."key" = 'throw_ratio')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-model-lens_shift', 'model', c1."id", 'lens_shift', 'Lens shift', 'text', '[]'::jsonb, false, false, 2, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Video' AND c1."name" = 'Projectors' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'model' AND d."key" = 'lens_shift')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-model-resolution', 'model', c1."id", 'resolution', 'Resolution', 'text', '[]'::jsonb, false, false, 3, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Video' AND c1."name" = 'Projectors' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'model' AND d."key" = 'resolution')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-ip_address', 'item', c1."id", 'ip_address', 'IP address', 'text', '[]'::jsonb, false, false, 0, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Lighting' AND c1."name" = 'LED controllers' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND d."key" = 'ip_address')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-board_type', 'item', c1."id", 'board_type', 'Board type', 'select', '["Teensy 3.2","Teensy 4","Teensy 4.0"]'::jsonb, false, false, 1, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Lighting' AND c1."name" = 'LED controllers' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND d."key" = 'board_type')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-firmware', 'item', c1."id", 'firmware', 'Firmware', 'text', '[]'::jsonb, false, false, 2, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Lighting' AND c1."name" = 'LED controllers' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND d."key" = 'firmware')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-model-finish', 'model', c1."id", 'finish', 'Finish', 'select', '["Raw alu","Black painted"]'::jsonb, false, false, 0, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Rigging' AND c1."name" = 'Alu profiles' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'model' AND d."key" = 'finish')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-cpu', 'item', c0."id", 'cpu', 'CPU', 'text', '[]'::jsonb, false, false, 0, now(), now()
FROM "Category" c0
WHERE c0."parentId" IS NULL AND c0."name" = 'Computers & networking' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND d."key" = 'cpu')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-gpu', 'item', c0."id", 'gpu', 'GPU', 'text', '[]'::jsonb, false, false, 1, now(), now()
FROM "Category" c0
WHERE c0."parentId" IS NULL AND c0."name" = 'Computers & networking' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND d."key" = 'gpu')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-ram', 'item', c0."id", 'ram', 'RAM', 'text', '[]'::jsonb, false, false, 2, now(), now()
FROM "Category" c0
WHERE c0."parentId" IS NULL AND c0."name" = 'Computers & networking' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND d."key" = 'ram')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-storage', 'item', c0."id", 'storage', 'Storage', 'text', '[]'::jsonb, false, false, 3, now(), now()
FROM "Category" c0
WHERE c0."parentId" IS NULL AND c0."name" = 'Computers & networking' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND d."key" = 'storage')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-psu', 'item', c0."id", 'psu', 'PSU', 'text', '[]'::jsonb, false, false, 4, now(), now()
FROM "Category" c0
WHERE c0."parentId" IS NULL AND c0."name" = 'Computers & networking' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND d."key" = 'psu')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-model-length_m', 'model', c1."id", 'length_m', 'Length (m)', 'number', '[]'::jsonb, false, false, 0, now(), now()
FROM "Category" c0 JOIN "Category" c1 ON c1."parentId" = c0."id"
WHERE c0."parentId" IS NULL AND c0."name" = 'Rigging' AND c1."name" = 'Truss' AND NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'model' AND d."key" = 'length_m')
LIMIT 1;
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-lamp_hours', 'item', NULL, 'lamp_hours', 'Lamp / laser hours', 'number', '[]'::jsonb, false, false, 10, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND d."key" = 'lamp_hours');
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-last_service', 'item', NULL, 'last_service', 'Last service', 'date', '[]'::jsonb, false, false, 11, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND d."key" = 'last_service');
INSERT INTO "CustomFieldDefinition" ("id", "entity", "categoryId", "key", "label", "type", "options", "required", "showInList", "sortOrder", "createdAt", "updatedAt")
SELECT 'std-item-condition', 'item', NULL, 'condition', 'Condition', 'select', '["A – like new","B – good","C – worn"]'::jsonb, false, false, 12, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "CustomFieldDefinition" d WHERE d."entity" = 'item' AND d."key" = 'condition');

-- Lumen and throw ratio start out as columns in the inventory list, also where they were made by hand.
UPDATE "CustomFieldDefinition" SET "showInList" = true WHERE "entity" = 'model' AND "key" IN ('lumen', 'throw_ratio');
