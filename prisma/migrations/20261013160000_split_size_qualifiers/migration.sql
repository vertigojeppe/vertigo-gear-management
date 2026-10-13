-- "True1 under 2 m": a qualifier before the size (under, over, max, min, op til, mindst, højst, ca.)
-- is part of the variation. Two cases: the size was already split off and the qualifier was left
-- dangling at the end of the name, or the whole phrase still sits in the name.
UPDATE "Model"
SET "variant" = btrim((regexp_match("name", '^(.*?\S)\s+((?:under|over|max\.?|min\.?|op til|mindst|højst|ca\.?))$', 'i'))[2] || ' ' || "variant"),
    "name" = btrim((regexp_match("name", '^(.*?\S)\s+((?:under|over|max\.?|min\.?|op til|mindst|højst|ca\.?))$', 'i'))[1])
WHERE "variant" IS NOT NULL AND "name" ~* '^(.*?\S)\s+((?:under|over|max\.?|min\.?|op til|mindst|højst|ca\.?))$';

UPDATE "Model"
SET "name" = btrim((regexp_match("name", '^(.*?\S)\s+((?:under|over|max\.?|min\.?|op til|mindst|højst|ca\.?)\s+\d+(?:[.,]\d+)?\s*(?:cm|mm|m)\.?(?:\s*\([^)]*\))*)$', 'i'))[1]),
    "variant" = regexp_replace(btrim((regexp_match("name", '^(.*?\S)\s+((?:under|over|max\.?|min\.?|op til|mindst|højst|ca\.?)\s+\d+(?:[.,]\d+)?\s*(?:cm|mm|m)\.?(?:\s*\([^)]*\))*)$', 'i'))[2]), '\.$', '')
WHERE "variant" IS NULL AND "name" ~* '^(.*?\S)\s+((?:under|over|max\.?|min\.?|op til|mindst|højst|ca\.?)\s+\d+(?:[.,]\d+)?\s*(?:cm|mm|m)\.?(?:\s*\([^)]*\))*)$';
