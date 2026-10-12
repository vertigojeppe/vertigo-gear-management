import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { rateTables } from "@/modules/pricing";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingSettingsPage() {
  await requirePermission("settings.manage");
  const t = await getTranslations("pricing");
  const tr = await getTranslations("rateExtraRule");
  const ts = await getTranslations("settings");
  const tables = await rateTables.list();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        crumbs={[{ label: ts("title"), href: "/settings" }, { label: t("title") }]}
        actions={
          <Link href="/settings/pricing/new" className={buttonVariants({ size: "sm" })}>
            {t("newTable")}
          </Link>
        }
      />
      {tables.length === 0 ? (
        <EmptyState title={t("noTables")} body={t("noTablesBody")} />
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {tables.map((x) => (
            <li key={x.id}>
              <Link href={`/settings/pricing/${x.id}`} className="flex flex-col gap-1 px-3 py-2 hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">
                    {x.name}
                    {x.isDefault && (
                      <StatusPill color="green" className="ml-2">
                        {t("default")}
                      </StatusPill>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {x.tiers.map((tier) => `${tier.days}d = ${tier.factor}`).join(" · ")}
                    {x.extraRule !== "none" ? ` · ${tr(x.extraRule)} +${x.extraFactor}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">{t("howItWorks")}</p>
    </div>
  );
}
