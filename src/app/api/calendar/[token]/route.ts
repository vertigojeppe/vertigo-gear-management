import { NextResponse } from "next/server";
import { buildFeed, feedTokens, type FeedScope } from "@/modules/calendar";

/**
 * iCal feed: /api/calendar/<token>.ics. The token is the only credential,
 * as calendar apps cannot log in. Rotate it from Settings if it leaks.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const row = await feedTokens.resolve(token.replace(/\.ics$/i, ""));
  if (!row) return new NextResponse("Not found", { status: 404 });
  const body = await buildFeed(row.scope as FeedScope, row.userId);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="vertigo-${row.scope}.ics"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
