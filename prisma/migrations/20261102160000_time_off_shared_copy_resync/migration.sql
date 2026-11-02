-- Time off sent to people's own calendars now also gets a copy in the shared
-- projects calendar (src/modules/calendar/entry-events.ts). Queue one Google
-- sync per upcoming time off, so those already in Google get their copy
-- right after the update. Time off has no guests, so nobody is emailed.
-- Without Google Calendar configured the jobs finish as "skipped".
INSERT INTO "Outbox" ("id", "type", "payload", "status", "attempts", "nextRunAt", "createdAt", "updatedAt")
SELECT 'resync-off-copy-' || "id", 'calendar.sync_entry', jsonb_build_object('id', "id", 'event', 'calendar.resync'), 'pending', 0, now(), now(), now()
FROM "CalendarEntry"
WHERE "kind" = 'time_off' AND "endsAt" >= now() - interval '1 day';
