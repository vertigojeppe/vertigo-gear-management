import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActivityList } from "@/components/activity-list";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { can, requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { contactDetail } from "@/modules/contacts";
import { ContactDialog, DeleteContactButton } from "@/modules/contacts/components/contact-forms";
import { PROJECT_STATUSES } from "../../../../../config/app.config";

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await props.params;
  const d = await contactDetail(id);
  return { title: d?.contact.name ?? "Contact" };
}

export default async function ContactPage(props: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("contacts.read");
  const { id } = await props.params;
  const d = await contactDetail(id, { finance: can(actor.role, "inventory.finance") });
  if (!d) notFound();
  const { contact: c } = d;
  const t = await getTranslations("contacts");
  const tc = await getTranslations("common");
  const ts = await getTranslations("projectStatus");
  const canEdit = can(actor.role, "contacts.write");
  const canProjects = can(actor.role, "projects.read");
  const canInventory = can(actor.role, "inventory.read");
  const range = (from: string | null, to: string | null) => (from ? (to && to !== from ? `${formatDate(from)} – ${formatDate(to)}` : formatDate(from)) : t("noDates"));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={c.name}
        subtitle={[t(c.kind as "person"), c.organisation].filter(Boolean).join(" · ")}
        crumbs={[{ label: t("title"), href: "/contacts" }, { label: c.name }]}
        actions={
          canEdit && (
            <>
              <ContactDialog trigger="edit" contact={c} />
              <DeleteContactButton id={c.id} back />
            </>
          )
        }
      />

      <dl className="grid max-w-xl grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t("phone")}</dt>
        <dd>{c.phone ? <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="underline">{c.phone}</a> : "—"}</dd>
        <dt className="text-muted-foreground">{t("email")}</dt>
        <dd className="min-w-0 break-words">{c.email ? <a href={`mailto:${c.email}`} className="underline">{c.email}</a> : "—"}</dd>
        <dt className="text-muted-foreground">{t("address")}</dt>
        <dd className="whitespace-pre-line">{c.address ?? "—"}</dd>
      </dl>
      {c.notes && <p className="max-w-xl whitespace-pre-line text-sm text-muted-foreground">{c.notes}</p>}

      {canProjects && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">
            {t("projects")} <span className="text-sm font-normal text-muted-foreground">({d.projects.length})</span>
          </h2>
          {d.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noProjects")}</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {d.projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.projectId}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 hover:bg-muted/50">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {p.name}
                        {p.role ? <span className="font-normal text-muted-foreground"> · {p.role}</span> : null}
                      </span>
                      <span className="block text-xs text-muted-foreground">{range(p.from, p.to)}</span>
                    </span>
                    <StatusPill color={PROJECT_STATUSES.find((s) => s.key === p.status)?.color ?? "gray"}>{ts(p.status)}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canInventory && d.gear.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{t("gearHeld")}</h2>
          <ul className="divide-y rounded-md border text-sm">
            {d.gear.map((g) => (
              <li key={g.id}>
                <Link href={`/inventory/items/${g.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    {g.label}
                    {g.quantity > 1 ? <span className="text-muted-foreground"> × {g.quantity}</span> : null}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{g.assetTag}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canInventory && d.subHire.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{t("subHireOwned")}</h2>
          <ul className="divide-y rounded-md border text-sm">
            {d.subHire.map((s) => (
              <li key={s.id} className="px-3 py-2">
                {s.label}
                {s.manufacturer ? <span className="text-xs text-muted-foreground"> {s.manufacturer}</span> : null}
                {s.archived ? <span className="text-xs text-muted-foreground"> · {t("archived")}</span> : null}
              </li>
            ))}
          </ul>
          <Link href="/inventory/subhire" className="text-sm underline">
            {t("openSubHire")}
          </Link>
        </section>
      )}

      {d.purchases.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{t("purchases")}</h2>
          <ul className="divide-y rounded-md border text-sm">
            {d.purchases.map((p) => (
              <li key={p.id}>
                <Link href={`/inventory/purchases/${p.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    {p.quantity} × {p.modelLabel}
                    {p.reference ? <span className="text-muted-foreground"> · {p.reference}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">{p.date ? formatDate(p.date) : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{tc("activity")}</h2>
        <ActivityList rows={d.activity} />
      </section>
    </div>
  );
}
