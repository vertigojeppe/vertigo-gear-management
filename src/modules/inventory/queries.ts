import { prisma } from "@/lib/db";
import { categoryColorMap, lengthColorFor } from "./color-map";
import { stockByModel } from "./consumables";
import { compareVariants } from "@/lib/variant";
import type { Prisma } from "@/generated/prisma/client";
import { activityFor } from "@/lib/activity";
import { appConfig, ITEM_STATUSES } from "../../../config/app.config";
import type { ItemFilters, ModelFilters } from "./schema";
import { categoryIdsIncludingChildren, toItemDto, toModelDto, type ItemDto, type ModelDto } from "./service";
import { buildTree, flattenTree, pathNames } from "./tree";
import { makersOf, modelLabel } from "@/lib/format";
import { bestMatches } from "@/lib/search";
import { itemOrderBy, sortFamilies } from "./sorting";
// eslint-disable-next-line no-restricted-imports -- the barrel loads server actions, which do not load under Vitest
import { glossary } from "@/modules/settings/glossary";

const PAGE = appConfig.pageSize;

/* Reference data for forms and filters */

export async function categoryOptions() {
  const rows = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return flattenTree(buildTree(rows)).map((c) => ({ id: c.id, name: c.name, depth: c.depth, parentId: c.parentId }));
}

/** Both maps the colour marks need, loaded once per page: category → top colour / length flag, and metres → colour. */
export async function loadColorMaps() {
  const [cats, lengths] = await Promise.all([prisma.category.findMany({ select: { id: true, parentId: true, color: true, lengthColors: true } }), prisma.lengthColor.findMany()]);
  return { byCategory: categoryColorMap(cats), lengths: new Map(lengths.map((l) => [l.metres.toNumber(), l.color])) };
}

export async function lengthColorRows() {
  return (await prisma.lengthColor.findMany({ orderBy: { metres: "asc" } })).map((r) => ({ id: r.id, metres: r.metres.toNumber(), color: r.color }));
}

export async function categoryTree() {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { models: true, children: true } } },
  });
  return buildTree(rows);
}

export async function locationOptions() {
  const rows = await prisma.location.findMany({ orderBy: [{ name: "asc" }] });
  return flattenTree(buildTree(rows)).map((l) => ({ id: l.id, name: l.name, depth: l.depth, type: l.type, parentId: l.parentId }));
}

export async function locationList() {
  const rows = await prisma.location.findMany({
    orderBy: [{ name: "asc" }],
    include: { _count: { select: { items: true, children: true } } },
  });
  return buildTree(rows);
}

export async function modelOptions() {
  const rows = await prisma.model.findMany({
    where: { archived: false },
    orderBy: [{ name: "asc" }, { manufacturer: "asc" }],
    select: { id: true, manufacturer: true, name: true, variant: true, trackingType: true, categoryId: true, notForRental: true, rentalDayPrice: true },
  });
  return rows
    .map((r) => ({ ...r, rentalDayPrice: r.rentalDayPrice === null ? null : r.rentalDayPrice.toNumber() }))
    .sort((a, b) => a.manufacturer.localeCompare(b.manufacturer) || a.name.localeCompare(b.name) || compareVariants(a.variant, b.variant));
}

/* Models list */

export type ModelListRow = ModelDto & {
  categoryPath: string[];
  /** Top category's colour (palette key) and the cable length tape colour, when any. */
  color: string | null;
  lengthColor: string | null;
  owned: number;
  inHouse: number;
  thumbUrl: string | null;
};

/** Models that share a name: one row in the list, the variants inside it. */
export type ModelFamily = {
  key: string;
  /** For sorting (sorting.ts): newest variant, highest day price, heaviest variant, quantity packed in 12 months (0 unless sorted by it). */
  addedAt: Date;
  dayPrice: number | null;
  weightKg: number | null;
  packed: number;
  /** The variants' manufacturers, "Robe" or "Neutrik, Amphenol" ("" when none). */
  manufacturer: string;
  name: string;
  categoryPath: string[];
  color: string | null;
  trackingType: "serialized" | "bulk" | "mixed";
  archived: boolean;
  owned: number;
  inHouse: number;
  thumbUrl: string | null;
  variants: ModelListRow[];
};

