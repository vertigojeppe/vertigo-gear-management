import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { can, requireActor } from "@/lib/auth/session";
import { DeleteLocationButton, InventoryTabs, LocationDialog, locationList, locationOptions } from "@/modules/inventory";

export const metadata: Metadata = { title: "Locations" };

type Node = Awaited<ReturnType<typeof locationList>>[number];

export default async function LocationsPage() {
  const actor = await requireActor();
  const t = await getTranslations("inventory");
  const tl = await getTranslations("locationType");
  const [tree, options] = await Promise.all([locationList(), locationOptions()]);
  const canEdit = can(actor.role, "inventory.write");

  const render = (nodes: Node[]) => (
    <ul className={nodes[0]?.depth ? "ml-5 border-l pl-3" : ""}>
      {nodes.map((n) => (
        <li key={n.id} className="py-1">
          <div className="flex items-center gap-3">
            <Link href={`/inventory/items?locationId=${n.id}`} className="font-medium hover:underline">
              {n.name}
            </Link>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{tl(n.type as "warehouse")}</span>
            <span className="text-xs text-muted-foreground">{t("itemsCount", { count: n._count.items })}</span>
            {canEdit && (
              <span className="ml-auto flex items-center gap-1">
                <LocationDialog trigger="edit" location={{ id: n.id, name: n.name, type: n.type, parentId: n.parentId, notes: n.notes }} parents={options} />
                {n._count.items === 0 && n.children.length === 0 && <DeleteLocationButton id={n.id} />}
              </span>
            )}
          </div>
          {n.notes && <p className="text-xs text-muted-foreground">{n.notes}</p>}
          {n.children.length > 0 && render(n.children)}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("title")} actions={canEdit && <LocationDialog trigger="new" parents={options} />} />
      <InventoryTabs />
      {tree.length === 0 ? <EmptyState title={t("noLocations")} body={t("noLocationsBody")} /> : <div className="rounded-md border px-4 py-2 text-sm">{render(tree)}</div>}
    </div>
  );
}
