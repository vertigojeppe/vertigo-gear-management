/**
 * Converting a model between serialized and bulk tracking once it has
 * items (admins, `models.convertTracking`). Pure: decides what happens to
 * each item, or why it cannot happen yet.
 *
 * Serialized → bulk: every unit that is in house and not packed in a case
 * merges into one bin, the one with the lowest asset tag, which keeps its
 * tag and history. The other merged units and their own data are deleted.
 * Units that are out, in repair, missing, retired or inside a case stay as
 * their own rows (quantity 1 is a valid bin).
 *
 * Bulk → serialized: every bin of more than one in house splits into units:
 * the bin becomes the first unit and the rest get new asset tags. A bin of
 * several that is not in house (out on a job, a rental) blocks it.
 */

export type TrackingUnit = { id: string; assetTag: string; status: string; quantity: number; isKit: boolean; contents: number; parentItemId: string | null };

export type ToBulkPlan = { to: "bulk"; keep: TrackingUnit | null; merge: TrackingUnit[]; stay: TrackingUnit[] };
export type ToSerializedPlan = { to: "serialized"; split: TrackingUnit[]; newUnits: number; stay: TrackingUnit[] };
export type TrackingPlan = ToBulkPlan | ToSerializedPlan | { to: "bulk" | "serialized"; blocked: string };

const byTag = (a: TrackingUnit, b: TrackingUnit) => a.assetTag.localeCompare(b.assetTag, "en", { numeric: true });

export function planTrackingChange(from: "serialized" | "bulk", units: TrackingUnit[]): TrackingPlan {
  if (from === "serialized") {
    const cases = units.filter((u) => u.isKit || u.contents > 0);
    if (cases.length) return { to: "bulk", blocked: `${cases.map((u) => u.assetTag).join(", ")} ${cases.length === 1 ? "is a case" : "are cases"} with contents; only loose units can become a bin.` };
    const mergeable = units.filter((u) => u.status === "in_house" && !u.parentItemId).sort(byTag);
    return { to: "bulk", keep: mergeable[0] ?? null, merge: mergeable.slice(1), stay: units.filter((u) => !mergeable.includes(u)).sort(byTag) };
  }
  const out = units.filter((u) => u.quantity > 1 && u.status !== "in_house");
  if (out.length) return { to: "serialized", blocked: `${out.map((u) => `${u.assetTag} (${u.quantity})`).join(", ")} ${out.length === 1 ? "is" : "are"} not in house; check ${out.length === 1 ? "it" : "them"} in first.` };
  const split = units.filter((u) => u.quantity > 1).sort(byTag);
  return { to: "serialized", split, newUnits: split.reduce((n, u) => n + u.quantity - 1, 0), stay: units.filter((u) => u.quantity <= 1).sort(byTag) };
}