export async function listModels(filters: ModelFilters): Promise<{ families: ModelFamily[]; total: number; models: number; page: number; pages: number; closeMatches: boolean }> {
  const where: Prisma.ModelWhereInput = { archived: filters.archived ? undefined : false };
  if (filters.categoryId) where.categoryId = { in: await categoryIdsIncludingChildren(filters.categoryId) };
  if (filters.trackingType) where.trackingType = filters.trackingType;

  // Every model the other filters allow, searched here (forgiving: spaces, case, typos), grouped into families, then paginated by family (a few hundred rows at most).
  const [candidates, cats, colors] = await Promise.all([
    prisma.model.findMany({ where, orderBy: [{ name: "asc" }, { manufacturer: "asc" }], include: { defaultPhoto: { select: { id: true, thumbKey: true } } } }),
    prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
    loadColorMaps(),
  ]);
  // Category names count too, so "projektor" (via the search words) finds a "PT-RZ21K" filed under Projectors.
  const { rows: models, close: closeMatches } = bestMatches(candidates, (m) => [m.manufacturer, m.name, m.variant, m.description, ...pathNames(cats, m.categoryId)], filters.q, await glossary.load());
  const ids = models.map((m) => m.id);
  const counts = ids.length ? await prisma.item.groupBy({ by: ["modelId", "status"], where: { modelId: { in: ids } }, _sum: { quantity: true } }) : [];
  // Metre consumables have no bins: their stock is the ledger, shown as both "in house" and "owned".
  const metreStock = await stockByModel(models.filter((m) => m.consumable && m.unit === "m"));
  const owned = new Map<string, number>();
  const inHouse = new Map<string, number>();
  for (const c of counts) {
    const q = c._sum.quantity ?? 0;
    if (c.status !== "retired") owned.set(c.modelId, (owned.get(c.modelId) ?? 0) + q);
    if (c.status === "in_house") inHouse.set(c.modelId, (inHouse.get(c.modelId) ?? 0) + q);
  }
  const rows: ModelListRow[] = models.map((m) => ({
    ...toModelDto(m),
    categoryPath: pathNames(cats, m.categoryId),
    color: colors.byCategory.get(m.categoryId)?.color ?? null,
    lengthColor: lengthColorFor(m.variant, colors.byCategory.get(m.categoryId), colors.lengths),
    owned: metreStock.get(m.id) ?? owned.get(m.id) ?? 0,
    inHouse: metreStock.get(m.id) ?? inHouse.get(m.id) ?? 0,
    thumbUrl: m.defaultPhoto?.thumbKey ? `/api/files/${m.defaultPhoto.id}?thumb=1` : null,
  }));
  const grouped = groupFamilies(rows);
  if (filters.sort === "packed") {
    // Quantity on packing lists made in the last 12 months, per model, summed per family.
    const since = new Date(Date.now() - 365 * 24 * 3_600_000);
    const used = ids.length ? await prisma.packingLine.groupBy({ by: ["modelId"], where: { modelId: { in: ids }, list: { createdAt: { gte: since } } }, _sum: { quantity: true } }) : [];
    const byModel = new Map(used.map((u) => [u.modelId, u._sum.quantity ?? 0]));
    for (const f of grouped) f.packed = f.variants.reduce((n, v) => n + (byModel.get(v.id) ?? 0), 0);
  }
  const families = sortFamilies(grouped, filters.sort);
  const total = families.length;
  return { families: families.slice((filters.page - 1) * PAGE, filters.page * PAGE), total, models: rows.length, page: filters.page, pages: Math.max(1, Math.ceil(total / PAGE)), closeMatches };
}

const maxOrNull = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));

