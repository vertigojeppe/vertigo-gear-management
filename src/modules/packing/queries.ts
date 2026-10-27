import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { loadColorMaps } from "@/modules/inventory/queries";
// eslint-disable-next-line no-restricted-imports -- pure helper
import { lengthColorFor } from "@/modules/inventory/color-map";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { stockByModel } from "@/modules/inventory/consumables";
// eslint-disable-next-line no-restricted-imports -- pure helper
import { suggestSpares, type Suggestion } from "@/modules/inventory/consumables-logic";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { pathNames } from "@/modules/inventory/tree";
import type { PackingStatus } from "../../../config/app.config";
import { lineProgress, listProgress, listTotals, type LineProgress } from "./logic";
import { compareVariants } from "@/lib/variant";
import type { CatalogEntry } from "./picker";
import { modelLabel, familyLabel } from "@/lib/format";

const num = (v: { toNumber(): number } | null) => (v === null ? null : v.toNumber());

export type CheckRow = {
  id: string;
  phase: "out" | "in";
  itemId: string | null;
  assetTag: string | null;
  itemName: string | null;
  quantity: number;
  outcome: string;
  note: string | null;
  checkedBy: string | null;
  checkedAt: Date;
  /** For out checks: how much of it has come back (bulk) / whether it is back. */
  returned: number;
  /** For in checks: the out check it answers. */
  outCheckId: string | null;
};

export type LineRow = {
  id: string;
  modelId: string;
  consumable: boolean;
  modelLabel: string;
  /** Top category colour and cable length tape colour (palette keys), when any. */
  categoryColor: string | null;
  lengthColor: string | null;
  trackingType: "serialized" | "bulk";
  categoryPath: string[];
  categoryTop: string;
  quantity: number;
  note: string | null;
  itemId: string | null;
  itemTag: string | null;
  itemName: string | null;
  isKit: boolean;
  kitContents: { id: string; assetTag: string; label: string; quantity: number }[];
  caseItemId: string | null;
  caseLabel: string | null;
  weightKg: number | null;
  powerDrawW: number | null;
  progress: LineProgress;
  checks: CheckRow[];
  /** Serialized: in-house units not yet packed on this list (for the pick list). */
  availableUnits: { id: string; assetTag: string; serialNumber: string | null }[];
  /** Bulk: bins to take from. */
  bins: { id: string; assetTag: string; quantity: number; locationName: string | null }[];
  /** Units (or bulk quantity) of this model that exist, any status except retired. */
  owned: number;
  /** ... and how many are in house right now. */
  inHouse: number;
};

