import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { assetTagUrl } from "@/lib/asset-tag";
import { getActor } from "@/lib/auth/session";
import { requestOrigin, shareableOrigin } from "@/lib/request-origin";
import { items } from "@/modules/inventory";

/**
 * Origin to encode while APP_URL is not set to a public address.
 * Preferred: the `origin` query parameter the page adds from
 * window.location (what the browser is really on). Fallback: Host header.
 * A localhost origin is swapped for this machine's LAN address so a QR shown
 * on the PC screen can be followed by a phone.
 */
function originFor(req: NextRequest): string {
  const fromPage = req.nextUrl.searchParams.get("origin");
  const origin = fromPage && /^https?:\/\/[^/]+$/.test(fromPage) ? fromPage : requestOrigin(req);
  return shareableOrigin(origin);
}

/** QR code for an item's asset tag, as SVG. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getActor())) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const item = await items.get(id);
  if (!item) return new NextResponse("Not found", { status: 404 });
  const svg = await QRCode.toString(assetTagUrl(item.assetTag, originFor(req)), { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return new NextResponse(svg, {
    // Not cached: the encoded URL depends on where the page was opened from.
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
  });
}
