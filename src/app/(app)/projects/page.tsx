import { LiveFilterForm } from "@/components/form/live-filter-form";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/form/native-select";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { StatusPill } from "@/components/status-pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can, requireActor } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { clientOptions, listProjects, projectFilters } from "@/modules/projects";
import { PROJECT_STATUSES } from "../../../../config/app.config";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const sp = await props.searchParams;
  const filters = projectFilters.parse(sp);
  const t = await getTranslations("projects");
  const ts = await getTranslations("projectStatus");
  const tc = await getTranslations("common");
  const [result, clients] = await Promise.all([listProjects(filters), clientOptions()]);
  const canEdit = can(actor.role, "projects.write");
  const when = filters.when ?? "upcoming";
  const hasFilters = Boolean(filters.q || filters.status || filters.clientId);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <a href={`/api/export/projects.csv${(() => { const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v !== undefined && k !== "page") as [string, string][]).toString(); return q ? `?${q}` : ""; })()}`} className={buttonVariants({ variant: "outline" })}>
              {tc("exportCsv")}
            </a>
            <Link href="/projects/clients" className={buttonVariants({ variant: "outline" })}>
              {t("clients")}
            </Link>
            <Link href="/projects/packing-templates" className={buttonVariants({ variant: "outline" })}>
              {t("templates")}
            </Link>
            <Link href="/projects/plan-templates" className={buttonVariants({ variant: "outline" })}>
              {t("planTemplates")}
            </Link>
            {canEdit && (
              <Link href="/projects/new" className={buttonVariants()}>
                {t("newProject")}
              </Link>
            )}
          </>
        }
      />

      <nav className="flex gap-1 border-b" aria-label="Period">
        {(["upcoming", "past", "all"] as const).map((w) => (
          <Link
            key={w}
            href={`/projects?when=${w}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${when === w ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t(w)}
          </Link>
        ))}
      </nav>

      <LiveFilterForm className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
        <input type="hidden" name="when" value={when} />
        <Input name="q" defaultValue={filters.q ?? ""} placeholder={tc("search")} aria-label={tc("search")} />
        <NativeSelect name="status" defaultValue={filters.status ?? ""} aria-label={t("status")} className="sm:w-40">
          <option value="">{t("allStatuses")}</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {ts(s.key)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="clientId" defaultValue={filters.clientId ?? ""} aria-label={t("client")} className="sm:w-48">
          <option value="">{t("allClients")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" className="group-data-[live]:hidden">
          {tc("filter")}
        </Button>
        {hasFilters && (
          <Link href={`/projects?when=${when}`} className={buttonVariants({ variant: "ghost" })}>
            {tc("clear")}
          </Link>
        )}
      </LiveFilterForm>

      {result.total === 0 ? (
        <EmptyState
          title={hasFilters ? t("noProjects") : t("noProjectsYet")}
          body={hasFilters ? t("noProjectsBody") : t("noProjectsYetBody")}
          action={
            canEdit &&
            !hasFilters && (
              <Link href="/projects/new" className={buttonVariants()}>
                {t("newProject")}
              </Link>
            )
          }
        />
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {result.rows.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50">
                <span className="w-28 shrink-0 text-xs text-muted-foreground">
                  {p.reserveFrom ? `${formatDate(p.reserveFrom)}${p.reserveTo && p.reserveTo !== p.reserveFrom ? ` – ${formatDate(p.reserveTo)}` : ""}` : t("noDates")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[p.clientName, p.venueName].filter(Boolean).join(" · ")}
                    {" · "}
                    {t("reservationsCount", { count: p.reservationCount })} · {t("crewCount", { count: p.crewCount })}
                  </span>
                </span>
                <StatusPill color={PROJECT_STATUSES.find((s) => s.key === p.status)?.color ?? "gray"}>{ts(p.status)}</StatusPill>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={result.page} pages={result.pages} total={result.total} params={sp} />
    </div>
  );
}