export async function listDetail(listId: string) {
  const list = await prisma.packingList.findUnique({
    where: { id: listId },
    include: {
      project: { include: { client: { select: { name: true } } } },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          model: { select: { id: true, manufacturer: true, name: true, variant: true, trackingType: true, categoryId: true, weightKg: true, powerDrawW: true, consumable: true } },
          item: { select: { id: true, assetTag: true, name: true, isKit: true, contents: { include: { model: { select: { manufacturer: true, name: true, variant: true, weightKg: true, powerDrawW: true } } } } } },
          caseItem: { select: { id: true, assetTag: true, name: true } },
          checks: { orderBy: { checkedAt: "asc" }, include: { item: { select: { assetTag: true, name: true } }, checkedBy: { select: { name: true } } } },
        },
      },
    },
  });
  if (!list) return null;
  const modelIds = [...new Set(list.lines.map((l) => l.modelId))];
  const [cats, colors, subHireRows, stockRows, shelf] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
    loadColorMaps(),
    // What the project rents in: shown with the list so nothing is forgotten at the partner's door, never ticked or checked.
    prisma.subHireLine.findMany({ where: { projectId: list.projectId }, orderBy: [{ startDate: "asc" }, { createdAt: "asc" }], include: { item: { include: { owner: { select: { name: true } } } } } }),
    prisma.item.groupBy({ by: ["modelId", "status"], where: { modelId: { in: modelIds } }, _sum: { quantity: true } }),
    // While drafting: the loose units and bins in house, for picking a unit or a bin per line.
    prisma.item.findMany({ where: { modelId: { in: list.status === "draft" ? modelIds : [] }, status: "in_house", parentItemId: null }, orderBy: { assetTag: "asc" }, select: { id: true, modelId: true, assetTag: true, serialNumber: true, quantity: true, isKit: true, location: { select: { name: true } } } }),
  ]);
  const subHire: SubHireRow[] = subHireRows.map((l) => ({
    id: l.id,
    label: modelLabel(l.item),
    ownerName: l.item.owner.name,
    quantity: l.quantity,
    note: l.note,
  }));
  const shelfByModel = new Map<string, typeof shelf>();
  for (const i of shelf) {
    const rows = shelfByModel.get(i.modelId);
    if (rows) rows.push(i);
    else shelfByModel.set(i.modelId, [i]);
  }
  const packedUnitIds = new Set(list.lines.flatMap((l) => l.checks.filter((c) => c.phase === "out" && c.itemId).map((c) => c.itemId!)));

  const lines: LineRow[] = [];
  const stockByModel = new Map<string, { owned: number; inHouse: number }>();
  for (const r of stockRows) {
    const cur = stockByModel.get(r.modelId) ?? { owned: 0, inHouse: 0 };
    const q = r._sum.quantity ?? 0;
    if (r.status !== "retired") cur.owned += q;
    if (r.status === "in_house") cur.inHouse += q;
    stockByModel.set(r.modelId, cur);
  }

  for (const l of list.lines) {
    const tracking = l.model.trackingType === "bulk" ? "bulk" : "serialized";
    const checks: CheckRow[] = l.checks.map((c) => ({
      id: c.id,
      phase: c.phase as "out" | "in",
      itemId: c.itemId,
      assetTag: c.item?.assetTag ?? null,
      itemName: c.item?.name ?? null,
      quantity: c.quantity,
      outcome: c.outcome,
      note: c.note,
      checkedBy: c.checkedBy?.name ?? null,
      checkedAt: c.checkedAt,
      returned: c.phase === "out" ? l.checks.filter((x) => x.phase === "in" && (x.outCheckId ? x.outCheckId === c.id : x.itemId === c.itemId)).reduce((s, x) => s + x.quantity, 0) : 0,
      outCheckId: c.outCheckId,
    }));
    const progress = lineProgress({ quantity: l.quantity, trackingType: tracking, checks });
    const availableUnits =
      tracking === "serialized" && list.status === "draft" && !l.itemId
        ? (shelfByModel.get(l.modelId) ?? []).filter((u) => !u.isKit && !packedUnitIds.has(u.id)).map((u) => ({ id: u.id, assetTag: u.assetTag, serialNumber: u.serialNumber }))
        : [];
    const bins =
      tracking === "bulk" && list.status === "draft"
        ? [...(shelfByModel.get(l.modelId) ?? [])].sort((a, b) => b.quantity - a.quantity).map((b) => ({ id: b.id, assetTag: b.assetTag, quantity: b.quantity, locationName: b.location?.name ?? null }))
        : [];
    const path = pathNames(cats, l.model.categoryId);
    const stock = stockByModel.get(l.modelId) ?? { owned: 0, inHouse: 0 };
    lines.push({
      id: l.id,
      modelId: l.modelId,
      modelLabel: `${modelLabel(l.model)}`,
      categoryColor: colors.byCategory.get(l.model.categoryId)?.color ?? null,
      lengthColor: lengthColorFor(l.model.variant, colors.byCategory.get(l.model.categoryId), colors.lengths),
      trackingType: tracking,
      /** Consumable spares can be checked in as "used". */
      consumable: l.model.consumable,
      categoryPath: path,
      categoryTop: path[0] ?? "",
      quantity: l.quantity,
      note: l.note,
      itemId: l.itemId,
      itemTag: l.item?.assetTag ?? null,
      itemName: l.item?.name ?? null,
      isKit: l.item?.isKit ?? false,
      kitContents: (l.item?.contents ?? []).map((c) => ({ id: c.id, assetTag: c.assetTag, label: `${modelLabel(c.model)}`, quantity: c.quantity })),
      caseItemId: l.caseItemId,
      caseLabel: l.caseItem ? (l.caseItem.name ?? l.caseItem.assetTag) : null,
      weightKg: num(l.model.weightKg),
      powerDrawW: l.model.powerDrawW,
      progress,
      checks,
      availableUnits,
      bins,
      owned: stock.owned,
      inHouse: stock.inHouse,
    });
  }

  const totals = listTotals(
    lines.map((l) => ({
      quantity: l.quantity,
      weightKg: l.weightKg,
      powerDrawW: l.powerDrawW,
      isCase: l.isKit,
      kitContentsWeightKg: l.isKit ? list.lines.find((x) => x.id === l.id)?.item?.contents.reduce((s, c) => s + (num(c.model.weightKg) ?? 0) * c.quantity, 0) : 0,
      kitContentsPowerW: l.isKit ? list.lines.find((x) => x.id === l.id)?.item?.contents.reduce((s, c) => s + (c.model.powerDrawW ?? 0) * c.quantity, 0) : 0,
    })),
  );

  return {
    list: { id: list.id, name: list.name, groupBy: list.groupBy as "category" | "case", status: list.status as PackingStatus, notes: list.notes, checkedOutAt: list.checkedOutAt, checkedInAt: list.checkedInAt },
    project: { id: list.project.id, name: list.project.name, clientName: list.project.client?.name ?? null, venueName: list.project.venueName, reserveFrom: list.project.reserveFrom, reserveTo: list.project.reserveTo },
    lines,
    subHire,
    progress: listProgress(lines),
    totals,
  };
}

