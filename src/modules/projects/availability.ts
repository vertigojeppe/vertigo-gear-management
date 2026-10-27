import { itemStatus } from "../../../config/app.config";
import { rangesOverlap, type DateString } from "@/lib/dates";

/**
 * Pure availability engine. Everything that answers "is it free?" goes
 * through computeAvailability so projects, rentals, the calendar and the
 * dashboard agree. Dates are inclusive YYYY-MM-DD strings.
 */

export type ItemLike = { id: string; quantity: number; status: string; /** Own projects only; a rental can never have it. */ notForRental?: boolean };

export type AllocationLike = {
  id: string;
  holderType: "project" | "rental";
  holderId: string;
  holderName: string;
  modelId: string;
  quantity: number;
  itemId: string | null;
  startDate: DateString;
  endDate: DateString;
};

export type Window = { from: DateString; to: DateString };

export type Exclude = { allocationId?: string; holderType?: "project" | "rental"; holderId?: string };

/** `forRental`: units flagged not-for-rental are left out of `owned` (they count as `notRentable` instead). */
export type Options = { forRental?: boolean };

export type Availability = {
  /** Units owned (everything not retired). */
  owned: number;
  /** Units out of service for the whole window (in repair, missing). */
  unavailable: number;
  /** Units reserved by other holders in the window. */
  allocated: number;
  /** owned - unavailable - allocated; can be negative when over-booked. */
  available: number;
  /** Units left out because the request is for a rental and they are own-projects-only (0 otherwise). */
  notRentable: number;
  /** The overlapping allocations that count towards `allocated`. */
  conflicts: AllocationLike[];
};

export function isExcluded(a: AllocationLike, exclude?: Exclude): boolean {
  if (!exclude) return false;
  if (exclude.allocationId && a.id === exclude.allocationId) return true;
  if (exclude.holderType && exclude.holderId && a.holderType === exclude.holderType && a.holderId === exclude.holderId) return true;
  return false;
}

export function computeAvailability(items: ItemLike[], allocations: AllocationLike[], window: Window, exclude?: Exclude, options: Options = {}): Availability {
  let owned = 0;
  let unavailable = 0;
  let notRentable = 0;
  for (const i of items) {
    if (i.status === "retired") continue;
    if (options.forRental && i.notForRental) {
      notRentable += i.quantity;
      continue;
    }
    owned += i.quantity;
    if (!(itemStatus(i.status)?.available ?? false)) unavailable += i.quantity;
  }
  const conflicts = allocations.filter((a) => !isExcluded(a, exclude) && rangesOverlap(a.startDate, a.endDate, window.from, window.to));
  const allocated = conflicts.reduce((sum, a) => sum + a.quantity, 0);
  return { owned, unavailable, allocated, available: owned - unavailable - allocated, notRentable, conflicts };
}

/**
 * Result of asking for `quantity` units in a window.
 * `shortfall` > 0 means the request cannot be fully covered.
 */
export function checkRequest(items: ItemLike[], allocations: AllocationLike[], window: Window, quantity: number, exclude?: Exclude, options?: Options) {
  const availability = computeAvailability(items, allocations, window, exclude, options);
  const shortfall = Math.max(0, quantity - availability.available);
  return { ...availability, requested: quantity, shortfall, ok: shortfall === 0 };
}

/** Pairs of overlapping allocations that name the same specific unit. */
export function unitDoubleBookings(allocations: AllocationLike[]): [AllocationLike, AllocationLike][] {
  const out: [AllocationLike, AllocationLike][] = [];
  const byItem = new Map<string, AllocationLike[]>();
  for (const a of allocations) {
    if (!a.itemId) continue;
    const list = byItem.get(a.itemId) ?? [];
    list.push(a);
    byItem.set(a.itemId, list);
  }
  for (const list of byItem.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (rangesOverlap(list[i].startDate, list[i].endDate, list[j].startDate, list[j].endDate)) out.push([list[i], list[j]]);
      }
    }
  }
  return out;
}

/**
 * Days inside `window` where demand exceeds supply, with the peak shortfall.
 * Used by the calendar to flag over-booked models.
 */
export function overbookedDays(items: ItemLike[], allocations: AllocationLike[], window: Window): { day: DateString; shortfall: number }[] {
  const out: { day: DateString; shortfall: number }[] = [];
  const supply = computeAvailability(items, [], window).available;
  const inWindow = allocations.filter((a) => rangesOverlap(a.startDate, a.endDate, window.from, window.to));
  const cursor = new Date(`${window.from}T00:00:00Z`);
  const end = new Date(`${window.to}T00:00:00Z`);
  while (cursor <= end) {
    const day = cursor.toISOString().slice(0, 10);
    const demand = inWindow.filter((a) => a.startDate <= day && a.endDate >= day).reduce((s, a) => s + a.quantity, 0);
    if (demand > supply) out.push({ day, shortfall: demand - supply });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
