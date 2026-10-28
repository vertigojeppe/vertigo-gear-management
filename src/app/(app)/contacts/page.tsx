import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { LiveFilterForm } from "@/components/form/live-filter-form";
import { NativeSelect } from "@/components/form/native-select";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can, requirePermission } from "@/lib/auth/session";
import { CONTACT_KINDS, contactFilters, contactList } from "@/modules/contacts";
import { ContactDialog } from "@/modules/contacts/components/contact-forms";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermission("contacts.read");
  const sp = await props.searchParams;
  const filters = contactFilters.parse(sp);
  const t = await getTranslations("contacts");
  const tc = await getTranslations("common");
  const { rows, closeMatches } = await contactList(filters);
  const canEdit = can(actor.role, "contacts.write");
  const hasFilters = Boolean(filters.q || filters.kind);
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <a href={`/api/export/contacts.csv${query ? `?${query}` : ""}`} className={buttonVariants({ variant: "outline" })}>
              {tc("exportCsv")}
            </a>
            {canEdit && <ContactDialog trigger="new" />}
          </>
        }
      />
      <LiveFilterForm className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <Input name="q" defaultValue={filters.q ?? ""} placeholder={t("searchPlaceholder")} aria-label={tc("search")} />
        <NativeSelect name="kind" defaultValue={filters.kind ?? ""} aria-label={t("kind")} className="sm:w-40">
          <option value="">{t("allKinds")}</option>
          {CONTACT_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`${k}Plural`)}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" className="group-data-[live]:hidden">
          {tc("filter")}
        </Button>
        {hasFilters && (
          <Link href="/contacts" className={buttonVariants({ variant: "ghost" })}>
            {tc("clear")}
          </Link>
        )}
      </LiveFilterForm>
      {closeMatches && filters.q && <p className="text-sm text-muted-foreground">{tc("closeMatches", { query: filters.q })}</p>}
      {rows.length === 0 ? (
        <EmptyState title={hasFilters ? t("noMatches") : t("noContacts")} body={hasFilters ? undefined : t("noContactsBody")} action={canEdit && !hasFilters && <ContactDialog trigger="new" />} />
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {rows.map((c) => {
            const uses = [
              c._count.projects > 0 ? t("onProjects", { count: c._count.projects }) : null,
              c._count.locations > 0 ? t("holdsGear") : null,
              c._count.subHireItems > 0 ? t("subHireCount", { count: c._count.subHireItems }) : null,
              c._count.purchases > 0 ? t("supplier") : null,
            ].filter(Boolean);
            return (
              <li key={c.id}>
                <Link href={`/contacts/${c.id}`} className="flex flex-col gap-0.5 px-3 py-2 hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {c.name}
                      {c.organisation ? <span className="font-normal text-muted-foreground"> · {c.organisation}</span> : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">{[t(c.kind as "person"), c.phone, c.email].filter(Boolean).join(" · ")}</span>
                  </span>
                  {uses.length > 0 && <span className="text-xs text-muted-foreground sm:text-right">{uses.join(" · ")}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
