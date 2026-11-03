-- Project statuses are now TBA, Confirmed, Done and Cancelled: a quote becomes
-- TBA and a job in progress is simply confirmed.
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'tba';
UPDATE "Project" SET "status" = 'tba' WHERE "status" = 'quote';
UPDATE "Project" SET "status" = 'confirmed' WHERE "status" = 'in_progress';

-- TBA jobs now go to Google Calendar too (titled "TBA: …"): queue one sync each.
-- Without Google Calendar configured the jobs finish as "skipped".
INSERT INTO "Outbox" ("id", "type", "payload", "status", "attempts", "nextRunAt", "createdAt", "updatedAt")
SELECT 'resync-tba-' || "id", 'calendar.sync_project', jsonb_build_object('id', "id", 'event', 'calendar.resync'), 'pending', 0, now(), now(), now()
FROM "Project"
WHERE "status" = 'tba';
