import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { can, requireActor } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { contactOptions } from "@/modules/contacts";
import { InventoryTabs, categoryOptions } from "@/modules/inventory";
import { ArchiveSubHireItemButton, DeleteSubHireItemButton, SubHireItemDialog, subHireCatalog } from "@/modules/subhire";

export const metadata: Metadata = { title: "Sub-hire catalog" };

export default async function SubHirePage(props: { searchParams: Promise<{ archived?: string }> }) {
  const actor = await requireActor();
  const { archived } = await props.searchParams;
  const showArchived = archived === "1";
  const t = await getTranslations("subhire");
  const ti = await getTranslations("inventory");
  const [groups, contacts, categories] = await Promise.all([subHireCatalog(showArchived), contactOptions(), categoryOptions()]);
  const owners = contacts.filter((c) => c.kind === "company").map((c) => ({ id: c.id, name: c.name, organisation: c.organisation }));
  const canEdit = can(actor.role, "inventory.write");
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  const dialog = canEdit && <SubHireItemDialog trigger="new" owners={owners} categories={categories} />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={ti("title")} actions={dialog} />
      <InventoryTabs />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <p className="text-muted-foreground">{t("help")}</p>
        <Link href={showArchived ? "/inventory/subhire" : "/inventory/subhire?archived=1"} className="underline">
          {showArchived ? t("hideArchived") : t("showArchived")}
        </Link>
      </div>
      {canEdit && owners.length === 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {t("noOwners")}{" "}
          <Link href="/settings/contacts" className="underline">
            {t("contacts")}
          </Link>
        </p>
      )}
      {count === 0 ? (
        <EmptyState title={t("empty")} body={t("emptyBody")} action={dialog} />
      ) : (
        groups.map((g) => (
          <section key={g.ownerContactId} className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-muted-foreground">{t("rentInFrom", { owner: g.ownerName })}</h2>
            <ul className="divide-y rounded-md border text-sm">
              {g.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="min-w-0 flex-1">
                    <span className={`block font-medium ${item.archived ? "text-muted-foreground line-through" : ""}`}>
                      {item.label}
                      {item.categoryName ? <span className="font-normal text-muted-foreground"> · {item.categoryName}</span> : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {[
                        item.costPerDay !== null ? t("costShort", { amount: formatMoney(item.costPerDay) }) : null,
                        item.rentalDayPrice !== null ? t("priceShort", { amount: formatMoney(item.rentalDayPrice) }) : null,
                        item.description,
                        item.lines > 0 ? t("onProjects", { count: item.lines }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {item.links.map((l) => (
                        <span key={l.url}>
                          {" · "}
                          <a href={l.url} target="_blank" rel="noreferrer" className="underline">
                            {l.label}
                          </a>
                        </span>
                      ))}
                    </span>
                    {item.notes && <span className="block whitespace-pre-line text-xs text-muted-foreground">{item.notes}</span>}
                  </span>
                  {canEdit && (
                    <span className="flex shrink-0 flex-wrap items-center gap-1">
                      <SubHireItemDialog trigger="edit" item={item} owners={owners} categories={categories} />
                      <ArchiveSubHireItemButton id={item.id} archived={item.archived} />
                      {item.lines === 0 && <DeleteSubHireItemButton id={item.id} />}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
