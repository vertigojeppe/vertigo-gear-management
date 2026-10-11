import type { NextRequest } from "next/server";
import { items } from "@/modules/inventory";

/**
 * Asset tag landing URL (the QR payload): /t/VG-0042 → item page.
 * Unknown tags go to the items list with the tag as search text.
 *
 * The redirect is relative on purpose: the dev server reports its own
 * hostname as the request origin, which would send a phone on the local
 * network to localhost.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ tag: string }> }) {
  const { tag } = await ctx.params;
  const item = await items.findByAssetTag(decodeURIComponent(tag));
  const location = item ? `/inventory/items/${item.id}` : `/inventory/items?q=${encodeURIComponent(tag)}&missingTag=1`;
  return new Response(null, { status: 307, headers: { Location: location } });
}
