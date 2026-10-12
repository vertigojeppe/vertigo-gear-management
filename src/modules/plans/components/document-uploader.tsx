"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { attachUploadedFile, setDocumentPreview } from "../actions";

type Item = { name: string; size: number; done: number; state: "uploading" | "done" | "error"; error?: string };

async function uploadFile(file: File, onProgress: (done: number) => void): Promise<{ fileId: string }> {
  const start = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size }) });
  if (!start.ok) throw new Error((await start.json().catch(() => ({})))?.error ?? `Upload could not start (${start.status})`);
  const { id, chunkSize } = (await start.json()) as { id: string; chunkSize: number };
  let offset = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(file.size, offset + chunkSize));
    let attempt = 0;
    for (;;) {
      try {
        const res = await fetch(`/api/uploads/${id}?offset=${offset}`, { method: "PUT", body: chunk, headers: { "Content-Type": "application/octet-stream" } });
        if (res.status === 409) {
          // Out of sync (a retry already landed?): ask where the server is and continue from there.
          const st = await fetch(`/api/uploads/${id}`);
          if (!st.ok) throw new Error("Upload lost. Try again.");
          offset = ((await st.json()) as { received: number }).received;
          break;
        }
        if (!res.ok) throw new Error(`Chunk failed (${res.status})`);
        offset = ((await res.json()) as { received: number }).received;
        break;
      } catch (err) {
        if (++attempt > 4) throw err instanceof Error ? err : new Error(String(err));
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    onProgress(offset);
  }
  const done = await fetch(`/api/uploads/${id}/complete`, { method: "POST" });
  if (!done.ok) throw new Error((await done.json().catch(() => ({})))?.error ?? `Upload could not complete (${done.status})`);
  return (await done.json()) as { fileId: string };
}

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
