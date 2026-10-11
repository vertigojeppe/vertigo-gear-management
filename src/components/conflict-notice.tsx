"use client";

import { useTranslations } from "next-intl";
import type { AllocationLike } from "@/modules/projects";

/** Explains why a reservation does not fit and who holds the gear. */
export function ConflictNotice({ conflict }: { conflict: { available: number; requested: number; shortfall: number; conflicts: AllocationLike[] } }) {
  const t = useTranslations("projects");
  return (
    <div role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <p className="font-medium">{t("conflictTitle")}</p>
      <p className="text-muted-foreground">{t("conflictBody", { available: Math.max(0, conflict.available), requested: conflict.requested, shortfall: conflict.shortfall })}</p>
      {conflict.conflicts.length > 0 && (
        <ul className="mt-2 list-disc pl-5">
          {conflict.conflicts.map((c) => (
            <li key={c.id}>
              {c.quantity}× {c.holderName} ({c.startDate} – {c.endDate})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
