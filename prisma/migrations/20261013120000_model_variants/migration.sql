-- Models come in families (name) with sizes (variant). See DECISIONS.md 2026-10-13.
ALTER TABLE "Model" ADD COLUMN "variant" TEXT;
CREATE INDEX "Model_manufacturer_name_variant_idx" ON "Model"("manufacturer", "name", "variant");

-- Split existing combined names the way src/lib/variant.ts does:
-- a trailing length ("5 m", "150cm med forlænger", "1,5 m. (tynd)"),
-- a plate size ("76 x 76 mm · Mirror"), an output count ("6 udgange (450w)"), or a load ("500 kg").
UPDATE "Model"
SET "name" = btrim((regexp_match("name", '^(.*?\S)\s+(\d+(?:[.,]\d+)?\s*(?:cm|mm|m)\.?(?:\s+med forlænger)?(?:\s*\([^)]*\))*)$', 'i'))[1]),
    "variant" = regexp_replace(btrim((regexp_match("name", '^(.*?\S)\s+(\d+(?:[.,]\d+)?\s*(?:cm|mm|m)\.?(?:\s+med forlænger)?(?:\s*\([^)]*\))*)$', 'i'))[2]), '\.$', '')
WHERE "variant" IS NULL AND "name" ~* '^(.*?\S)\s+(\d+(?:[.,]\d+)?\s*(?:cm|mm|m)\.?(?:\s+med forlænger)?(?:\s*\([^)]*\))*)$';

UPDATE "Model"
SET "name" = btrim((regexp_match("name", '^(.*?\S)\s+(\d+\s*x\s*\d+\s*(?:mm|cm)(?:\s*·.*)?)$', 'i'))[1]),
    "variant" = btrim((regexp_match("name", '^(.*?\S)\s+(\d+\s*x\s*\d+\s*(?:mm|cm)(?:\s*·.*)?)$', 'i'))[2])
WHERE "variant" IS NULL AND "name" ~* '^(.*?\S)\s+(\d+\s*x\s*\d+\s*(?:mm|cm)(?:\s*·.*)?)$';

UPDATE "Model"
SET "name" = btrim((regexp_match("name", '^(.*?\S)\s+(\d+\s+udgange\M.*)$', 'i'))[1]),
    "variant" = btrim((regexp_match("name", '^(.*?\S)\s+(\d+\s+udgange\M.*)$', 'i'))[2])
WHERE "variant" IS NULL AND "name" ~* '^(.*?\S)\s+(\d+\s+udgange\M.*)$';

UPDATE "Model"
SET "name" = btrim((regexp_match("name", '^(.*?\S)\s+(\d+(?:[.,]\d+)?\s*(?:kg|t))$', 'i'))[1]),
    "variant" = btrim((regexp_match("name", '^(.*?\S)\s+(\d+(?:[.,]\d+)?\s*(?:kg|t))$', 'i'))[2])
WHERE "variant" IS NULL AND "name" ~* '^(.*?\S)\s+(\d+(?:[.,]\d+)?\s*(?:kg|t))$';
