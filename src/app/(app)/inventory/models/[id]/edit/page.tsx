import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { categoryOptions, modelDetail } from "@/modules/inventory";
import { ModelForm } from "@/modules/inventory/components/model-form";
import { customFieldDefinitions } from "@/modules/settings";
import { modelLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Edit model" };

export default async function EditModelPage(props: { params: Promise<{ id: string }> }) {
  await requirePermission("inventory.write");
  const { id } = await props.params;
  const t = await getTranslations("inventory");
  const [detail, cats, defs] = await Promise.all([modelDetail(id), categoryOptions(), customFieldDefinitions.forEntity("model")]);
  if (!detail) notFound();
  const label = `${modelLabel(detail.model)}`;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("editModel")}
        crumbs={[{ label: t("title"), href: "/inventory" }, { label, href: `/inventory/models/${id}` }, { label: t("editModel") }]}
      />
      <ModelForm model={detail.model} categories={cats} defs={defs} hasItems={detail.items.length > 0} />
    </div>
  );
}
