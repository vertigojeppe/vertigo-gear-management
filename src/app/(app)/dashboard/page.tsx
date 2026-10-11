import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActivityList } from "@/components/activity-list";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { recentActivity } from "@/lib/activity";
import { requireActor } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { dashboardStats } from "@/modules/inventory";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const actor = await requireActor();
  const t = await getTranslations("dashboard");
  const tl = await getTranslations("locationType");
  const [stats, activity] = await Promise.all([dashboardStats(), recentActivity(15)]);
  const inHouse = stats.statusTotals.in_house?.units ?? 0;
  const out = (stats.statusTotals.on_project?.units ?? 0) + (stats.statusTotals.rented_out?.units ?? 0);
  const attention = (stats.statusTotals.in_repair?.units ?? 0) + (stats.statusTotals.missing?.units ?? 0);
  const empty = stats.modelCount === 0;

  const tiles: { label: string; value: number; href: string }[] = [
    { label: t("models"), value: stats.modelCount, href: "/inventory" },
    { label: t("itemsInHouse"), value: inHouse, href: "/inventory/items?status=in_house" },
    { label: t("itemsOut"), value: out, href: "/inventory/items?status=on_project" },
    { label: t("attentionCount"), value: attention, href: "/inventory/items?status=in_repair" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("welcome", { name: actor.name })}</p>
      </div>

      {empty ? (
        <EmptyState
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <Link href="/inventory/categories" className={buttonVariants()}>
              {t("browseInventory")}
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tiles.map((tile) => (
              <Link key={tile.label} href={tile.href} className="rounded-md bg-muted/60 p-4 hover:bg-muted">
                <p className="text-xs text-muted-foreground">{tile.label}</p>
                <p className="text-2xl font-semibold">{tile.value}</p>
              </Link>
            ))}
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-lg font-medium">{t("outNow")}</h2>
                <p className="text-xs text-muted-foreground">{t("outNowBody")}</p>
              </div>
              {stats.out.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("outNowEmpty")}</p>
              ) : (
                stats.out.map((g) => (
                  <div key={g.location.id ?? "none"} className="rounded-md border">
                    <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5 text-sm">
                      <span className="font-medium">
                        {g.location.name}
                        {g.location.type && <span className="ml-2 text-xs font-normal text-muted-foreground">{tl(g.location.type as "project")}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{g.items.length}</span>
                    </div>
                    <ul className="divide-y text-sm">
                      {g.items.slice(0, 8).map((i) => (
                        <li key={i.id}>
                          <Link href={`/inventory/items/${i.id}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50">
                            <span className="font-mono text-xs">{i.assetTag}</span>
                            <span className="min-w-0 flex-1 truncate">
                              {i.name ? `${i.name} · ` : ""}
                              {i.modelLabel}
                              {i.quantity > 1 ? ` ×${i.quantity}` : ""}
                            </span>
                            <StatusBadge status={i.status} />
                          </Link>
                        </li>
                      ))}
                      {g.items.length > 8 && (
                        <li className="px-3 py-1.5 text-xs">
                          <Link href={`/inventory/items?locationId=${g.location.id ?? ""}`} className="underline">
                            {t("viewAll")} ({g.items.length})
                          </Link>
                        </li>
                      )}
                    </ul>
                  </div>
                ))
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-medium">{t("attention")}</h2>
              {stats.attention.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("attentionEmpty")}</p>
              ) : (
                <ul className="divide-y rounded-md border text-sm">
                  {stats.attention.map((i) => (
                    <li key={i.id}>
                      <Link href={`/inventory/items/${i.id}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50">
                        <span className="font-mono text-xs">{i.assetTag}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            {i.name ? `${i.name} · ` : ""}
                            {i.modelLabel}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {i.reason ? `${i.reason} · ` : ""}
                            {t("since", { date: formatDate(i.since) })}
                          </span>
                        </span>
                        <StatusBadge status={i.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{t("recentActivity")}</h2>
        <ActivityList rows={activity} />
      </section>
    </div>
  );
}