/** Pure: rows → families (by name, case-insensitive; manufacturers may differ), variants sorted by size, totals summed. */
export function groupFamilies(rows: ModelListRow[]): ModelFamily[] {
  const map = new Map<string, ModelFamily>();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    const fam = map.get(key);
    if (fam) {
      fam.variants.push(r);
      fam.owned += r.owned;
      fam.inHouse += r.inHouse;
      if (fam.trackingType !== r.trackingType) fam.trackingType = "mixed";
      fam.archived = fam.archived && r.archived;
      fam.thumbUrl ??= r.thumbUrl;
      if (r.createdAt > fam.addedAt) fam.addedAt = r.createdAt;
      fam.dayPrice = maxOrNull(fam.dayPrice, r.rentalDayPrice);
      fam.weightKg = maxOrNull(fam.weightKg, r.weightKg);
    } else
      map.set(key, {
        key,
        manufacturer: r.manufacturer,
        name: r.name,
        categoryPath: r.categoryPath,
        color: r.color,
        trackingType: r.trackingType,
        archived: r.archived,
        owned: r.owned,
        inHouse: r.inHouse,
        thumbUrl: r.thumbUrl,
        addedAt: r.createdAt,
        dayPrice: r.rentalDayPrice,
        weightKg: r.weightKg,
        packed: 0,
        variants: [r],
      });
  }
  for (const fam of map.values()) {
    fam.variants.sort((a, b) => compareVariants(a.variant, b.variant));
    fam.manufacturer = makersOf(fam.variants);
  }
  return [...map.values()];
}

/* Model detail */

export async function modelDetail(id: string) {
  const m = await prisma.model.findUnique({
    where: { id },
    include: {
      category: true,
      defaultPhoto: { select: { id: true, thumbKey: true } },
      items: { orderBy: { assetTag: "asc" }, include: { location: { select: { id: true, name: true } }, parentItem: { select: { id: true, name: true, assetTag: true } } } },
    },
  });
  if (!m) return null;
  const [cats, siblings, colors] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
    prisma.model.findMany({ where: { id: { not: id }, name: { equals: m.name, mode: "insensitive" } }, select: { id: true, manufacturer: true, variant: true, archived: true, categoryId: true } }),
    loadColorMaps(),
  ]);
  const coloring = colors.byCategory.get(m.categoryId);
  const byStatus: Record<string, number> = {};
  for (const s of ITEM_STATUSES) byStatus[s.key] = 0;
  for (const i of m.items) byStatus[i.status] = (byStatus[i.status] ?? 0) + i.quantity;
  return {
    model: toModelDto(m),
    /** Other sizes of the same family, by size. */
    variants: siblings.sort((a, b) => compareVariants(a.variant, b.variant)).map((s) => ({ ...s, lengthColor: lengthColorFor(s.variant, colors.byCategory.get(s.categoryId), colors.lengths) })),
    categoryPath: pathNames(cats, m.categoryId),
    categoryColor: coloring?.color ?? null,
    lengthColor: lengthColorFor(m.variant, coloring, colors.lengths),
    photoUrl: m.defaultPhoto ? `/api/files/${m.defaultPhoto.id}` : null,
    thumbUrl: m.defaultPhoto?.thumbKey ? `/api/files/${m.defaultPhoto.id}?thumb=1` : null,
    items: m.items.map((i) => ({
      ...toItemDto(i),
      locationName: i.location?.name ?? null,
      parentItem: i.parentItem ? { id: i.parentItem.id, label: i.parentItem.name ?? i.parentItem.assetTag } : null,
    })),
    byStatus,
    owned: m.items.filter((i) => i.status !== "retired").reduce((a, i) => a + i.quantity, 0),
    activity: await activityFor("model", id, 20),
  };
}

/* Items list */

export type ItemListRow = ItemDto & {
  model: { id: string; manufacturer: string; name: string; trackingType: string };
  categoryPath: string[];
  locationName: string | null;
  parentLabel: string | null;
  thumbUrl: string | null;
};

const ITEM_SEARCH_SELECT = { id: true, assetTag: true, serialNumber: true, name: true, notes: true, model: { select: { manufacturer: true, name: true, variant: true } } } as const;
type ItemSearchRow = { id: string; assetTag: string; serialNumber: string | null; name: string | null; notes?: string | null; model: { manufacturer: string; name: string; variant: string | null } };
const itemSearchFields = (i: ItemSearchRow) => [i.assetTag, i.serialNumber, i.name, i.notes, i.model.manufacturer, i.model.name, i.model.variant];

/** The item list's filters as a Prisma where clause (also used for label printing). */
export async function itemWhere(filters: ItemFilters & { customField?: { key: string; value: string } }): Promise<Prisma.ItemWhereInput> {
  return (await itemSearch(filters)).where;
}

