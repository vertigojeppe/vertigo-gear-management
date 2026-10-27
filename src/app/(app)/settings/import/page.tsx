import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { ImportUploadForm } from "@/modules/importer/components/import-upload-form";

export const metadata: Metadata = { title: "Import spreadsheet" };

export default async function ImportPage() {
  await requirePermission("settings.manage");
  const t = await getTranslations("importer");
  const ts = await getTranslations("settings");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} crumbs={[{ label: ts("title"), href: "/settings" }, { label: t("title") }]} />
      <ImportUploadForm />
      <div className="max-w-xl rounded-md border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{t("howTitle")}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>{t("how1")}</li>
          <li>{t("how2")}</li>
          <li>{t("how3")}</li>
          <li>{t("how4")}</li>
        </ol>
      </div>
      <p className="max-w-xl text-sm text-muted-foreground">
        {t("specsHint")}{" "}
        <Link href="/settings/import/specs" className="font-medium text-foreground underline">
          {t("specsLink")}
        </Link>
      </p>
    </div>
  );
}
