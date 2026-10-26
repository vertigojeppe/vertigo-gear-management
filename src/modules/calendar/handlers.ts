import { registerOutboxHandler } from "@/lib/outbox";
import { googleRef, syncEntry, syncProject, syncRental } from "./sync";

let registered = false;

/** Register the calendar outbox handlers once per process. */
export function registerCalendarHandlers() {
  if (registered) return;
  registered = true;
  registerOutboxHandler("calendar.sync_project", async (payload) => {
    await syncProject(String(payload.id), undefined, idsFrom(payload.eventIds));
  });
  registerOutboxHandler("calendar.sync_entry", async (payload) => {
    await syncEntry(String(payload.id), undefined, googleRef(payload.eventIds));
  });
  registerOutboxHandler("calendar.sync_rental", async (payload) => {
    await syncRental(String(payload.id), undefined, idsFrom(payload.eventIds));
  });
}

/** Event ids a deleted project or rental handed to its last sync job (src/lib/events.ts). */
function idsFrom(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== "object") return undefined;
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string"));
}
