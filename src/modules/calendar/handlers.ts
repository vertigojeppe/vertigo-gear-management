import { registerOutboxHandler } from "@/lib/outbox";
import { syncProject, syncRental } from "./sync";

let registered = false;

/** Register the calendar outbox handlers once per process. */
export function registerCalendarHandlers() {
  if (registered) return;
  registered = true;
  registerOutboxHandler("calendar.sync_project", async (payload) => {
    await syncProject(String(payload.id));
  });
  registerOutboxHandler("calendar.sync_rental", async (payload) => {
    await syncRental(String(payload.id));
  });
}
