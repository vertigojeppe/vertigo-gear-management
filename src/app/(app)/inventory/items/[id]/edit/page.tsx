import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { can, requirePermission } from "@/lib/auth/session";
import { items, locationOptions, modelOptions } from "@/modules/inventory";
import { ItemForm } from "@/modules/inventory/components/item-form";
import { customFieldDefinitions } from "@/modules/settings";

export const metadata: Metadata = { title: "Edit item" };

export default async function EditItemPage(props: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("inventory.write");
  const { id } = await props.params;
  const t = await getTranslations("inventory");
  const [item, models, locs, defs] = await Promise.all([items.get(id), modelOptions(), locationOptions(), customFieldDefinitions.forEntity("item")]);
  if (!item) notFound();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("editItem")}
        crumbs={[{ label: t("title"), href: "/inventory" }, { label: item.assetTag, href: `/inventory/items/${id}` }, { label: t("editItem") }]}
      />
      <ItemForm item={item} models={models} locations={locs} defs={defs} canSeeFinance={can(actor.role, "inventory.finance")} />
    </div>
  );
}
