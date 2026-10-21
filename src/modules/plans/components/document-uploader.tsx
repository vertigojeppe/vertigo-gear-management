"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { attachUploadedFile, setDocumentPreview } from "../actions";
import { uploadFile } from "@/lib/upload-client";

type Item = { name: string; size: number; done: number; state: "uploading" | "done" | "error"; error?: string };

/**
 * Chunked, resumable uploader: every chunk is retried on its own, and after
 * a failed chunk the client asks the server how far it got. Large 3D files
 * from a phone on venue wifi survive that way. Any file type is accepted;
 * what has a viewer and what is download-only is decided when shown.
 */
export function DocumentUploader({ planId, scheduleEntryId, taskId, compact, previewFor, accept }: { planId: string; scheduleEntryId?: string; taskId?: string; compact?: boolean; previewFor?: string; accept?: string }) {
  const t = useTranslations("plans");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);

  const run = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setItems(list.map((f) => ({ name: f.name, size: f.size, done: 0, state: "uploading" })));
    await Promise.all(
      list.map(async (file, i) => {
        const set = (patch: Partial<Item>) => setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
        try {
          const { fileId } = await uploadFile(file, (done) => set({ done }));
          const r = previewFor ? await setDocumentPreview({ documentId: previewFor, fileId }) : await attachUploadedFile({ planId, fileId, scheduleEntryId, taskId });
          if (!r.ok) throw new Error(r.error ?? "Could not attach.");
          set({ state: "done", done: file.size });
        } catch (err) {
          set({ state: "error", error: err instanceof Error ? err.message : String(err) });
        }
      }),
    );
    router.refresh();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className={`flex flex-col gap-2 rounded-md border border-dashed p-3 text-sm ${dragging ? "border-foreground bg-muted/50" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void run(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" multiple={!previewFor} accept={accept} className="hidden" aria-label={t("uploadFiles")} onChange={(e) => e.target.files && void run(e.target.files)} />
        <Button type="button" size="sm" variant={compact ? "ghost" : "outline"} onClick={() => inputRef.current?.click()}>
          {previewFor ? t("uploadPreview") : t("uploadFiles")}
        </Button>
        {!compact && <span className="text-xs text-muted-foreground">{t("dropHere")}</span>}
      </div>
      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">{it.name}</span>
              {it.state === "uploading" && (
                <span className="h-1.5 w-32 overflow-hidden rounded bg-muted">
                  <span className="block h-full bg-foreground transition-all" style={{ width: `${it.size ? Math.round((it.done / it.size) * 100) : 0}%` }} />
                </span>
              )}
              {it.state === "done" && <span className="text-green-700 dark:text-green-300">{t("uploaded")}</span>}
              {it.state === "error" && (
                <span role="alert" className="text-destructive">
                  {it.error}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
