import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { assetTagUrl } from "@/lib/asset-tag";
import { getActor } from "@/lib/auth/session";
import { items } from "@/modules/inventory";

/** Origin as seen by the client, honouring a reverse proxy's forwarded headers. */
function requestOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

/** QR code for an item's asset tag, as SVG. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getActor())) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const item = await items.get(id);
  if (!item) return new NextResponse("Not found", { status: 404 });
  const svg = await QRCode.toString(assetTagUrl(item.assetTag, requestOrigin(req)), { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return new NextResponse(svg, {
    // Not cached: the encoded URL depends on where the page was opened from.
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
  });
}
