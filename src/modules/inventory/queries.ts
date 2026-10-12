import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { activityFor } from "@/lib/activity";
import { appConfig, ITEM_STATUSES } from "../../../config/app.config";
import type { ItemFilters, ModelFilters } from "./schema";
import { categoryIdsIncludingChildren, toItemDto, toModelDto, type ItemDto, type ModelDto } from "./service";
import { buildTree, flattenTree, pathNames } from "./tree";
import { modelLabel } from "@/lib/format";

const PAGE = appConfig.pageSize;

/* Reference data for forms and filters */

export async function categoryOptions() {
  const rows = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return flattenTree(buildTree(rows)).map((c) => ({ id: c.id, name: c.name, depth: c.depth, parentId: c.parentId }));
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
    orderBy: [{ manufacturer: "asc" }, { name: "asc" }],
    select: { id: true, manufacturer: true, name: true, trackingType: true, categoryId: true, notForRental: true, rentalDayPrice: true },
  });
  return rows.map((r) => ({ ...r, rentalDayPrice: r.rentalDayPrice === null ? null : r.rentalDayPrice.toNumber() }));
}

/* Models list */

export type ModelListRow = ModelDto & {
  categoryPath: string[];
  owned: number;
  inHouse: number;
  thumbUrl: string | null;
};

export async function listModels(filters: ModelFilters): Promise<{ rows: ModelListRow[]; total: number; page: number; pages: number }> {
  const where: Prisma.ModelWhereInput = { archived: filters.archived ? undefined : false };
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { manufacturer: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.categoryId) where.categoryId = { in: await categoryIdsIncludingChildren(filters.categoryId) };
  if (filters.trackingType) where.trackingType = filters.trackingType;

  const [total, models, cats] = await Promise.all([
    prisma.model.count({ where }),
    prisma.model.findMany({
      where,
      orderBy: [{ manufacturer: "asc" }, { name: "asc" }],
      skip: (filters.page - 1) * PAGE,
      take: PAGE,
      include: { defaultPhoto: { select: { id: true, thumbKey: true } } },
    }),
    prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
  ]);

  const ids = models.map((m) => m.id);
  const counts = ids.length
    ? await prisma.item.groupBy({
        by: ["modelId", "status"],
        where: { modelId: { in: ids } },
        _sum: { quantity: true },
      })
    : [];
  const owned = new Map<string, number>();
  const inHouse = new Map<string, number>();
  for (const c of counts) {
    const q = c._sum.quantity ?? 0;
    if (c.status !== "retired") owned.set(c.modelId, (owned.get(c.modelId) ?? 0) + q);
    if (c.status === "in_house") inHouse.set(c.modelId, (inHouse.get(c.modelId) ?? 0) + q);
  }

  return {
    rows: models.map((m) => ({
      ...toModelDto(m),
      categoryPath: pathNames(cats, m.categoryId),
      owned: owned.get(m.id) ?? 0,
      inHouse: inHouse.get(m.id) ?? 0,
      thumbUrl: m.defaultPhoto?.thumbKey ? `/api/files/${m.defaultPhoto.id}?thumb=1` : null,
    })),
    total,
    page: filters.page,
    pages: Math.max(1, Math.ceil(total / PAGE)),
  };
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
  const cats = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
  const byStatus: Record<string, number> = {};
  for (const s of ITEM_STATUSES) byStatus[s.key] = 0;
  for (const i of m.items) byStatus[i.status] = (byStatus[i.status] ?? 0) + i.quantity;
  return {
    model: toModelDto(m),
    categoryPath: pathNames(cats, m.categoryId),
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

export async function listItems(
  filters: ItemFilters & { customField?: { key: string; value: string } },
): Promise<{ rows: ItemListRow[]; total: number; page: number; pages: number }> {
  const where: Prisma.ItemWhereInput = {};
  if (filters.q) {
    const q = filters.q;
    where.OR = [
      { assetTag: { contains: q, mode: "insensitive" } },
      { serialNumber: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { model: { name: { contains: q, mode: "insensitive" } } },
      { model: { manufacturer: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (filters.status) where.status = filters.status;
  if (filters.locationId) where.locationId = filters.locationId;
  if (filters.modelId) where.modelId = filters.modelId;
  if (filters.kits) where.isKit = true;
  if (filters.categoryId) where.model = { categoryId: { in: await categoryIdsIncludingChildren(filters.categoryId) } };
  if (filters.customField) {
    where.customFields = { path: [filters.customField.key], equals: filters.customField.value };
  }

  const [total, rows, cats] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      orderBy: [{ assetTag: "asc" }],
      skip: (filters.page - 1) * PAGE,
      take: PAGE,
      include: {
        model: { select: { id: true, manufacturer: true, name: true, trackingType: true, categoryId: true, defaultPhoto: { select: { id: true, thumbKey: true } } } },
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
      contents: { orderBy: { assetTag: "asc" }, include: { model: { select: { manufacturer: true, name: true } } } },
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
    where.OR = [
      { assetTag: { contains: q, mode: "insensitive" } },
      { serialNumber: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { model: { name: { contains: q, mode: "insensitive" } } },
      { model: { manufacturer: { contains: q, mode: "insensitive" } } },
    ];
  }
  const rows = await prisma.item.findMany({
    where,
    take: 20,
    orderBy: { assetTag: "asc" },
    include: { model: { select: { manufacturer: true, name: true } } },
  });
  return rows.map((r) => ({ id: r.id, assetTag: r.assetTag, label: `${modelLabel(r.model)}${r.name ? ` · ${r.name}` : ""}${r.serialNumber ? ` · SN ${r.serialNumber}` : ""}` }));
}

/* Dashboard */

export async function dashboardStats() {
  const [byStatus, modelCount, outRows, attention, locations] = await Promise.all([
    prisma.item.groupBy({ by: ["status"], _sum: { quantity: true }, _count: { _all: true } }),
    prisma.model.count({ where: { archived: false } }),
    prisma.item.findMany({
      where: { status: { in: ["on_project", "rented_out"] }, parentItemId: null },
      include: { model: { select: { manufacturer: true, name: true } }, location: { select: { id: true, name: true, type: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.item.findMany({
      where: { status: { in: ["in_repair", "missing"] } },
      include: { model: { select: { manufacturer: true, name: true } }, statusLogs: { orderBy: { createdAt: "desc" }, take: 1 } },
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
