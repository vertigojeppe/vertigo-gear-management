import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { RateTableForm } from "@/modules/pricing/components/rate-table-form";

export const metadata: Metadata = { title: "New rate table" };

export default async function NewRateTablePage() {
  await requirePermission("settings.manage");
  const t = await getTranslations("pricing");
  const ts = await getTranslations("settings");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("newTable")} crumbs={[{ label: ts("title"), href: "/settings" }, { label: t("title"), href: "/settings/pricing" }, { label: t("newTable") }]} />
      <RateTableForm />
    </div>
  );
}