export type ListDetail = NonNullable<Awaited<ReturnType<typeof listDetail>>>;

/** Name and project of a list, for the page title (and the offline index the service worker builds from it). */
export async function listTitle(listId: string): Promise<string | null> {
  const l = await prisma.packingList.findUnique({ where: { id: listId }, select: { name: true, project: { select: { name: true } } } });
  return l ? `${l.name} · ${l.project.name}` : null;
}
export type SubHireRow = { id: string; label: string; ownerName: string; quantity: number; note: string | null };

/** Lines grouped for display. */
export function groupLines(lines: LineRow[], groupBy: "category" | "case"): { key: string; label: string; color: string | null; lines: LineRow[] }[] {
  const groups = new Map<string, { key: string; label: string; color: string | null; lines: LineRow[] }>();
  for (const l of lines) {
    const key = groupBy === "case" ? (l.caseItemId ?? "__loose__") : l.categoryTop || "__other__";
    const label = groupBy === "case" ? (l.caseLabel ?? "Loose") : l.categoryTop || "Other";
    const g = groups.get(key) ?? { key, label, color: groupBy === "category" ? (l.categoryColor ?? null) : null, lines: [] };
    g.lines.push(l);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => (a.key === "__loose__" || a.key === "__other__" ? 1 : b.key === "__loose__" || b.key === "__other__" ? -1 : a.label.localeCompare(b.label)));
}

export async function listsForProject(projectId: string) {
  return (await listsForProjects([projectId])).get(projectId) ?? [];
}

/** The packing lists of several projects in one query, by project id. */
export async function listsForProjects(projectIds: string[]) {
  const rows = projectIds.length ? await prisma.packingList.findMany({ where: { projectId: { in: projectIds } }, orderBy: { createdAt: "asc" }, include: { lines: { include: { model: { select: { trackingType: true } }, checks: true } } } }) : [];
  const out = new Map(projectIds.map((id) => [id, [] as ListSummary[]]));
  for (const r of rows) out.get(r.projectId)?.push(summary(r));
  return out;
}

export type ListSummary = ReturnType<typeof summary>;