/** The item filters, with the search run forgivingly over the rows the other filters allow; `close` when only close matches were found. */
async function itemSearch(filters: ItemFilters & { customField?: { key: string; value: string } }): Promise<{ where: Prisma.ItemWhereInput; close: boolean }> {
  const where: Prisma.ItemWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.locationId) where.locationId = filters.locationId;
  if (filters.modelId) where.modelId = filters.modelId;
  if (filters.kits) where.isKit = true;
  if (filters.categoryId) where.model = { categoryId: { in: await categoryIdsIncludingChildren(filters.categoryId) } };
  if (filters.customField) {
    where.customFields = { path: [filters.customField.key], equals: filters.customField.value };
  }
  if (!filters.q) return { where, close: false };
  const candidates = await prisma.item.findMany({ where, select: ITEM_SEARCH_SELECT });
  const found = bestMatches(candidates, itemSearchFields, filters.q, await glossary.load());
  return { where: { ...where, id: { in: found.rows.map((i) => i.id) } }, close: found.close };
}

/** Items to print labels for: explicit ids, or whatever the list filters select, in tag order. */
export async function itemsForLabels(pick: { ids: string[] } | { filters: ItemFilters }, max: number) {
  const where = "ids" in pick ? { id: { in: pick.ids } } : await itemWhere(pick.filters);
  return prisma.item.findMany({ where, orderBy: { assetTag: "asc" }, take: max, select: { id: true, assetTag: true, name: true, model: { select: { manufacturer: true, name: true, variant: true } } } });
}

export async function listItems(
  filters: ItemFilters & { customField?: { key: string; value: string } },
): Promise<{ rows: ItemListRow[]; total: number; page: number; pages: number; closeMatches: boolean }> {
  const { where, close: closeMatches } = await itemSearch(filters);

  const [total, rows, cats] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      orderBy: itemOrderBy(filters.sort),
      skip: (filters.page - 1) * PAGE,
      take: PAGE,
      include: {
        model: { select: { id: true, manufacturer: true, name: true, variant: true, trackingType: true, categoryId: true, defaultPhoto: { select: { id: true, thumbKey: true } } } },
        location: { select: { name: true } },
        parentItem: { select: { name: true, assetTag: true } },
      },
    }),
    prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
  ]);

  return {
    rows: rows.map((i) => ({
      ...toItemDto(i),
      model: { id: i.model.id, manufacturer: i.model.manufacturer, name: i.model.name, trackingType: i.model.trackingType },
      categoryPath: pathNames(cats, i.model.categoryId),
      locationName: i.location?.name ?? null,
      parentLabel: i.parentItem ? (i.parentItem.name ?? i.parentItem.assetTag) : null,
      thumbUrl: i.model.defaultPhoto?.thumbKey ? `/api/files/${i.model.defaultPhoto.id}?thumb=1` : null,
    })),
    total,
    page: filters.page,
    pages: Math.max(1, Math.ceil(total / PAGE)),
    closeMatches,
  };
}

/* Item detail */

export async function itemDetail(id: string) {
  const i = await prisma.item.findUnique({
    where: { id },
    include: {
      model: { include: { category: true, defaultPhoto: { select: { id: true, thumbKey: true } } } },
      location: true,
      parentItem: { select: { id: true, name: true, assetTag: true } },
      contents: { orderBy: { assetTag: "asc" }, include: { model: { select: { manufacturer: true, name: true, variant: true } } } },
      statusLogs: { orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } },
    },
  });
  if (!i) return null;
  const cats = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
  return {
    item: toItemDto(i),
    model: toModelDto(i.model),
    categoryPath: pathNames(cats, i.model.categoryId),
    photoUrl: i.model.defaultPhoto ? `/api/files/${i.model.defaultPhoto.id}` : null,
    location: i.location ? { id: i.location.id, name: i.location.name, type: i.location.type } : null,
    parentItem: i.parentItem ? { id: i.parentItem.id, label: i.parentItem.name ?? i.parentItem.assetTag } : null,
    contents: i.contents.map((c) => ({ ...toItemDto(c), modelLabel: `${modelLabel(c.model)}` })),
    statusLogs: i.statusLogs.map((l) => ({
      id: l.id,
      fromStatus: l.fromStatus,
      toStatus: l.toStatus,
      reason: l.reason,
      userName: l.user?.name ?? null,
      createdAt: l.createdAt,
    })),
    activity: await activityFor("item", id, 30),
  };
}

