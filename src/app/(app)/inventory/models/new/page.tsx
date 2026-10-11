import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { ModelForm, categoryOptions } from "@/modules/inventory";
import { customFieldDefinitions } from "@/modules/settings";

export const metadata: Metadata = { title: "New model" };

export default async function NewModelPage(props: { searchParams: Promise<{ categoryId?: string }> }) {
  await requirePermission("inventory.write");
  const { categoryId } = await props.searchParams;
  const t = await getTranslations("inventory");
  const [cats, defs] = await Promise.all([categoryOptions(), customFieldDefinitions.forEntity("model")]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("newModel")} crumbs={[{ label: t("title"), href: "/inventory" }, { label: t("newModel") }]} />
      <ModelForm categories={cats} defs={defs} defaultCategoryId={categoryId} />
    </div>
  );
}
