-- The importer kept the brand inside the family name when the sheet's system column
-- started with it ("Manfrotto" + "Manfrotto 122B …"). Strip the repeated manufacturer.
UPDATE "Model"
SET "name" = btrim(regexp_replace("name", '^' || regexp_replace("manufacturer", '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\s+', '', 'i'))
WHERE "manufacturer" <> ''
  AND "name" ~* ('^' || regexp_replace("manufacturer", '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\s+\S');
