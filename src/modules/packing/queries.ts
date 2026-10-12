import { prisma } from "@/lib/db";
// eslint-disable-next-line no-restricted-imports -- the barrel pulls server actions (next-auth) into Vitest
import { pathNames } from "@/modules/inventory/tree";
import type { PackingStatus } from "../../../config/app.config";
import { lineProgress, listProgress, listTotals, type LineProgress } from "./logic";

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
};

export type LineRow = {
  id: string;
  modelId: string;
  modelLabel: string;
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
};

export async function listDetail(listId: string) {
  const list = await prisma.packingList.findUnique({
    where: { id: listId },
    include: {
      project: { include: { client: { select: { name: true } } } },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          model: { select: { id: true, manufacturer: true, name: true, trackingType: true, categoryId: true, weightKg: true, powerDrawW: true } },
          item: { select: { id: true, assetTag: true, name: true, isKit: true, contents: { include: { model: { select: { manufacturer: true, name: true, weightKg: true, powerDrawW: true } } } } } },
          caseItem: { select: { id: true, assetTag: true, name: true } },
          checks: { orderBy: { checkedAt: "asc" }, include: { item: { select: { assetTag: true, name: true } }, checkedBy: { select: { name: true } } } },
        },
      },
    },
  });
  if (!list) return null;
  const cats = await prisma.category.findMany({ select: { id: true, name: true, parentId: true } });
  const packedUnitIds = new Set(list.lines.flatMap((l) => l.checks.filter((c) => c.phase === "out" && c.itemId).map((c) => c.itemId!)));

  const lines: LineRow[] = [];
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
      returned: c.phase === "out" ? l.checks.filter((x) => x.phase === "in" && x.itemId === c.itemId).reduce((s, x) => s + x.quantity, 0) : 0,
    }));
    const progress = lineProgress({ quantity: l.quantity, trackingType: tracking, checks });
    const availableUnits =
      tracking === "serialized" && list.status === "draft" && !l.itemId
        ? (await prisma.item.findMany({ where: { modelId: l.modelId, status: "in_house", parentItemId: null, isKit: false }, orderBy: { assetTag: "asc" }, select: { id: true, assetTag: true, serialNumber: true } })).filter((u) => !packedUnitIds.has(u.id))
        : [];
    const bins =
      tracking === "bulk" && list.status === "draft"
        ? (await prisma.item.findMany({ where: { modelId: l.modelId, status: "in_house", parentItemId: null }, orderBy: { quantity: "desc" }, include: { location: { select: { name: true } } } })).map((b) => ({ id: b.id, assetTag: b.assetTag, quantity: b.quantity, locationName: b.location?.name ?? null }))
        : [];
    const path = pathNames(cats, l.model.categoryId);
    lines.push({
      id: l.id,
      modelId: l.modelId,
      modelLabel: `${l.model.manufacturer} ${l.model.name}`,
      trackingType: tracking,
      categoryPath: path,
      categoryTop: path[0] ?? "",
      quantity: l.quantity,
      note: l.note,
      itemId: l.itemId,
      itemTag: l.item?.assetTag ?? null,
      itemName: l.item?.name ?? null,
      isKit: l.item?.isKit ?? false,
      kitContents: (l.item?.contents ?? []).map((c) => ({ id: c.id, assetTag: c.assetTag, label: `${c.model.manufacturer} ${c.model.name}`, quantity: c.quantity })),
      caseItemId: l.caseItemId,
      caseLabel: l.caseItem ? (l.caseItem.name ?? l.caseItem.assetTag) : null,
      weightKg: num(l.model.weightKg),
      powerDrawW: l.model.powerDrawW,
      progress,
      checks,
      availableUnits,
      bins,
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
    progress: listProgress(lines),
    totals,
  };
}

export type ListDetail = NonNullable<Awaited<ReturnType<typeof listDetail>>>;

/** Lines grouped for display. */
export function groupLines(lines: LineRow[], groupBy: "category" | "case"): { key: string; label: string; lines: LineRow[] }[] {
  const groups = new Map<string, { key: string; label: string; lines: LineRow[] }>();
  for (const l of lines) {
    const key = groupBy === "case" ? (l.caseItemId ?? "__loose__") : l.categoryTop || "__other__";
    const label = groupBy === "case" ? (l.caseLabel ?? "Loose") : l.categoryTop || "Other";
    const g = groups.get(key) ?? { key, label, lines: [] };
    g.lines.push(l);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => (a.key === "__loose__" || a.key === "__other__" ? 1 : b.key === "__loose__" || b.key === "__other__" ? -1 : a.label.localeCompare(b.label)));
}

export async function listsForProject(projectId: string) {
  const rows = await prisma.packingList.findMany({ where: { projectId }, orderBy: { createdAt: "asc" }, include: { lines: { include: { model: { select: { trackingType: true } }, checks: true } } } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status as PackingStatus,
    lineCount: r.lines.length,
    progress: listProgress(r.lines.map((l) => ({ quantity: l.quantity, trackingType: l.model.trackingType === "bulk" ? "bulk" : "serialized", checks: l.checks.map((c) => ({ phase: c.phase as "out" | "in", quantity: c.quantity, outcome: c.outcome })) }))),
    checkedOutAt: r.checkedOutAt,
    checkedInAt: r.checkedInAt,
  }));
}

export async function kitOptions() {
  const rows = await prisma.item.findMany({ where: { isKit: true, status: "in_house" }, orderBy: { name: "asc" }, include: { model: { select: { manufacturer: true, name: true } }, _count: { select: { contents: true } } } });
  return rows.map((k) => ({ id: k.id, label: `${k.name ?? k.assetTag} (${k._count.contents} items, ${k.model.manufacturer} ${k.model.name})` }));
}

export async function templateOptions() {
  return prisma.packingTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, _count: { select: { lines: true } } } });
}

export async function templateDetail(id: string) {
  const t = await prisma.packingTemplate.findUnique({ where: { id }, include: { lines: { orderBy: { sortOrder: "asc" }, include: { model: { select: { id: true, manufacturer: true, name: true, trackingType: true } } } } } });
  if (!t) return null;
  return { ...t, lines: t.lines.map((l) => ({ id: l.id, modelId: l.modelId, modelLabel: `${l.model.manufacturer} ${l.model.name}`, quantity: l.quantity, note: l.note })) };
}

export async function otherListsForCopy(projectId: string) {
  const rows = await prisma.packingList.findMany({ where: { projectId: { not: projectId } }, orderBy: { createdAt: "desc" }, take: 30, include: { project: { select: { name: true } }, _count: { select: { lines: true } } } });
  return rows.map((r) => ({ id: r.id, label: `${r.project.name} – ${r.name} (${r._count.lines} lines)` }));
}
