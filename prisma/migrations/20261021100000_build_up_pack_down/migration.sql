-- Build-up and pack-down become continuous day ranges with one call time, and prep gets an
-- end day. Existing load-in / load-out moments (UTC instants of Copenhagen wall-clock) become
-- a one-day range on their Copenhagen day with the time as the call time. Prep used to run
-- until load-in: it now ends the day before build-up when that is on or after its start.

ALTER TABLE "Project"
  ADD COLUMN "prepEnd" TIMESTAMP(3),
  ADD COLUMN "buildStart" TIMESTAMP(3),
  ADD COLUMN "buildEnd" TIMESTAMP(3),
  ADD COLUMN "buildCall" TEXT,
  ADD COLUMN "packStart" TIMESTAMP(3),
  ADD COLUMN "packEnd" TIMESTAMP(3),
  ADD COLUMN "packCall" TEXT;

UPDATE "Project"
SET "buildStart" = date_trunc('day', ("loadIn" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Copenhagen'),
    "buildEnd"   = date_trunc('day', ("loadIn" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Copenhagen'),
    "buildCall"  = to_char(("loadIn" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Copenhagen', 'HH24:MI')
WHERE "loadIn" IS NOT NULL;

UPDATE "Project"
SET "packStart" = date_trunc('day', ("loadOut" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Copenhagen'),
    "packEnd"   = date_trunc('day', ("loadOut" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Copenhagen'),
    "packCall"  = to_char(("loadOut" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Copenhagen', 'HH24:MI')
WHERE "loadOut" IS NOT NULL;

UPDATE "Project"
SET "prepEnd" = CASE
  WHEN "buildStart" IS NOT NULL AND "buildStart" - INTERVAL '1 day' >= "prepStart" THEN "buildStart" - INTERVAL '1 day'
  ELSE "prepStart"
END
WHERE "prepStart" IS NOT NULL;

ALTER TABLE "Project" DROP COLUMN "loadIn", DROP COLUMN "loadOut";
