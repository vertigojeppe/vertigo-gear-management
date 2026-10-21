import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Download, ExternalLink, Play } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LiveFilterForm } from "@/components/form/live-filter-form";
import { NativeSelect } from "@/components/form/native-select";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can, requirePermission } from "@/lib/auth/session";
import { formatBytes } from "@/lib/format";
import { AppAction, AppDialog, appFilters, appList, type AppRow } from "@/modules/apps";
import { APP_KINDS } from "../../../../config/app.config";

export const metadata: Metadata = { title: "Apps" };

const KIND_ICON = { file: Download, link: ExternalLink, tool: Play } as const;

export default async function AppsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermission("apps.read");
  const filters = appFilters.parse(await props.searchParams);
  const t = await getTranslations("apps");
  const tk = await getTranslations("appKind");
  const tc = await getTranslations("common");
  const { rows, closeMatches, categories } = await appList(filters);
  const canEdit = can(actor.role, "apps.write");
  const hasFilters = Boolean(filters.q || filters.kind || filters.archived);

  const groups = new Map<string, AppRow[]>();
  for (const a of rows) groups.set(a.category ?? "", [...(groups.get(a.category ?? "") ?? []), a]);
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={canEdit && <AppDialog categories={categories} />} />
      <LiveFilterForm className="flex flex-wrap items-center gap-2">
        <Input name="q" defaultValue={filters.q ?? ""} placeholder={tc("search")} aria-label={tc("search")} className="max-w-xs" />
        <NativeSelect name="kind" defaultValue={filters.kind ?? ""} aria-label={t("kind")} className="w-44">
          <option value="">{t("allKinds")}</option>
          {APP_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {tk(k.key)}
            </option>
          ))}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={Boolean(filters.archived)} className="size-4" />
          {t("showArchived")}
        </label>
        <Button type="submit" variant="outline" className="group-data-[live]:hidden">
          {tc("filter")}
        </Button>
        {hasFilters && (
          <Link href="/apps" className={buttonVariants({ variant: "ghost" })}>
            {tc("clear")}
          </Link>
        )}
      </LiveFilterForm>
      {closeMatches && filters.q && <p className="text-sm text-muted-foreground">{tc("closeMatches", { query: filters.q })}</p>}

      {rows.length === 0 ? (
        <EmptyState title={hasFilters ? t("noMatches") : t("noApps")} body={hasFilters ? undefined : t("noAppsBody")} action={!hasFilters && canEdit && <AppDialog categories={categories} />} />
      ) : (
        ordered.map(([category, list]) => (
          <section key={category || "_"} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{category || t("uncategorised")}</h2>
            <ul className="divide-y rounded-md border">
              {list.map((a) => {
                const Icon = KIND_ICON[a.kind];
                return (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <Link href={`/apps/${a.id}`} className="min-w-0 flex-1 hover:underline">
                      <span className="block truncate font-medium">
                        {a.name}
                        {a.archived && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{t("archived")}</span>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {tk(a.kind)}
                        {a.latest ? ` · ${a.latest.label ?? a.latest.file.name} · ${formatBytes(a.latest.file.size)}` : ""}
                        {a.versionCount > 1 ? ` · ${t("versionCount", { count: a.versionCount })}` : ""}
                        {a.description ? ` · ${a.description}` : ""}
                      </span>
                    </Link>
                    <AppAction app={a} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
