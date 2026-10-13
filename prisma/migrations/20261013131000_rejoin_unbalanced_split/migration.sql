-- The variant split must not cut inside a parenthesis: "387XBU Wind Up Stativ (max hojde = 3,66m" had lost its closing
-- bracket on the sheet and was split into name "... (max hojde =" + variant "3,66m". Rejoin such names.
UPDATE "Model"
SET "name" = "name" || ' ' || "variant", "variant" = NULL
WHERE "variant" IS NOT NULL
  AND length(regexp_replace("name", '[^(]', '', 'g')) > length(regexp_replace("name", '[^)]', '', 'g'));
