import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActivityList } from "@/components/activity-list";
import { ConfirmButton } from "@/components/form/confirm-button";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { activityFor } from "@/lib/activity";
import { can, requirePermission } from "@/lib/auth/session";
import { formatBytes, formatDateTime } from "@/lib/format";
import { AppAction, AppDialog, AppVersionUploader, appDetail, appList, deleteApp, deleteAppVersion, setAppArchived } from "@/modules/apps";

export const metadata: Metadata = { title: "App" };

export default async function AppPage(props: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("apps.read");
  const { id } = await props.params;
  const detail = await appDetail(id);
  if (!detail) notFound();
  const { app, versions, latest } = detail;
  const t = await getTranslations("apps");
  const tk = await getTranslations("appKind");
  const tc = await getTranslations("common");
  const canEdit = can(actor.role, "apps.write");
  const isAdmin = can(actor.role, "users.manage");
  const [{ categories }, activity] = await Promise.all([canEdit ? appList({}) : Promise.resolve({ categories: [] as string[] }), activityFor("app", id, 20)]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={app.name}
        subtitle={[tk(app.kind), app.category, app.archived ? t("archived") : null].filter(Boolean).join(" · ")}
        crumbs={[{ label: t("title"), href: "/apps" }, { label: app.name }]}
        actions={
          <>
            <AppAction app={{ ...app, latest }} size="default" />
            {canEdit && <AppDialog app={app} categories={categories} />}
            {canEdit && (
              <form action={setAppArchived}>
                <input type="hidden" name="id" value={app.id} />
                <input type="hidden" name="archived" value={String(!app.archived)} />
                <Button type="submit" variant="ghost" size="sm">
                  {app.archived ? t("unarchive") : t("archive")}
                </Button>
              </form>
            )}
            {isAdmin && (
              <form action={deleteApp}>
                <input type="hidden" name="id" value={app.id} />
                <ConfirmButton confirm={t("deleteAppConfirm", { name: app.name, count: versions.length })} variant="ghost" size="sm" className="text-destructive">
                  {tc("delete")}
                </ConfirmButton>
              </form>
            )}
          </>
        }
      />
      {app.description && <p className="max-w-2xl whitespace-pre-line text-sm">{app.description}</p>}
      {app.kind === "link" && app.url && (
        <p className="text-sm">
          <a href={app.url} target="_blank" rel="noopener noreferrer" className="break-all underline">
            {app.url}
          </a>
        </p>
      )}
      {app.kind === "tool" && <p className="max-w-2xl text-xs text-muted-foreground">{t("toolSandboxHelp")}</p>}

      {app.kind !== "link" && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">
            {t("versions")} <span className="text-sm font-normal text-muted-foreground">({versions.length})</span>
          </h2>
          {canEdit && <AppVersionUploader appId={app.id} kind={app.kind} />}
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noVersions")}</p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {versions.map((v, i) => (
                <li key={v.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {v.label ?? v.file.name}
                      {i === 0 && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{t("newest")}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {v.label ? `${v.file.name} · ` : ""}
                      {formatBytes(v.file.size)} · {formatDateTime(v.createdAt)}
                      {v.uploadedBy ? ` · ${v.uploadedBy}` : ""}
                    </span>
                    {v.notes && <span className="block text-xs">{v.notes}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {app.kind === "tool" && (
                      <Link href={`/apps/${app.id}/run?v=${v.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                        {t("run")}
                      </Link>
                    )}
                    <a href={`/api/files/${v.file.id}?download=1`} className={buttonVariants({ size: "sm", variant: "outline" })} aria-label={`${t("download")} ${v.label ?? v.file.name}`}>
                      {t("download")}
                    </a>
                    {isAdmin && (
                      <form action={deleteAppVersion}>
                        <input type="hidden" name="id" value={v.id} />
                        <ConfirmButton confirm={t("deleteVersionConfirm", { name: v.label ?? v.file.name })} variant="ghost" size="sm" className="text-destructive" aria-label={`${tc("delete")} ${v.label ?? v.file.name}`}>
                          {tc("delete")}
                        </ConfirmButton>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{tc("activity")}</h2>
        <ActivityList rows={activity} />
      </section>
    </div>
  );
}
