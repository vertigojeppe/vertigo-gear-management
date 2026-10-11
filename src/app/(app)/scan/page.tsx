import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requireActor } from "@/lib/auth/session";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Scan" };

export default async function ScanPage() {
  await requireActor();
  const t = await getTranslations("scan");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("title")} subtitle={t("hint")} />
      <Scanner />
    </div>
  );
}
