import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { can, requirePermission } from "@/lib/auth/session";
import { locationOptions, modelOptions } from "@/modules/inventory";
import { ItemForm } from "@/modules/inventory/components/item-form";
import { customFieldDefinitions } from "@/modules/settings";

export const metadata: Metadata = { title: "Add items" };

export default async function NewItemPage(props: { searchParams: Promise<{ modelId?: string }> }) {
  const actor = await requirePermission("inventory.write");
  const { modelId } = await props.searchParams;
  const t = await getTranslations("inventory");
  const [models, locs, defs] = await Promise.all([modelOptions(), locationOptions(), customFieldDefinitions.forEntity("item")]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("newItem")} crumbs={[{ label: t("title"), href: "/inventory" }, { label: t("items"), href: "/inventory/items" }, { label: t("newItem") }]} />
      <ItemForm models={models} locations={locs} defs={defs} defaultModelId={modelId} canSeeFinance={can(actor.role, "inventory.finance")} />
    </div>
  );
}
