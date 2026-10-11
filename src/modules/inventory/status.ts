import { ITEM_STATUSES, itemStatus, type ItemStatus } from "../../../config/app.config";

/**
 * Pure rules for manual status changes. Flow-driven changes (check-out,
 * check-in, rentals) call the same validation with `viaFlow = true`.
 */
export type StatusChangeProblem = "unknown_status" | "same_status" | "reason_required" | "not_manual";

export function validateStatusChange(
  from: string,
  to: string,
  reason: string | undefined,
  opts: { viaFlow?: boolean } = {},
): StatusChangeProblem | null {
  const target = itemStatus(to);
  if (!target) return "unknown_status";
  if (from === to) return "same_status";
  if (!opts.viaFlow && !target.manual) return "not_manual";
  if (target.reasonRequired && !(reason && reason.trim().length > 0)) return "reason_required";
  return null;
}

export function isAvailableStatus(status: string): boolean {
  return itemStatus(status)?.available ?? false;
}

export function manualStatuses(): ItemStatus[] {
  return ITEM_STATUSES.filter((s) => s.manual).map((s) => s.key);
}
