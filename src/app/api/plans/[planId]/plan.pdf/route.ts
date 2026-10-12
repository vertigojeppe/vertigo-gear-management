import { NextResponse, type NextRequest } from "next/server";
import { can, getActor } from "@/lib/auth/session";
import { shareLinks } from "@/modules/packing";
import { planDetailById, renderPlan } from "@/modules/plans";

/**
 * Full plan PDF, or a day sheet with ?day=YYYY-MM-DD. Signed-in users with
 * plans.read, or anyone with the plan's share token (?share=...).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ planId: string }> }) {
  const { planId } = await ctx.params;
  const share = req.nextUrl.searchParams.get("share");
  const day = req.nextUrl.searchParams.get("day") ?? undefined;
  const actor = await getActor();
  let allowed = Boolean(actor && can(actor.role, "plans.read"));
  if (!allowed && share) {
    const link = await shareLinks.resolve(share);
    allowed = Boolean(link && link.targetType === "plan" && link.targetId === planId);
  }
  if (!allowed) return new NextResponse("Unauthorized", { status: 401 });
  const detail = await planDetailById(planId);
  if (!detail) return new NextResponse("Not found", { status: 404 });
  if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return new NextResponse("Bad day", { status: 400 });
  const buffer = await renderPlan(detail, { day });
  const name = `${detail.project.name}${day ? ` day sheet ${day}` : " production plan"}`.replace(/[^\w.-]+/g, "_");
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}.pdf"`, "Cache-Control": "no-store" },
  });
}
