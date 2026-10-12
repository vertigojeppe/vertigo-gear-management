import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/lib/auth/session";
import { files } from "@/modules/files";
import { shareLinks } from "@/modules/packing";
import { fileIdsForPlan } from "@/modules/plans";

/**
 * Serves an uploaded file (or its thumbnail with ?thumb=1) to signed-in
 * users, or to anyone holding a plan's share token for that plan's documents.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let allowed = Boolean(await getActor());
  const share = req.nextUrl.searchParams.get("share");
  if (!allowed && share) {
    const link = await shareLinks.resolve(share);
    if (link?.targetType === "plan") allowed = (await fileIdsForPlan(link.targetId)).has(id);
  }
  if (!allowed) return new NextResponse("Unauthorized", { status: 401 });
  const thumb = req.nextUrl.searchParams.get("thumb") === "1";
  const file = await files.open(id, thumb);
  if (!file) return new NextResponse("Not found", { status: 404 });
  const inline = file.mimeType.startsWith("image/") || file.mimeType === "application/pdf";
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `${inline && !download ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
