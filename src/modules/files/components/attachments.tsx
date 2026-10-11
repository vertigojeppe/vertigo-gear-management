import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileText, Paperclip } from "lucide-react";
import type { ActivityEntity } from "@/lib/activity";
import { formatBytes, formatDate } from "@/lib/format";
import { files } from "../service";
import { UploadForm } from "./upload-form";
import { DeleteAttachmentButton } from "./delete-button";

/** Attachment list + upload form for an entity. Server component. */
export async function AttachmentsSection({
  entityType,
  entityId,
  returnTo,
  canEdit,
}: {
  entityType: ActivityEntity;
  entityId: string;
  returnTo: string;
  canEdit: boolean;
}) {
  const t = await getTranslations("attachments");
  const rows = await files.listFor(entityType, entityId);
  const photos = rows.filter((r) => r.thumbUrl);
  const others = rows.filter((r) => !r.thumbUrl);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">
        {t("title")} <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
      </h2>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">{t("none")}</p>}
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {photos.map((a) => (
            <li key={a.id} className="group relative overflow-hidden rounded-md border bg-muted">
              <Link href={a.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.thumbUrl!} alt={a.name} className="aspect-square w-full object-cover" loading="lazy" />
              </Link>
              {canEdit && (
                <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <DeleteAttachmentButton id={a.id} returnTo={returnTo} />
                </div>
              )}
              <p className="truncate px-1.5 py-1 text-[11px] text-muted-foreground" title={a.name}>
                {t(a.kind)} · {a.name}
              </p>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <ul className="divide-y rounded-md border text-sm">
          {others.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2">
              {a.mimeType === "application/pdf" ? <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
              <Link href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                {a.name}
              </Link>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {t(a.kind)} · {formatBytes(a.size)} · {t("uploadedBy", { name: a.uploaderName ?? "—", date: formatDate(a.createdAt) })}
              </span>
              {canEdit && <DeleteAttachmentButton id={a.id} returnTo={returnTo} />}
            </li>
          ))}
        </ul>
      )}
      {canEdit && <UploadForm entityType={entityType} entityId={entityId} returnTo={returnTo} />}
    </section>
  );
}
