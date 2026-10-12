import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { can, requirePermission } from "@/lib/auth/session";
import { ContactDialog, DeleteContactButton, contactList } from "@/modules/contacts";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage() {
  const actor = await requirePermission("contacts.read");
  const t = await getTranslations("contacts");
  const ts = await getTranslations("settings");
  const rows = await contactList();
  const canEdit = can(actor.role, "contacts.write");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={ts("contactsHelp")} crumbs={[{ label: ts("title"), href: "/settings" }, { label: t("title") }]} actions={canEdit && <ContactDialog trigger="new" />} />
      {rows.length === 0 ? (
        <EmptyState title={t("noContacts")} body={t("noContactsBody")} action={canEdit && <ContactDialog trigger="new" />} />
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {c.name}
                  {c.organisation ? <span className="font-normal text-muted-foreground"> · {c.organisation}</span> : null}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {[t(c.kind as "person"), c.phone, c.email, c._count.locations > 0 ? t("holdsGear") : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              {canEdit && (
                <span className="flex shrink-0 items-center gap-1">
                  <ContactDialog trigger="edit" contact={c} />
                  <DeleteContactButton id={c.id} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
