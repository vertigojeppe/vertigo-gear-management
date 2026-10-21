import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { appDetail } from "@/modules/apps";

export const metadata: Metadata = { title: "Tool" };

/**
 * Runs a tool (one uploaded HTML file) in a sandboxed frame: scripts run,
 * but in an origin of their own, so the tool cannot read this app's cookies,
 * pages or API. /api/apps/versions/[id]/run sends the same sandbox as a
 * header, so opening it in its own tab is just as contained.
 */
export default async function RunToolPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  await requirePermission("apps.read");
  const { id } = await props.params;
  const { v } = await props.searchParams;
  const detail = await appDetail(id);
  if (!detail || detail.app.kind !== "tool") notFound();
  const version = detail.versions.find((x) => x.id === v) ?? detail.latest;
  if (!version) notFound();
  const t = await getTranslations("apps");
  const src = `/api/apps/versions/${version.id}/run`;
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={detail.app.name}
        subtitle={version.label ?? version.file.name}
        crumbs={[{ label: t("title"), href: "/apps" }, { label: detail.app.name, href: `/apps/${id}` }, { label: t("run") }]}
        actions={
          <a href={src} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("openInTab")}
          </a>
        }
      />
      <iframe
        src={src}
        title={detail.app.name}
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
        referrerPolicy="no-referrer"
        className="h-[75vh] w-full rounded-md border bg-white"
      />
    </div>
  );
}
