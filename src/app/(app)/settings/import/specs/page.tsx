import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { SpecImport } from "@/modules/importer/components/spec-import";

export const metadata: Metadata = { title: "Import specs" };

export default async function SpecImportPage() {
  await requirePermission("settings.manage");
  const t = await getTranslations("specImport");
  const ts = await getTranslations("settings");
  const ti = await getTranslations("importer");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} crumbs={[{ label: ts("title"), href: "/settings" }, { label: ti("title"), href: "/settings/import" }, { label: t("title") }]} />
      <SpecImport />
      <div className="max-w-xl rounded-md border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{t("howTitle")}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>{t("how1")}</li>
          <li>{t("how2")}</li>
          <li>{t("how3")}</li>
        </ol>
      </div>
    </div>
  );
}
