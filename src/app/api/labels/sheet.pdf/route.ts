import { NextResponse, type NextRequest } from "next/server";
import { assetTagUrl } from "@/lib/asset-tag";
import { can, getActor } from "@/lib/auth/session";
import { modelLabel } from "@/lib/format";
import { requestOrigin, shareableOrigin } from "@/lib/request-origin";
import { isLabelSizeKey, itemFilters, itemsForLabels, labelSize, renderLabels } from "@/modules/inventory";

const MAX = 1000;

/**
 * Asset-tag labels as PDF. Either `ids=a,b,c` or the item list's filters
 * (q, status, locationId, categoryId, modelId, kits) choose the items;
 * `size` is a key from LABEL_SIZES and `offset` skips used cells on the
 * first sheet. `origin` works as on the QR route: the browser's address
 * is encoded while APP_URL still points at localhost.
 */
export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor || !can(actor.role, "inventory.read")) return new NextResponse("Unauthorized", { status: 401 });
  const sp = req.nextUrl.searchParams;
  const sizeKey = sp.get("size") ?? "avery_l7160";
  if (!isLabelSizeKey(sizeKey)) return new NextResponse("Unknown label size", { status: 400 });
  const size = labelSize(sizeKey);
  const offset = Math.max(0, Math.min(Number(sp.get("offset") ?? 0) || 0, size.columns * size.rows - 1));
  const ids = (sp.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const filters = itemFilters.parse(Object.fromEntries(sp.entries()));
  const rows = await itemsForLabels(ids.length ? { ids } : { filters }, MAX);
  if (rows.length === 0) return new NextResponse("No items match", { status: 404 });

  const fromPage = sp.get("origin");
  const origin = shareableOrigin(fromPage && /^https?:\/\/[^/]+$/.test(fromPage) ? fromPage : requestOrigin(req));
  const pdf = await renderLabels(
    rows.map((i) => ({ id: i.id, assetTag: i.assetTag, url: assetTagUrl(i.assetTag, origin), title: modelLabel(i.model), subtitle: i.name })),
    size,
    offset,
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="labels-${sizeKey}-${rows.length}.pdf"`, "Cache-Control": "no-store" },
  });
}
