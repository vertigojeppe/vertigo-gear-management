import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BookUser, CalendarDays, Coins, Columns3, DatabaseBackup, FileSpreadsheet, KeyRound, Languages, ListPlus, Users, Webhook } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { can, requireActor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireActor();
  const t = await getTranslations("settings");
  const cards = [
    { href: "/settings/account", icon: KeyRound, title: t("account"), body: t("accountHelp"), show: true },
    { href: "/settings/contacts", icon: BookUser, title: t("contacts"), body: t("contactsHelp"), show: can(actor.role, "contacts.read") },
    { href: "/settings/users", icon: Users, title: t("users"), body: t("usersHelp"), show: can(actor.role, "users.manage") },
    { href: "/settings/custom-fields", icon: ListPlus, title: t("customFields"), body: t("customFieldsHelp"), show: can(actor.role, "settings.manage") },
    { href: "/settings/layout", icon: Columns3, title: t("layout"), body: t("layoutHelp"), show: can(actor.role, "settings.manage") },
    { href: "/settings/search", icon: Languages, title: t("searchWords"), body: t("searchWordsHelp"), show: can(actor.role, "settings.manage") },
    { href: "/settings/pricing", icon: Coins, title: t("pricing"), body: t("pricingHelp"), show: can(actor.role, "settings.manage") },
    { href: "/settings/calendar", icon: CalendarDays, title: t("calendar"), body: t("calendarHelp"), show: can(actor.role, "settings.manage") },
    { href: "/settings/webhooks", icon: Webhook, title: t("webhooks"), body: t("webhooksHelp"), show: can(actor.role, "settings.manage") },
    { href: "/settings/import", icon: FileSpreadsheet, title: t("import"), body: t("importHelp"), show: can(actor.role, "settings.manage") },
    { href: "/settings/backup", icon: DatabaseBackup, title: t("backup"), body: t("backupHelp"), show: can(actor.role, "users.manage") },
  ].filter((c) => c.show);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="flex gap-3 rounded-md border p-4 hover:bg-muted/50">
            <c.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="block font-medium">{c.title}</span>
              <span className="block text-sm text-muted-foreground">{c.body}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
