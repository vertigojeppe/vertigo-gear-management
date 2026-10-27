import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { can, requireActor } from "@/lib/auth/session";
import { planTemplateDetail } from "@/modules/plans";
import { DeletePlanTemplateButton, PlanTemplateDialog, RemoveTemplateEntryButton, TemplateEntryDialog } from "@/modules/plans/components/template-forms";

export const metadata: Metadata = { title: "Plan template" };

export default async function PlanTemplatePage(props: { params: Promise<{ templateId: string }> }) {
  const actor = await requireActor();
  const { templateId } = await props.params;
  const t = await getTranslations("plans");
  const tp = await getTranslations("projects");
  const tph = await getTranslations("planPhase");
  const tk = await getTranslations("logisticsKind");
  const tpl = await planTemplateDetail(templateId);
  if (!tpl) notFound();
  const canEdit = can(actor.role, "plans.write");
  const dayLabel = (n: number) => (n === 0 ? t("anchorDay") : n > 0 ? `+${n}` : String(n));
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={tpl.name}
        subtitle={tpl.description ?? t("templateEntryHelp")}
        crumbs={[{ label: tp("title"), href: "/projects" }, { label: t("templates"), href: "/projects/plan-templates" }, { label: tpl.name }]}
        actions={
          canEdit && (
            <>
              <TemplateEntryDialog templateId={tpl.id} />
              <PlanTemplateDialog trigger="edit" template={tpl} />
              <DeletePlanTemplateButton id={tpl.id} />
            </>
          )
        }
      />
      {tpl.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("templateEntries", { count: 0 })}</p>
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {tpl.entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-16 shrink-0 font-mono text-xs">{dayLabel(e.dayOffset)}</span>
              <span className="w-12 shrink-0 font-mono text-xs">{e.time ?? ""}</span>
              <StatusPill color={e.kind === "schedule" ? "blue" : e.kind === "task" ? "amber" : "gray"} className="shrink-0">
                {e.kind === "task" ? tph(e.phase as "build") : e.kind === "logistics" ? tk(e.logisticsKind as "vehicle") : t("kind_schedule")}
              </StatusPill>
              <span className="min-w-0 flex-1">
                {e.title}
                {e.durationMin ? <span className="text-muted-foreground"> · {e.durationMin} min</span> : null}
                {e.location ? <span className="text-muted-foreground"> · {e.location}</span> : null}
                {e.notes ? <span className="block text-xs text-muted-foreground">{e.notes}</span> : null}
              </span>
              {canEdit && (
                <span className="flex shrink-0 items-center gap-1">
                  <TemplateEntryDialog templateId={tpl.id} entry={e} />
                  <RemoveTemplateEntryButton templateId={tpl.id} id={e.id} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
