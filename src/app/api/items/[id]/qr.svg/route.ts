import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { assetTagUrl } from "@/lib/asset-tag";
import { getActor } from "@/lib/auth/session";
import { items } from "@/modules/inventory";

/** QR code for an item's asset tag, as SVG. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/items/[id]/qr.svg">) {
  if (!(await getActor())) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const item = await items.get(id);
  if (!item) return new NextResponse("Not found", { status: 404 });
  const svg = await QRCode.toString(assetTagUrl(item.assetTag), { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=3600" },
  });
}
