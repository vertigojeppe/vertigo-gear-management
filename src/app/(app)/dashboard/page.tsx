import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireActor } from "@/lib/auth/session";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const actor = await requireActor();
  const t = await getTranslations("dashboard");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("welcome", { name: actor.name })}</p>
      </div>
      <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
    </div>
  );
}
