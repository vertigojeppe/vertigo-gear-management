import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { can, requireActor } from "@/lib/auth/session";
import { clients } from "@/modules/projects";
import { ClientDialog, DeleteClientButton } from "@/modules/projects/components/client-dialog";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const actor = await requireActor();
  const t = await getTranslations("projects");
  const rows = await clients.list();
  const canEdit = can(actor.role, "projects.write");
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("clients")} crumbs={[{ label: t("title"), href: "/projects" }, { label: t("clients") }]} actions={canEdit && <ClientDialog trigger="new" />} />
      {rows.length === 0 ? (
        <EmptyState title={t("noClients")} body={t("noClientsBody")} action={canEdit && <ClientDialog trigger="new" />} />
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{c.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[c.contactName, c.phone, c.email, c.address].filter(Boolean).join(" · ")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  <Link href={`/projects?when=all&clientId=${c.id}`} className="hover:underline">
                    {t("projectsCount", { count: c._count.projects })}
                  </Link>
                  {" · "}
                  {t("rentalsCount", { count: c._count.rentals })}
                </span>
              </span>
              {canEdit && (
                <span className="flex items-center gap-1">
                  <ClientDialog trigger="edit" client={c} />
                  {c._count.projects + c._count.rentals === 0 && <DeleteClientButton id={c.id} />}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
