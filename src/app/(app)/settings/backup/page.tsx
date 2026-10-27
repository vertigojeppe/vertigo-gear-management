import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { TABLES } from "@/modules/backup";
import { RestoreForm } from "@/modules/backup/components/restore-form";

export const metadata: Metadata = { title: "Backup" };

export default async function BackupPage() {
  await requirePermission("users.manage");
  const t = await getTranslations("backup");
  const ts = await getTranslations("settings");
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} subtitle={t("subtitle")} crumbs={[{ label: ts("title"), href: "/settings" }, { label: t("title") }]} />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("download")}</h2>
        <p className="max-w-xl text-sm text-muted-foreground">{t("downloadHelp", { tables: TABLES.length })}</p>
        <div>
          <a href="/api/backup.json" className={buttonVariants()}>
            {t("downloadButton")}
          </a>
        </div>
        <p className="max-w-xl text-xs text-muted-foreground">{t("filesNote")}</p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("restore")}</h2>
        <RestoreForm />
      </section>
    </div>
  );
}
