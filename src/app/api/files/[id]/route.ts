import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/lib/auth/session";
import { files } from "@/modules/files";

/** Serves an uploaded file (or its thumbnail with ?thumb=1) to signed-in users. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  if (!(await getActor())) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const thumb = req.nextUrl.searchParams.get("thumb") === "1";
  const file = await files.open(id, thumb);
  if (!file) return new NextResponse("Not found", { status: 404 });
  const inline = file.mimeType.startsWith("image/") || file.mimeType === "application/pdf";
  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
