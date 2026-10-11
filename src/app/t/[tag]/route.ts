import { NextResponse, type NextRequest } from "next/server";
import { items } from "@/modules/inventory";

/**
 * Asset tag landing URL (the QR payload): /t/VG-0042 → item page.
 * Unknown tags go to the items list with the tag as search text.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/t/[tag]">) {
  const { tag } = await ctx.params;
  const item = await items.findByAssetTag(decodeURIComponent(tag));
  const url = new URL(item ? `/inventory/items/${item.id}` : `/inventory/items?q=${encodeURIComponent(tag)}&missingTag=1`, _req.nextUrl.origin);
  return NextResponse.redirect(url, 307);
}
