import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/format";
import { groupLines, listDetail, shareLinks } from "@/modules/packing";
import { appConfig } from "../../../../../config/app.config";

export const metadata: Metadata = { title: "Packing list" };

/**
 * Public, read-only packing list for a share link. No login; the token is
 * the only credential. Shows lines, quantities, packed tags and totals.
 */
export default async function SharedPackingListPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const link = await shareLinks.resolve(token);
  if (!link || link.targetType !== "packing_list") notFound();
  const detail = await listDetail(link.targetId);
  if (!detail) notFound();
  const t = await getTranslations("packing");
  const { list, project, lines, totals, progress } = detail;
  const groups = groupLines(lines, list.groupBy);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <p className="text-xs text-muted-foreground">
        {appConfig.name} · {t("sharedView")}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{list.name}</h1>
      <p className="text-sm text-muted-foreground">
        {[project.name, project.clientName, project.venueName, project.reserveFrom ? `${formatDate(project.reserveFrom)} – ${formatDate(project.reserveTo ?? project.reserveFrom)}` : null].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-1 text-sm">
        {t("totalsLine", { units: progress.units, cases: totals.cases, weight: totals.weightKg, power: totals.powerW })}
        {" · "}
        <a href={`/api/packing/${list.id}/list.pdf?share=${encodeURIComponent(token)}`} className="underline">
          {t("pdf")}
        </a>
      </p>
      {groups.map((g) => (
        <section key={g.key} className="mt-5">
          <h2 className="border-b pb-1 text-sm font-medium">{g.label}</h2>
          <ul className="divide-y text-sm">
            {g.lines.map((l) => (
              <li key={l.id} className="flex items-start gap-3 py-1.5">
                <span className="w-10 shrink-0 text-right font-medium">{l.quantity}×</span>
                <span className="min-w-0 flex-1">
                  {l.modelLabel}
                  {l.itemName ? ` – ${l.itemName}` : ""}
                  {l.note && l.note !== l.itemName ? <span className="text-muted-foreground"> ({l.note})</span> : null}
                  {l.isKit && l.kitContents.length > 0 && <span className="block text-xs text-muted-foreground">{l.kitContents.map((c) => `${c.quantity > 1 ? `${c.quantity}× ` : ""}${c.label}`).join(", ")}</span>}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{l.checks.filter((c) => c.phase === "out" && c.assetTag).map((c) => c.assetTag).join(", ") || l.itemTag || ""}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {list.notes && <p className="mt-6 whitespace-pre-line text-sm text-muted-foreground">{list.notes}</p>}
    </main>
  );
}
