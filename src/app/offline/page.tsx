import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SavedLists } from "@/components/pwa/saved-lists";
import { appConfig } from "../../../config/app.config";

export const metadata: Metadata = { title: "Offline" };

/**
 * Shown by the service worker when a page cannot be fetched. Public: cached
 * at install, no session needed. Lists the packing lists saved for offline.
 */
export default async function OfflinePage() {
  const t = await getTranslations("pwa");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-xs text-muted-foreground">{appConfig.name}</p>
      <h1 className="text-2xl font-semibold tracking-tight">{t("offlineTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("offlineBody")}</p>
      <a href="/dashboard" className="mt-2 rounded-md border px-4 py-2 text-sm hover:bg-muted">
        {t("retry")}
      </a>
      <SavedLists />
    </main>
  );
}
