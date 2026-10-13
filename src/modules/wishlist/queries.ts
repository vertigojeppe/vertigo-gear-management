import { prisma } from "@/lib/db";
import type { WishStatus } from "./schema";

export type WishRow = {
  id: string;
  manufacturer: string;
  name: string;
  variant: string | null;
  categoryId: string | null;
  categoryName: string | null;
  quantity: number;
  price: number | null;
  rentalDayPrice: number | null;
  link: string | null;
  notes: string | null;
  status: string;
  modelId: string | null;
  modelLabel: string | null;
  createdByName: string | null;
  createdAt: Date;
};

/** Open wishes first (newest on top), bought ones when asked for. */
export async function wishList(status: WishStatus | "all" = "open"): Promise<WishRow[]> {
  const rows = await prisma.wishItem.findMany({
    where: status === "all" ? undefined : { status },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { category: { select: { name: true } }, model: { select: { manufacturer: true, name: true, variant: true } }, createdBy: { select: { name: true } } },
  });
  return rows.map((w) => ({
    id: w.id,
    manufacturer: w.manufacturer,
    name: w.name,
    variant: w.variant,
    categoryId: w.categoryId,
    categoryName: w.category?.name ?? null,
    quantity: w.quantity,
    price: w.price === null ? null : Number(w.price),
    rentalDayPrice: w.rentalDayPrice === null ? null : Number(w.rentalDayPrice),
    link: w.link,
    notes: w.notes,
    status: w.status,
    modelId: w.modelId,
    modelLabel: w.model ? [w.model.manufacturer, w.model.name, w.model.variant].filter(Boolean).join(" ") : null,
    createdByName: w.createdBy?.name ?? null,
    createdAt: w.createdAt,
  }));
}

export async function wishCounts(): Promise<{ open: number; bought: number }> {
  const [open, bought] = await Promise.all([prisma.wishItem.count({ where: { status: "open" } }), prisma.wishItem.count({ where: { status: "bought" } })]);
  return { open, bought };
}
