import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Scan" };

export default async function Page() {
  const t = await getTranslations("nav");
  return <ComingSoon section={t("scan")} phase={1} />;
}
