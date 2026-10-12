import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { DeleteRateTableButton, RateTableForm, rateTables } from "@/modules/pricing";

export const metadata: Metadata = { title: "Rate table" };

export default async function RateTablePage(props: { params: Promise<{ tableId: string }> }) {
  await requirePermission("settings.manage");
  const { tableId } = await props.params;
  const t = await getTranslations("pricing");
  const ts = await getTranslations("settings");
  const table = await rateTables.get(tableId);
  if (!table) notFound();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={table.name} subtitle={table.isDefault ? t("isDefault") : undefined} crumbs={[{ label: ts("title"), href: "/settings" }, { label: t("title"), href: "/settings/pricing" }, { label: table.name }]} actions={!table.isDefault && <DeleteRateTableButton id={table.id} />} />
      <RateTableForm table={table} />
    </div>
  );
}
