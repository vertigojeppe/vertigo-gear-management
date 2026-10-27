import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { can, requireActor } from "@/lib/auth/session";
import { gearCatalog, templateDetail } from "@/modules/packing";
import { DeleteTemplateButton, RemoveTemplateLineButton, TemplateDialog } from "@/modules/packing/components/template-forms";
import { GearPicker } from "@/modules/packing/components/gear-picker";
import { glossary } from "@/modules/settings";

export const metadata: Metadata = { title: "Packing template" };

export default async function TemplatePage(props: { params: Promise<{ templateId: string }> }) {
  const actor = await requireActor();
  const { templateId } = await props.params;
  const t = await getTranslations("packing");
  const tp = await getTranslations("projects");
  const [tpl, catalog] = await Promise.all([templateDetail(templateId), gearCatalog({ templateId })]);
  if (!tpl) notFound();
  const canEdit = can(actor.role, "packing.write");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={tpl.name}
        subtitle={tpl.description ?? undefined}
        crumbs={[{ label: tp("title"), href: "/projects" }, { label: t("templates"), href: "/projects/packing-templates" }, { label: tpl.name }]}
        actions={
          canEdit && (
            <>
              <TemplateDialog trigger="edit" template={tpl} />
              <DeleteTemplateButton id={tpl.id} />
            </>
          )
        }
      />
      {tpl.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("templateLines", { count: 0 })}</p>
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {tpl.lines.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-10 font-medium">{l.quantity}×</span>
              <span className="min-w-0 flex-1">
                {l.modelLabel}
                {l.note ? <span className="text-muted-foreground"> · {l.note}</span> : null}
              </span>
              {canEdit && <RemoveTemplateLineButton templateId={tpl.id} lineId={l.id} />}
            </li>
          ))}
        </ul>
      )}
      {canEdit && <GearPicker target={{ kind: "template", templateId: tpl.id }} catalog={catalog} glossaryGroups={await glossary.groups()} />}
    </div>
  );
}
