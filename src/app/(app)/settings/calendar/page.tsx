import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { feedTokens, isGoogleConfigured } from "@/modules/calendar";
import { FeedRow, SyncNowButton } from "./forms";

export const metadata: Metadata = { title: "Calendar settings" };

export default async function CalendarSettingsPage() {
  const actor = await requirePermission("settings.manage");
  const t = await getTranslations("calendar");
  const tset = await getTranslations("settings");
  const h = await headers();
  const origin = process.env.APP_URL?.replace(/\/$/, "") || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const [projects, rentals, mine] = await Promise.all([feedTokens.ensure("projects", null), feedTokens.ensure("rentals", null), feedTokens.ensure("mine", actor.id)]);
  const google = isGoogleConfigured();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={tset("calendar")} subtitle={tset("calendarHelp")} crumbs={[{ label: tset("title"), href: "/settings" }, { label: tset("calendar") }]} />
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium">{t("feeds")}</h2>
          <p className="text-sm text-muted-foreground">{t("feedsHelp")}</p>
        </div>
        <ul className="divide-y rounded-md border text-sm">
          <FeedRow label={t("feedProjects")} scope="projects" url={feedTokens.url(projects.token, origin)} />
          <FeedRow label={t("feedRentals")} scope="rentals" url={feedTokens.url(rentals.token, origin)} />
          <FeedRow label={t("feedMine")} scope="mine" url={feedTokens.url(mine.token, origin)} />
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("google")}</h2>
        <p className={`text-sm ${google ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}>{google ? t("googleOn") : t("googleOff")}</p>
        {google && <SyncNowButton />}
      </section>
    </div>
  );
}
