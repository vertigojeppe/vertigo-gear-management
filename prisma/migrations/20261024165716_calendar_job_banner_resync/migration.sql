-- Calendars now show one all-day banner per job plus timed build-up / pack-down
-- events (src/modules/calendar/job-events.ts). Queue one Google sync per project
-- that may be in the calendar, so the old per-phase all-day events are replaced
-- right after the update instead of the next time each project is edited.
-- Without Google Calendar configured the jobs finish as "skipped".
INSERT INTO "Outbox" ("id", "type", "payload", "status", "attempts", "nextRunAt", "createdAt", "updatedAt")
SELECT 'resync-banner-' || "id", 'calendar.sync_project', jsonb_build_object('id', "id", 'event', 'calendar.resync'), 'pending', 0, now(), now(), now()
FROM "Project"
WHERE "status" NOT IN ('quote', 'cancelled');
