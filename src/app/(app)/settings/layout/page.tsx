import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { appSettings } from "@/modules/settings";
import { LayoutForm } from "./layout-form";

export const metadata: Metadata = { title: "Layout" };

export default async function LayoutSettingsPage() {
  await requirePermission("settings.manage");
  const t = await getTranslations("settings");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("layout")} crumbs={[{ label: t("title"), href: "/settings" }, { label: t("layout") }]} />
      <p className="max-w-2xl text-sm text-muted-foreground">{t("layoutIntro")}</p>
      <LayoutForm layout={await appSettings.layout()} />
    </div>
  );
}
