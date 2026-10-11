import { getTranslations } from "next-intl/server";
import { formatDateTime } from "@/lib/format";

type Row = { id: string; summary: string; createdAt: Date; user: { name: string } | null };

/** Compact activity feed used on item, model and dashboard pages. */
export async function ActivityList({ rows }: { rows: Row[] }) {
  const t = await getTranslations("common");
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("noActivity")}</p>;
  return (
    <ul className="divide-y text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <span className="min-w-0">{r.summary}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDateTime(r.createdAt)}
            {r.user ? ` · ${r.user.name}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
