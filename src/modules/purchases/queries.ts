import { prisma } from "@/lib/db";
import { modelLabel } from "@/lib/format";

export type PurchaseRow = {
  id: string;
  modelId: string;
  modelLabel: string;
  supplierContactId: string | null;
  supplierName: string | null;
  /** YYYY-MM-DD */
  date: string | null;
  reference: string | null;
  quantity: number;
  listPrice: number | null;
  discountPct: number | null;
  netPrice: number | null;
  /** quantity × net price per unit, when known. */
  total: number | null;
  notes: string | null;
  attachments: number;
  createdByName: string | null;
  createdAt: Date;
};

const include = {
  model: { select: { manufacturer: true, name: true, variant: true } },
  supplier: { select: { name: true, organisation: true } },
  createdBy: { select: { name: true } },
} as const;

type Row = Awaited<ReturnType<typeof prisma.purchase.findMany<{ include: typeof include }>>>[number];

function toRow(p: Row, attachments: number): PurchaseRow {
  const net = p.netPrice === null ? null : Number(p.netPrice);
  return {
    id: p.id,
    modelId: p.modelId,
    modelLabel: modelLabel(p.model),
    supplierContactId: p.supplierContactId,
    supplierName: p.supplier ? (p.supplier.organisation ? `${p.supplier.name} (${p.supplier.organisation})` : p.supplier.name) : null,
    date: p.date ? p.date.toISOString().slice(0, 10) : null,
    reference: p.reference,
    quantity: p.quantity,
    listPrice: p.listPrice === null ? null : Number(p.listPrice),
    discountPct: p.discountPct === null ? null : Number(p.discountPct),
    netPrice: net,
    total: net === null ? null : Math.round(net * p.quantity * 100) / 100,
    notes: p.notes,
    attachments,
    createdByName: p.createdBy?.name ?? null,
    createdAt: p.createdAt,
  };
}

async function attachmentCounts(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.attachment.groupBy({ by: ["entityId"], where: { entityType: "purchase", entityId: { in: ids } }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.entityId, r._count._all]));
}

/** Newest first; the caller checks `inventory.finance`. */
export async function purchasesForModel(modelId: string): Promise<PurchaseRow[]> {
  const rows = await prisma.purchase.findMany({ where: { modelId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], include });
  const counts = await attachmentCounts(rows.map((r) => r.id));
  return rows.map((r) => toRow(r, counts.get(r.id) ?? 0));
}

/** Every record, for the CSV export. */
export async function purchaseList(): Promise<PurchaseRow[]> {
  const rows = await prisma.purchase.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }], include });
  const counts = await attachmentCounts(rows.map((r) => r.id));
  return rows.map((r) => toRow(r, counts.get(r.id) ?? 0));
}

export async function purchaseRow(id: string): Promise<PurchaseRow | null> {
  const p = await prisma.purchase.findUnique({ where: { id }, include });
  if (!p) return null;
  return toRow(p, (await attachmentCounts([id])).get(id) ?? 0);
}
