"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ActionForm } from "@/components/form/action-form";
import { Field, FormError } from "@/components/form/field";
import { NativeSelect } from "@/components/form/native-select";
import { SubmitButton } from "@/components/form/submit-button";
import { useActionDialog } from "@/components/form/use-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/forms";
import { formatBytes } from "@/lib/format";
import { uploadFile } from "@/lib/upload-client";
import { APP_KINDS, type AppKind } from "../../../../config/app.config";
import { addAppVersion, saveApp } from "../actions";

type AppValues = { id: string; name: string; kind: AppKind; category: string | null; description: string | null; url: string | null };

/** New app or edit: name, kind (fixed after creation), category, description, and the address for links. */
export function AppDialog({ app, categories }: { app?: AppValues; categories: string[] }) {
  const t = useTranslations("apps");
  const tk = useTranslations("appKind");
  const tc = useTranslations("common");
  const [state, action] = useActionState<FormState, FormData>(saveApp, {});
  const [open, setOpen] = useActionDialog(state);
  const [kind, setKind] = useState<string>(app?.kind ?? "file");
  const err = state.fieldErrors ?? {};
  const v = (name: string, fallback: string | null | undefined) => (state.values && name in state.values ? state.values[name] : (fallback ?? ""));
  return (
    <>
      <Button variant={app ? "outline" : "default"} size={app ? "sm" : "default"} onClick={() => setOpen(true)}>
        {app ? tc("edit") : t("newApp")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{app ? t("editApp") : t("newApp")}</DialogTitle>
            <DialogDescription>{t("dialogHelp")}</DialogDescription>
          </DialogHeader>
          <ActionForm action={action} className="flex flex-col gap-4">
            {app && <input type="hidden" name="id" value={app.id} />}
            <FormError message={state.error} />
            <Field id="app-name" label={t("name")} error={err.name}>
              <Input id="app-name" name="name" defaultValue={v("name", app?.name)} required autoFocus />
            </Field>
            <Field id="app-kind" label={t("kind")} help={tk(`${kind}Help`)} error={err.kind}>
              {app ? (
                <>
                  <input type="hidden" name="kind" value={app.kind} />
                  <Input id="app-kind" value={tk(app.kind)} disabled />
                </>
              ) : (
                <NativeSelect id="app-kind" name="kind" defaultValue={v("kind", "file")} onChange={(e) => setKind(e.target.value)}>
                  {APP_KINDS.map((k) => (
                    <option key={k.key} value={k.key}>
                      {tk(k.key)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            {kind === "link" && (
              <Field id="app-url" label={t("url")} error={err.url}>
                <Input id="app-url" name="url" type="url" inputMode="url" defaultValue={v("url", app?.url)} placeholder="https://" required />
              </Field>
            )}
            <Field id="app-category" label={t("category")} optional help={t("categoryHelp")} error={err.category}>
              <Input id="app-category" name="category" list="app-categories" defaultValue={v("category", app?.category)} />
              <datalist id="app-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field id="app-description" label={t("description")} optional error={err.description}>
              <Textarea id="app-description" name="description" rows={3} defaultValue={v("description", app?.description)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <SubmitButton pendingText={tc("loading")}>{app ? tc("save") : tc("create")}</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Upload a new version (chunked and resumable, so a big installer survives
 * venue wifi): optional label and notes, then pick or drop the file.
 * Tools take one .html file.
 */
export function AppVersionUploader({ appId, kind }: { appId: string; kind: "file" | "tool" }) {
  const t = useTranslations("apps");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<{ name: string; size: number; done: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const run = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setProgress({ name: file.name, size: file.size, done: 0 });
    try {
      const { fileId } = await uploadFile(file, (done) => setProgress({ name: file.name, size: file.size, done }));
      const r = await addAppVersion({ appId, fileId, label: label || undefined, notes: notes || undefined });
      if (!r.ok) throw new Error(r.error);
      setLabel("");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-md border border-dashed p-3 text-sm ${dragging ? "border-foreground bg-muted/50" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void run(e.dataTransfer.files[0]);
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="ver-label" label={t("versionLabel")} optional help={t("versionLabelHelp")}>
          <Input id="ver-label" value={label} onChange={(e) => setLabel(e.target.value)} disabled={Boolean(progress)} />
        </Field>
        <Field id="ver-notes" label={t("versionNotes")} optional>
          <Input id="ver-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={Boolean(progress)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={kind === "tool" ? ".html,.htm,text/html" : undefined}
          aria-label={t("uploadVersion")}
          onChange={(e) => void run(e.target.files?.[0])}
        />
        <Button type="button" size="sm" variant="outline" disabled={Boolean(progress)} onClick={() => inputRef.current?.click()}>
          {t("uploadVersion")}
        </Button>
        <span className="text-xs text-muted-foreground">{kind === "tool" ? t("toolFileHelp") : t("dropHere")}</span>
      </div>
      {progress && (
        <p className="flex items-center gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate">{progress.name}</span>
          <span className="text-muted-foreground">
            {formatBytes(progress.done)} / {formatBytes(progress.size)}
          </span>
          <span className="h-1.5 w-32 overflow-hidden rounded bg-muted">
            <span className="block h-full bg-foreground transition-all" style={{ width: `${progress.size ? Math.round((progress.done / progress.size) * 100) : 0}%` }} />
          </span>
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
