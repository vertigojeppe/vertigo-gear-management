import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { can, requireActor } from "@/lib/auth/session";
import { planTemplateOptions } from "@/modules/plans";
import { PlanTemplateDialog } from "@/modules/plans/components/template-forms";

export const metadata: Metadata = { title: "Plan templates" };

export default async function PlanTemplatesPage() {
  const actor = await requireActor();
  const t = await getTranslations("plans");
  const tp = await getTranslations("projects");
  const rows = await planTemplateOptions();
  const canEdit = can(actor.role, "plans.write");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("templates")} subtitle={t("templatesHelp")} crumbs={[{ label: tp("title"), href: "/projects" }, { label: t("templates") }]} actions={canEdit && <PlanTemplateDialog trigger="new" />} />
      {rows.length === 0 ? (
        <EmptyState title={t("noTemplates")} body={t("noTemplatesBody")} action={canEdit && <PlanTemplateDialog trigger="new" />} />
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/projects/plan-templates/${r.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  {r.description && <span className="block truncate text-xs text-muted-foreground">{r.description}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{t("templateEntries", { count: r._count.entries })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