/** Candidate items for "add to kit": serialized or bulk, not already in a kit, not the kit itself. */
export async function kitCandidates(kitId: string, q: string | undefined) {
  const where: Prisma.ItemWhereInput = { id: { not: kitId }, parentItemId: null, status: { not: "retired" } };
  if (q) {
    const candidates = await prisma.item.findMany({ where, select: { ...ITEM_SEARCH_SELECT, notes: false } });
    where.id = { in: bestMatches(candidates, itemSearchFields, q, await glossary.load()).rows.map((i) => i.id) };
  }
  const rows = await prisma.item.findMany({
    where,
    take: 20,
    orderBy: { assetTag: "asc" },
    include: { model: { select: { manufacturer: true, name: true, variant: true } } },
  });
  return rows.map((r) => ({ id: r.id, assetTag: r.assetTag, label: `${modelLabel(r.model)}${r.name ? ` · ${r.name}` : ""}${r.serialNumber ? ` · SN ${r.serialNumber}` : ""}` }));
}

/** What a model's family shares, for the edit-family dialog: null where the variants differ. */
export async function familyState(modelId: string) {
  const m = await prisma.model.findUniqueOrThrow({ where: { id: modelId }, select: { manufacturer: true, name: true } });
  const family = await prisma.model.findMany({
    where: { name: { equals: m.name, mode: "insensitive" } },
    select: { manufacturer: true, categoryId: true, notForRental: true, archived: true, consumable: true },
  });
  const shared = <K extends keyof (typeof family)[number]>(k: K) => (family.every((f) => f[k] === family[0][k]) ? family[0][k] : null);
  return { count: family.length, manufacturer: shared("manufacturer"), categoryId: shared("categoryId"), notForRental: shared("notForRental"), archived: shared("archived"), consumable: shared("consumable") };
}

/* Dashboard */

export async function dashboardStats() {
  const [byStatus, modelCount, outRows, attention, locations] = await Promise.all([
    prisma.item.groupBy({ by: ["status"], _sum: { quantity: true }, _count: { _all: true } }),
    prisma.model.count({ where: { archived: false } }),
    prisma.item.findMany({
      where: { status: { in: ["on_project", "rented_out"] }, parentItemId: null },
      include: { model: { select: { manufacturer: true, name: true, variant: true } }, location: { select: { id: true, name: true, type: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.item.findMany({
      where: { status: { in: ["in_repair", "missing"] } },
      include: { model: { select: { manufacturer: true, name: true, variant: true } }, statusLogs: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.location.count(),
  ]);

  const statusTotals: Record<string, { units: number; rows: number }> = {};
  for (const s of ITEM_STATUSES) statusTotals[s.key] = { units: 0, rows: 0 };
  for (const g of byStatus) statusTotals[g.status] = { units: g._sum.quantity ?? 0, rows: g._count._all };

  const outGroups = new Map<string, { location: { id: string | null; name: string; type: string | null }; items: typeof outRows }>();
  for (const r of outRows) {
    const key = r.location?.id ?? "none";
    const group = outGroups.get(key) ?? { location: { id: r.location?.id ?? null, name: r.location?.name ?? "No location", type: r.location?.type ?? null }, items: [] };
    group.items.push(r);
    outGroups.set(key, group);
  }

  return {
    modelCount,
    locationCount: locations,
    statusTotals,
    out: [...outGroups.values()].map((g) => ({
      location: g.location,
      items: g.items.map((i) => ({ ...toItemDto(i), modelLabel: `${modelLabel(i.model)}` })),
    })),
    attention: attention.map((i) => ({
      ...toItemDto(i),
      modelLabel: `${modelLabel(i.model)}`,
      reason: i.statusLogs[0]?.reason ?? null,
      since: i.statusLogs[0]?.createdAt ?? i.updatedAt,
    })),
  };
}
