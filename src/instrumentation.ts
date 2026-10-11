/**
 * Runs once when the Node.js server starts. Starts the outbox worker that
 * delivers webhooks and pushes calendar events. Disabled during build/tests
 * with OUTBOX_DISABLED=1.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startOutboxWorker } = await import("./lib/outbox");
  const { registerCalendarHandlers } = await import("./modules/calendar");
  registerCalendarHandlers();
  startOutboxWorker();
}
