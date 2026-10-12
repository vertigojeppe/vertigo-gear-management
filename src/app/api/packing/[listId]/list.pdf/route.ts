import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/auth/permissions";
import { getActor } from "@/lib/auth/session";
import { listDetail, renderPackingList, shareLinks } from "@/modules/packing";

/**
 * Packing list as PDF. Signed-in users with packing.read, or anyone with a
 * valid share token (?share=<token>).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ listId: string }> }) {
  const { listId } = await ctx.params;
  const actor = await getActor();
  let allowed = Boolean(actor && can(actor.role, "packing.read"));
  if (!allowed) {
    const token = req.nextUrl.searchParams.get("share");
    const link = token ? await shareLinks.resolve(token) : null;
    allowed = Boolean(link && link.targetType === "packing_list" && link.targetId === listId);
  }
  if (!allowed) return new NextResponse("Unauthorized", { status: 401 });
  const detail = await listDetail(listId);
  if (!detail) return new NextResponse("Not found", { status: 404 });
  const pdf = await renderPackingList(detail);
  const name = `${detail.project.name}-${detail.list.name}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}.pdf"`, "Cache-Control": "no-store" },
  });
}
