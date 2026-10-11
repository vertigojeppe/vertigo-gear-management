import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { assetTagUrl } from "@/lib/asset-tag";
import { getActor } from "@/lib/auth/session";
import { items } from "@/modules/inventory";

/**
 * Origin to encode while APP_URL is not set to a public address.
 * Preferred: the `origin` query parameter the page adds from
 * window.location (the only reliable source in development, where the
 * server reports its own hostname). Fallback: forwarded/host headers.
 */
function requestOrigin(req: NextRequest): string | undefined {
  const fromPage = req.nextUrl.searchParams.get("origin");
  if (fromPage && /^https?:\/\/[^/]+$/.test(fromPage)) return fromPage;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return undefined;
  const proto = req.headers.get("x-forwarded-proto") ?? (req.url.startsWith("https") ? "https" : "http");
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
