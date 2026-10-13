-- Two more variation shapes (see src/lib/variant.ts):
-- "Ethercon-LP12(M-M) 20cm": the connector genders and what follows are the variation, also when a size was split off already.
UPDATE "Model"
SET "variant" = btrim((regexp_match("name", '^(.*?\S)\s*(\([FMfm]-[FMfm]\).*)$'))[2] || coalesce(' ' || "variant", '')),
    "name" = btrim((regexp_match("name", '^(.*?\S)\s*(\([FMfm]-[FMfm]\).*)$'))[1])
WHERE "name" ~ '^(.*?\S)\s*(\([FMfm]-[FMfm]\).*)$';

-- "Alu hjørner 30° grader", "kube corner 3 x 90°": a trailing angle is the variation.
UPDATE "Model"
SET "name" = btrim((regexp_match("name", '^(.*?\S)\s+((?:\d+\s*x\s*)?\d+\s*°(?:\s*grader)?|\d+\s*grader)$', 'i'))[1]),
    "variant" = btrim((regexp_match("name", '^(.*?\S)\s+((?:\d+\s*x\s*)?\d+\s*°(?:\s*grader)?|\d+\s*grader)$', 'i'))[2])
WHERE "variant" IS NULL AND "name" ~* '^(.*?\S)\s+((?:\d+\s*x\s*)?\d+\s*°(?:\s*grader)?|\d+\s*grader)$';
