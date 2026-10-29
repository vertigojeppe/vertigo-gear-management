"use client";

import { useTranslations } from "next-intl";
import { StatusPill } from "@/components/status-pill";
import { pickable, pickKey, type SpecChange } from "../specs";

function changeLabel(c: SpecChange, ticked: boolean) {
  if (c.action === "fill") return ticked ? { key: "action_fill", color: "green" } : { key: "action_skip", color: "gray" };
  if (c.action === "keep") return ticked ? { key: "action_replace", color: "amber" } : { key: "action_keep", color: "gray" };
  return { key: `action_${c.action}`, color: "gray" };
}

/**
 * One model's planned changes with a checkbox each (`name="pick"`, value
 * `pickKey`): fills start ticked, kept values unticked. `evidence` adds the
 * document's own words under a value (spec lookup).
 */
export function SpecChangeTable({ modelId, modelLabel, changes, picked, onToggle, evidence }: { modelId: string; modelLabel: string; changes: SpecChange[]; picked: Set<string>; onToggle: (key: string, on: boolean) => void; evidence?: Record<string, string> }) {
  const t = useTranslations("specImport");
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <tbody>
          {changes.map((c) => {
            const key = pickKey(modelId, c.field);
            const ticked = picked.has(key);
            const label = changeLabel(c, ticked);
            const quote = evidence?.[c.field];
            return (
              <tr key={c.field} className="align-top">
                <td className="w-6 py-0.5">
                  {pickable(c.action) && <input type="checkbox" name="pick" value={key} checked={ticked} onChange={(e) => onToggle(key, e.target.checked)} aria-label={`${c.label ?? t(`field_${c.field}`)}: ${modelLabel}`} className="mt-0.5" />}
                </td>
                <td className="w-32 py-0.5 pr-2 text-muted-foreground">{c.label ?? t(`field_${c.field}`)}</td>
                <td className="w-28 py-0.5 pr-2">
                  <StatusPill color={label.color}>{t(label.key)}</StatusPill>
                </td>
                <td className="whitespace-pre-line py-0.5">
                  {c.action === "keep" ? (
                    <>
                      <span className={ticked ? "line-through text-muted-foreground" : ""}>{c.from}</span> <span className={ticked ? "" : "text-muted-foreground"}>({t("sheetSays", { value: c.to })})</span>
                    </>
                  ) : (
                    <span className={c.action === "fill" && !ticked ? "text-muted-foreground" : ""}>{c.to}</span>
                  )}
                  {quote && <span className="block text-muted-foreground italic">“{quote}”</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
