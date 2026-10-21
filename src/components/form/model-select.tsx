"use client";

import { useMemo } from "react";
import { NativeSelect } from "@/components/form/native-select";
import { familyLabel, makersOf, modelLabel, modelLabelWithMaker } from "@/lib/format";
import { compareVariants } from "@/lib/variant";

export type ModelChoice = { id: string; manufacturer: string; name: string; variant?: string | null; trackingType?: string };

/**
 * A model dropdown that keeps families together: models that share a
 * name become an <optgroup> with one option per variant
 * ("50 cm", "70 cm"), so 47 rod lengths read as four groups. Models
 * without siblings stay plain options.
 */
export function ModelSelect({ models, trackingLabels, ...props }: { models: ModelChoice[]; trackingLabels?: Record<string, string> } & Omit<React.ComponentProps<"select">, "children">) {
  const groups = useMemo(() => {
    const byFamily = new Map<string, ModelChoice[]>();
    for (const m of models) {
      const key = familyLabel(m).toLowerCase();
      byFamily.set(key, [...(byFamily.get(key) ?? []), m]);
    }
    return [...byFamily.values()].map((list) => {
      const makers = makersOf(list);
      return { key: familyLabel(list[0]).toLowerCase(), label: makers ? `${familyLabel(list[0])} (${makers})` : familyLabel(list[0]), models: [...list].sort((a, b) => compareVariants(a.variant, b.variant)) };
    });
  }, [models]);
  const suffix = (m: ModelChoice) => (trackingLabels && m.trackingType ? ` (${trackingLabels[m.trackingType] ?? m.trackingType})` : "");
  return (
    <NativeSelect {...props}>
      <option value="">—</option>
      {groups.map((g) =>
        g.models.length > 1 ? (
          <optgroup key={g.key} label={g.label}>
            {g.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.variant ?? modelLabel(m)}
                {suffix(m)}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={g.models[0].id} value={g.models[0].id}>
            {modelLabelWithMaker(g.models[0])}
            {suffix(g.models[0])}
          </option>
        ),
      )}
    </NativeSelect>
  );
}
