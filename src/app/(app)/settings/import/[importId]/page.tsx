import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { ImportError, ImportPreview, importer } from "@/modules/importer";

export const metadata: Metadata = { title: "Import preview" };

export default async function ImportPreviewPage(props: { params: Promise<{ importId: string }> }) {
  const actor = await requirePermission("settings.manage");
  const { importId } = await props.params;
  const t = await getTranslations("importer");
  const ts = await getTranslations("settings");
  const crumbs = [{ label: ts("title"), href: "/settings" }, { label: t("title"), href: "/settings/import" }, { label: t("previewTitle") }];

  const done = await importer.done(actor, importId).catch(() => null);
  if (done) {
    const r = done.result;
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("previewTitle")} subtitle={done.fileName} crumbs={crumbs} />
        <div className="rounded-md border border-green-600/30 bg-green-600/10 p-4 text-sm" role="status">
          <p className="font-medium">{t("done")}</p>
          <p>{t("doneCounts", { categories: r.categories, models: r.models, units: r.units, bins: r.bins, kits: r.kits, contacts: r.contacts, locations: r.locations, rentals: r.rentals, rateTables: r.rateTables, wishes: r.wishes ?? 0 })}</p>
          {r.skipped.length > 0 && (
            <p className="mt-1 text-muted-foreground">
              {t("skipped")}: {r.skipped.join(", ")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/inventory" className={buttonVariants()}>
            {t("openInventory")}
          </Link>
          <Link href="/settings/import" className={buttonVariants({ variant: "outline" })}>
            {t("another")}
          </Link>
        </div>
      </div>
    );
  }

  let plan;
  try {
    plan = await importer.plan(actor, importId);
  } catch (err) {
    if (err instanceof ImportError) {
      return (
        <div className="flex flex-col gap-6">
          <PageHeader title={t("previewTitle")} crumbs={crumbs} />
          <p role="alert" className="text-sm text-destructive">
            {err.message}
          </p>
          <div>
            <Link href="/settings/import" className={buttonVariants({ variant: "outline" })}>
              {t("another")}
            </Link>
          </div>
        </div>
      );
    }
    throw err;
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("previewTitle")} subtitle={t("previewSubtitle", { rows: plan.rows.length })} crumbs={crumbs} />
      <ImportPreview id={importId} rows={plan.rows} counts={plan.counts} fileName={plan.fileName} />
    </div>
  );
}
