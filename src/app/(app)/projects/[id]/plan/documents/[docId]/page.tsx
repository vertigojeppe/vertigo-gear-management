import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { can, requireActor } from "@/lib/auth/session";
import { formatBytes, formatDateTime } from "@/lib/format";
import { documentDetail, documentsForPlan } from "@/modules/plans";
import { DocumentUploader } from "@/modules/plans/components/document-uploader";
import { DocumentViewer } from "@/modules/plans/components/document-viewer";
import { PinDocumentForm, RemoveDocumentButton, RemoveVersionButton } from "@/modules/plans/components/document-forms";

export const metadata: Metadata = { title: "Document" };

export default async function DocumentPage(props: { params: Promise<{ id: string; docId: string }>; searchParams: Promise<{ v?: string }> }) {
  const actor = await requireActor();
  const { id, docId } = await props.params;
  const { v } = await props.searchParams;
  const detail = await documentDetail(docId);
  if (!detail || detail.plan.projectId !== id) notFound();
  const t = await getTranslations("plans");
  const tp = await getTranslations("projects");
  const canEdit = can(actor.role, "plans.write");
  const { document, plan, versions } = detail;
  const version = versions.find((x) => x.id === v) ?? versions[0];
  // OBJ + MTL: a sibling document with the same base name and .mtl supplies materials.
  let mtlUrl: string | null = null;
  if (document.kind === "model3d" && version.name.toLowerCase().endsWith(".obj")) {
    const base = version.name.replace(/\.obj$/i, "").toLowerCase();
    const sibling = (await documentsForPlan(plan.id)).find((d) => d.latest.name.toLowerCase() === `${base}.mtl`);
    mtlUrl = sibling ? sibling.latest.url : null;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={document.name}
        subtitle={`${t("version")} ${version.version} · ${formatBytes(version.size)} · ${version.uploaderName ?? "—"} · ${formatDateTime(version.createdAt)}${version.note ? ` · ${version.note}` : ""}`}
        crumbs={[{ label: tp("title"), href: "/projects" }, { label: plan.projectName, href: `/projects/${id}` }, { label: t("title"), href: `/projects/${id}/plan` }, { label: document.name }]}
        actions={
          <>
            <a href={`${version.url}?download=1`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("download")}
            </a>
            {canEdit && <RemoveDocumentButton projectId={id} documentId={document.id} />}
          </>
        }
      />

      <DocumentViewer kind={document.kind} version={{ id: version.id, url: version.url, name: version.name, mimeType: version.mimeType, size: version.size, markups: version.markups }} canEdit={canEdit} userId={actor.id} mtlUrl={mtlUrl} previewUrl={document.previewUrl} />

      {canEdit && (document.kind === "native" || document.kind === "other") && (
        <DocumentUploader planId={plan.id} previewFor={document.id} accept="image/*" compact />
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">{t("versions")}</h2>
          <ul className="divide-y rounded-md border text-sm">
            {versions.map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-3 py-2">
                <Link href={`/projects/${id}/plan/documents/${document.id}?v=${x.id}`} className={`min-w-0 flex-1 ${x.id === version.id ? "font-medium" : "hover:underline"}`}>
                  {t("version")} {x.version}
                  <span className="block text-xs text-muted-foreground">
                    {x.name} · {formatBytes(x.size)} · {x.uploaderName ?? "—"} · {formatDateTime(x.createdAt)}
                    {x.markups.some((m) => m.shapes.length > 0) ? ` · ${t("hasMarkup")}` : ""}
                  </span>
                </Link>
                {x.id === version.id && <StatusPill color="green">{t("current")}</StatusPill>}
                <a href={`${x.url}?download=1`} className="text-xs underline">
                  {t("download")}
                </a>
                {canEdit && versions.length > 1 && <RemoveVersionButton projectId={id} documentId={document.id} versionId={x.id} />}
              </li>
            ))}
          </ul>
          {canEdit && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">{t("newVersionHint", { name: document.name })}</p>
              <DocumentUploader planId={plan.id} compact />
            </div>
          )}
        </section>
        {canEdit && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">{t("pinTo")}</h2>
            <PinDocumentForm
              projectId={id}
              documentId={document.id}
              scheduleEntryId={document.scheduleEntryId}
              taskId={document.taskId}
              entries={detail.scheduleEntries.map((e) => ({ id: e.id, label: `${formatDateTime(e.startsAt)} ${e.title}` }))}
              tasks={detail.tasks.map((x) => ({ id: x.id, label: x.title }))}
            />
          </section>
        )}
      </div>
    </div>
  );
}
