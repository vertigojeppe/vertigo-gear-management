import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { glossary } from "@/modules/settings";
import { GlossaryForm } from "./glossary-form";

export const metadata: Metadata = { title: "Search words" };

export default async function SearchWordsPage() {
  await requirePermission("settings.manage");
  const t = await getTranslations("settings");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("searchWords")} crumbs={[{ label: t("title"), href: "/settings" }, { label: t("searchWords") }]} />
      <p className="max-w-2xl text-sm text-muted-foreground">{t("glossaryIntro")}</p>
      <GlossaryForm text={await glossary.text()} />
    </div>
  );
}