function summary(r: Prisma.PackingListGetPayload<{ include: { lines: { include: { model: { select: { trackingType: true } }; checks: true } } } }>) {
  return {
    id: r.id,
    name: r.name,
    status: r.status as PackingStatus,
    lineCount: r.lines.length,
    progress: listProgress(r.lines.map((l) => ({ quantity: l.quantity, trackingType: l.model.trackingType === "bulk" ? "bulk" : "serialized", checks: l.checks.map((c) => ({ phase: c.phase as "out" | "in", quantity: c.quantity, outcome: c.outcome })) }))),
    checkedOutAt: r.checkedOutAt,
    checkedInAt: r.checkedInAt,
  };
}

export async function kitOptions() {
  const rows = await prisma.item.findMany({ where: { isKit: true, status: "in_house" }, orderBy: { name: "asc" }, include: { model: { select: { manufacturer: true, name: true, variant: true } }, _count: { select: { contents: true } } } });
  return rows.map((k) => ({ id: k.id, label: `${k.name ?? k.assetTag} (${k._count.contents} items, ${modelLabel(k.model)})` }));
}

export async function templateOptions() {
  return prisma.packingTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, _count: { select: { lines: true } } } });
}

export async function templateDetail(id: string) {
  const t = await prisma.packingTemplate.findUnique({ where: { id }, include: { lines: { orderBy: { sortOrder: "asc" }, include: { model: { select: { id: true, manufacturer: true, name: true, variant: true, trackingType: true } } } } } });
  if (!t) return null;
  return { ...t, lines: t.lines.map((l) => ({ id: l.id, modelId: l.modelId, modelLabel: `${modelLabel(l.model)}`, quantity: l.quantity, note: l.note })) };
}

export async function otherListsForCopy(projectId: string) {
  const rows = await prisma.packingList.findMany({ where: { projectId: { not: projectId } }, orderBy: { createdAt: "desc" }, take: 30, include: { project: { select: { name: true } }, _count: { select: { lines: true } } } });
  return rows.map((r) => ({ id: r.id, label: `${r.project.name} – ${r.name} (${r._count.lines} lines)` }));
}

/* Gear picker ------------------------------------------------------------- */


/**
 * Everything the picker can add: active models with their stock and the
 * units' asset tags (so a scanned tag finds the model), plus kits that are
 * in house. `onList` tells how much of each is already on the list or
 * template, so the picker can show it and the user does not add twice.
 */
