import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { can, requirePermission } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { installationTypeDetail } from "@/modules/setup";
import { RuleSummary } from "@/modules/setup/components/rule-summary";
import { DeleteInstallationTypeButton, InstallationTypeDialog, RemoveSetupRecordButton, SetupRecordDialog } from "@/modules/setup/components/setup-forms";

export const metadata: Metadata = { title: "Setup times" };

export default async function InstallationTypePage(props: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("projects.read");
  const { id } = await props.params;
  const detail = await installationTypeDetail(id);
  if (!detail) notFound();
  const { type, records } = detail;
  const t = await getTranslations("setup");
  const tp = await getTranslations("projects");
  const canEdit = can(actor.role, "projects.write");
  const h = (n: number) => t("hoursShort", { hours: formatNumber(n, 1) });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={type.name}
        subtitle={type.description ?? undefined}
        crumbs={[{ label: tp("title"), href: "/projects" }, { label: t("title"), href: "/projects/setup-times" }, { label: type.name }]}
        actions={
          canEdit && (
            <>
              <SetupRecordDialog type={type} />
              <InstallationTypeDialog type={type} />
              {records.length === 0 && <DeleteInstallationTypeButton id={type.id} />}
            </>
          )
        }
      />

      <section className="flex flex-col gap-1 rounded-md border p-3 text-sm">
        <h2 className="font-medium">{t("rule")}</h2>
        <RuleSummary type={type} />
        {type.ruleNotes && <p className="whitespace-pre-line text-muted-foreground">{type.ruleNotes}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t("records")}</h2>
        {records.length === 0 ? (
          <EmptyState title={t("noRecords")} body={t("noRecordsBody")} action={canEdit && <SetupRecordDialog type={type} />} />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("period")}</th>
                  <th className="px-3 py-2 font-medium">{t("phase")}</th>
                  <th className="px-3 py-2 text-right font-medium">{type.unitName ? t("unitsOf", { unit: type.unitName }) : t("units")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("crew")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("took")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("ruleSays")}</th>
                  <th className="px-3 py-2 font-medium">{t("lesson")}</th>
                  {canEdit && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{r.period ?? "–"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{t(`phase_${r.phase}`)}</td>
                    <td className="px-3 py-2 text-right">{r.units ?? "–"}</td>
                    <td className="px-3 py-2 text-right">{r.crew ?? "–"}</td>
                    <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{h(r.hours)}</td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap ${r.estimate !== null && r.hours > r.estimate * 1.25 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{r.estimate === null ? "–" : h(r.estimate)}</td>
                    <td className="min-w-48 px-3 py-2">
                      {r.conditions.length > 0 && <span className="block text-xs text-muted-foreground">{r.conditions.map((c) => t(`condition_${c}`)).join(" · ")}</span>}
                      {r.lesson && <span className="whitespace-pre-line">{r.lesson}</span>}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <RemoveSetupRecordButton id={r.id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
