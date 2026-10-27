import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { can, requireActor } from "@/lib/auth/session";
import { templateOptions } from "@/modules/packing";
import { TemplateDialog } from "@/modules/packing/components/template-forms";

export const metadata: Metadata = { title: "Packing templates" };

export default async function TemplatesPage() {
  const actor = await requireActor();
  const t = await getTranslations("packing");
  const tp = await getTranslations("projects");
  const rows = await templateOptions();
  const canEdit = can(actor.role, "packing.write");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("templates")} crumbs={[{ label: tp("title"), href: "/projects" }, { label: t("templates") }]} actions={canEdit && <TemplateDialog trigger="new" />} />
      {rows.length === 0 ? (
        <EmptyState title={t("noTemplates")} body={t("noTemplatesBody")} action={canEdit && <TemplateDialog trigger="new" />} />
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/projects/packing-templates/${r.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">{t("templateLines", { count: r._count.lines })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