export async function gearCatalog(scope: { listId: string } | { templateId: string }): Promise<CatalogEntry[]> {
  const [models, cats, items, lines, colors] = await Promise.all([
    prisma.model.findMany({ where: { archived: false, NOT: { consumable: true, unit: "m" } }, orderBy: [{ name: "asc" }, { manufacturer: "asc" }], select: { id: true, manufacturer: true, name: true, variant: true, trackingType: true, categoryId: true } }).then((rows) => rows.sort((a, b) => a.name.localeCompare(b.name) || compareVariants(a.variant, b.variant) || a.manufacturer.localeCompare(b.manufacturer))),
    prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
    prisma.item.findMany({ where: { status: { not: "retired" } }, select: { id: true, modelId: true, assetTag: true, name: true, status: true, quantity: true, isKit: true, _count: { select: { contents: true } } } }),
    "listId" in scope
      ? prisma.packingLine.findMany({ where: { listId: scope.listId }, select: { modelId: true, itemId: true, quantity: true } })
      : prisma.packingTemplateLine.findMany({ where: { templateId: scope.templateId }, select: { modelId: true, quantity: true } }).then((rows) => rows.map((r) => ({ ...r, itemId: null as string | null }))),
    loadColorMaps(),
  ]);
  const stock = new Map<string, { owned: number; inHouse: number; tags: string[] }>();
  for (const i of items) {
    const cur = stock.get(i.modelId) ?? { owned: 0, inHouse: 0, tags: [] };
    cur.owned += i.quantity;
    if (i.status === "in_house") cur.inHouse += i.quantity;
    if (!i.isKit) cur.tags.push(i.assetTag);
    stock.set(i.modelId, cur);
  }
  const onList = new Map<string, number>();
  for (const l of lines) onList.set(l.itemId ?? l.modelId, (onList.get(l.itemId ?? l.modelId) ?? 0) + l.quantity);
  const out: CatalogEntry[] = models.map((m) => {
    const s = stock.get(m.id) ?? { owned: 0, inHouse: 0, tags: [] };
    return { kind: "model", id: m.id, label: modelLabel(m), family: familyLabel(m), variant: m.variant, manufacturer: m.manufacturer, category: pathNames(cats, m.categoryId).join(" › "), color: colors.byCategory.get(m.categoryId)?.color ?? null, lengthColor: lengthColorFor(m.variant, colors.byCategory.get(m.categoryId), colors.lengths), trackingType: m.trackingType === "bulk" ? "bulk" : "serialized", owned: s.owned, inHouse: s.inHouse, onList: onList.get(m.id) ?? 0, tags: s.tags };
  });
  if ("listId" in scope) {
    const labelOf = new Map(models.map((m) => [m.id, modelLabel(m)]));
    for (const k of items.filter((i) => i.isKit && i.status === "in_house")) {
      out.push({ kind: "kit", id: k.id, label: k.name ?? k.assetTag, family: k.name ?? k.assetTag, variant: null, manufacturer: "", category: `${labelOf.get(k.modelId) ?? ""} · ${k._count.contents} items`, color: null, lengthColor: null, trackingType: "kit", owned: 1, inHouse: 1, onList: onList.get(k.id) ?? 0, tags: [k.assetTag] });
    }
  }
  return out;
}

export type SpareSuggestionRow = Suggestion & { label: string; forModels: string[]; inHouse: number; onWishList: boolean };

/**
 * Spare parts the gear on a list asks for (PartFit rules), minus what is on
 * it already and what was waved off. Metre consumables never appear: they
 * cannot be packed.
 */
export async function spareSuggestions(listId: string): Promise<SpareSuggestionRow[]> {
  const list = await prisma.packingList.findUnique({ where: { id: listId }, select: { dismissedSpares: true, lines: { select: { modelId: true, quantity: true } } } });
  if (!list) return [];
  const units = new Map<string, number>();
  for (const l of list.lines) units.set(l.modelId, (units.get(l.modelId) ?? 0) + l.quantity);
  const dismissed = new Set(Array.isArray(list.dismissedSpares) ? (list.dismissedSpares as string[]) : []);
  const fits = (await prisma.partFit.findMany({ where: { modelId: { in: [...units.keys()] }, part: { archived: false, unit: "pcs" } }, include: { part: true, model: { select: { manufacturer: true, name: true, variant: true } } } })).filter((f) => !dismissed.has(f.partId));
  if (fits.length === 0) return [];
  const parts = [...new Map(fits.map((f) => [f.partId, f.part])).values()];
  const [inHouse, wishes] = await Promise.all([stockByModel(parts), prisma.wishItem.findMany({ where: { status: "open" }, select: { manufacturer: true, name: true, variant: true } })]);
  const wishKey = (x: { manufacturer: string; name: string; variant: string | null }) => `${x.manufacturer}|${x.name}|${x.variant ?? ""}`.toLowerCase();
  const wished = new Set(wishes.map(wishKey));
  const modelLabels = new Map(fits.map((f) => [f.modelId, modelLabel(f.model)]));
  const suggestions = suggestSpares({ units, fits, onList: new Map([...units].filter(([id]) => parts.some((p) => p.id === id))), inHouse });
  return suggestions.map((s) => {
    const part = parts.find((p) => p.id === s.partId)!;
    return { ...s, label: modelLabel(part), forModels: s.forModels.map((id) => modelLabels.get(id) ?? ""), inHouse: inHouse.get(s.partId) ?? 0, onWishList: wished.has(wishKey(part)) };
  });
}
