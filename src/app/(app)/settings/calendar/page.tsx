import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth/session";
import { feedTokens, isGoogleConfigured } from "@/modules/calendar";
import { appSettings } from "@/modules/settings";
import { CallHoursForm, FeedRow, SyncNowButton } from "./forms";

export const metadata: Metadata = { title: "Calendar settings" };

export default async function CalendarSettingsPage() {
  const actor = await requirePermission("settings.manage");
  const t = await getTranslations("calendar");
  const tset = await getTranslations("settings");
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
          <FeedRow label={t("feedProjects")} scope="projects" path={feedTokens.url(projects.token, "")} />
          <FeedRow label={t("feedRentals")} scope="rentals" path={feedTokens.url(rentals.token, "")} />
          <FeedRow label={t("feedMine")} scope="mine" path={feedTokens.url(mine.token, "")} />
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-medium">{t("jobEvents")}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{t("jobEventsHelp")}</p>
        </div>
        <CallHoursForm hours={await appSettings.callHours()} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t("google")}</h2>
        <p className={`text-sm ${google ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}>{google ? t("googleOn") : t("googleOff")}</p>
        {google && <SyncNowButton />}
      </section>
    </div>
  );
}
