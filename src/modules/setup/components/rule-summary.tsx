import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import type { InstallationTypeRow } from "../queries";

/** "3 h + 30 min per projector, with 3 people", or a hint that no rule is set. */
export function RuleSummary({ type }: { type: InstallationTypeRow }) {
  const t = useTranslations("setup");
  const parts = [
    type.baseHours !== null ? t("ruleBase", { hours: formatNumber(type.baseHours, 2) }) : null,
    type.minutesPerUnit !== null ? t("rulePerUnit", { minutes: formatNumber(type.minutesPerUnit, 2), unit: type.unitName || t("unit") }) : null,
  ].filter(Boolean);
  if (parts.length === 0) return <span className="text-muted-foreground">{t("noRule")}</span>;
  return (
    <span>
      {parts.join(" + ")}
      {type.ruleCrew ? `, ${t("ruleCrew", { count: type.ruleCrew })}` : ""}
    </span>
  );
}
