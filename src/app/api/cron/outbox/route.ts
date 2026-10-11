import { NextResponse, type NextRequest } from "next/server";
import { processOutbox } from "@/lib/outbox";
import { registerCalendarHandlers } from "@/modules/calendar";

/**
 * Processes due outbox rows. The in-process worker normally does this; on
 * hosts without a long-lived process (Vercel) call this from a scheduler
 * every minute with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  if (!secret && process.env.NODE_ENV === "production") return new NextResponse("Set CRON_SECRET to enable this endpoint", { status: 403 });
  registerCalendarHandlers();
  const result = await processOutbox(50);
  return NextResponse.json(result);
}
