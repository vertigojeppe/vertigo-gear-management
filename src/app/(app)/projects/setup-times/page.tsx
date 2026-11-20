import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { can, requirePermission } from "@/lib/auth/session";
import { installationTypeList } from "@/modules/setup";
import { RuleSummary } from "@/modules/setup/components/rule-summary";
import { InstallationTypeDialog } from "@/modules/setup/components/setup-forms";

export const metadata: Metadata = { title: "Setup times" };

export default async function SetupTimesPage() {
  const actor = await requirePermission("projects.read");
  const t = await getTranslations("setup");
  const tp = await getTranslations("projects");
  const rows = await installationTypeList();
  const canEdit = can(actor.role, "projects.write");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("title")} subtitle={t("subtitle")} crumbs={[{ label: tp("title"), href: "/projects" }, { label: t("title") }]} actions={canEdit && <InstallationTypeDialog />} />
      {rows.length === 0 ? (
        <EmptyState title={t("noTypes")} body={t("noTypesBody")} action={canEdit && <InstallationTypeDialog />} />
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/projects/setup-times/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-muted/50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block text-xs">
                    <RuleSummary type={r} />
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{t("recordCount", { count: r.records })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
