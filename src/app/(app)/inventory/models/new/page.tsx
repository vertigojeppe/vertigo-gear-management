import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { familyLabel } from "@/lib/format";
import { requirePermission } from "@/lib/auth/session";
import { ModelForm, categoryOptions, models } from "@/modules/inventory";
import { customFieldDefinitions } from "@/modules/settings";

export const metadata: Metadata = { title: "New model" };

export default async function NewModelPage(props: { searchParams: Promise<{ categoryId?: string; from?: string }> }) {
  await requirePermission("inventory.write");
  const { categoryId, from } = await props.searchParams;
  const t = await getTranslations("inventory");
  // ?from=<modelId>: a new variant of an existing family, everything prefilled but the size.
  const [cats, defs, prefill] = await Promise.all([categoryOptions(), customFieldDefinitions.forEntity("model"), from ? models.get(from) : null]);
  const title = prefill ? t("newVariantOf", { name: familyLabel(prefill) }) : t("newModel");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} crumbs={[{ label: t("title"), href: "/inventory" }, { label: title }]} />
      <ModelForm categories={cats} defs={defs} defaultCategoryId={categoryId ?? prefill?.categoryId} prefill={prefill ?? undefined} />
    </div>
  );
}
