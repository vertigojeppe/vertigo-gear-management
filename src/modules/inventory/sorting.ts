import type { Prisma } from "@/generated/prisma/client";

/**
 * Sort orders for the inventory lists. Pure: the model list sorts families
 * after search and grouping (and before paging); the item list turns its
 * choice into a Prisma orderBy. Every order ends on the name (or asset tag)
 * so equal values stay in a stable, readable order.
 */

export const MODEL_SORTS = ["name", "category", "manufacturer", "units", "out", "packed", "newest", "price", "weight"] as const;
export type ModelSort = (typeof MODEL_SORTS)[number];

export const ITEM_SORTS = ["tag", "model", "location", "changed", "purchased"] as const;
export type ItemSort = (typeof ITEM_SORTS)[number];

/** What a family needs for every sort. `packed` is filled only when sorting by it (one extra query). */
export type SortableFamily = {
  name: string;
  manufacturer: string;
  categoryPath: string[];
  owned: number;
  inHouse: number;
  addedAt: Date;
  dayPrice: number | null;
  weightKg: number | null;
  packed: number;
};

const collator = new Intl.Collator("da", { sensitivity: "base", numeric: true });
const byName = (a: SortableFamily, b: SortableFamily) => collator.compare(a.name, b.name);
/** Largest first; families without a value last. */
const largest =
  (value: (f: SortableFamily) => number | null) =>
  (a: SortableFamily, b: SortableFamily) => {
    const x = value(a);
    const y = value(b);
    if (x === null && y === null) return byName(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x || byName(a, b);
  };

const COMPARE: Record<ModelSort, (a: SortableFamily, b: SortableFamily) => number> = {
  name: byName,
  category: (a, b) => collator.compare(a.categoryPath.join(" › "), b.categoryPath.join(" › ")) || byName(a, b),
  // Own-built gear without a manufacturer goes last.
  manufacturer: (a, b) => (a.manufacturer ? 0 : 1) - (b.manufacturer ? 0 : 1) || collator.compare(a.manufacturer, b.manufacturer) || byName(a, b),
  units: largest((f) => f.owned),
  out: largest((f) => f.owned - f.inHouse),
  packed: largest((f) => f.packed),
  newest: largest((f) => f.addedAt.getTime()),
  price: largest((f) => f.dayPrice),
  weight: largest((f) => f.weightKg),
};

export function sortFamilies<T extends SortableFamily>(families: T[], sort: ModelSort = "name"): T[] {
  return [...families].sort(COMPARE[sort]);
}

/** The item list's order. */
export function itemOrderBy(sort: ItemSort = "tag"): Prisma.ItemOrderByWithRelationInput[] {
  switch (sort) {
    case "model":
      return [{ model: { name: "asc" } }, { model: { variant: "asc" } }, { assetTag: "asc" }];
    case "location":
      return [{ location: { name: "asc" } }, { assetTag: "asc" }];
    case "changed":
      return [{ updatedAt: "desc" }, { assetTag: "asc" }];
    case "purchased":
      return [{ purchaseDate: { sort: "desc", nulls: "last" } }, { assetTag: "asc" }];
    default:
      return [{ assetTag: "asc" }];
  }
}
