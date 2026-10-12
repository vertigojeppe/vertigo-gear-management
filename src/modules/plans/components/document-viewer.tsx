"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MARKUP_COLORS, MARKUP_TOOLS, type MarkupTool } from "../../../../config/app.config";
import { saveMarkup } from "../actions";
import { MarkupLayer, type Shape } from "./markup-layer";

const PdfViewer = dynamic(() => import("./pdf-viewer").then((m) => m.PdfViewer), { ssr: false });
const ModelViewer = dynamic(() => import("./model-viewer").then((m) => m.ModelViewer), { ssr: false });

export type ViewerVersion = { id: string; url: string; name: string; mimeType: string; markups: { page: number; shapes: Shape[] }[] };

/**
 * Picks the viewer for a document version and, for images and PDFs, puts
 * the markup layer with its toolbar on top.
 */
export function DocumentViewer({ kind, version, canEdit, userId, mtlUrl, previewUrl }: { kind: string; version: ViewerVersion; canEdit: boolean; userId: string; mtlUrl?: string | null; previewUrl?: string | null }) {
  const t = useTranslations("plans");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tool, setTool] = useState<MarkupTool>("select");
  const [color, setColor] = useState<string>(MARKUP_COLORS[0]);
  const [byPage, setByPage] = useState<Record<number, Shape[]>>(() => Object.fromEntries(version.markups.map((m) => [m.page, m.shapes])));
  const [dirty, setDirty] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const imgRef = useRef<HTMLImageElement>(null);
  // Size the markup layer from the rendered image. A ResizeObserver fires on
  // observe, so a cached image that finished before hydration is covered too.
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const ro = new ResizeObserver(() => {
      if (img.clientWidth > 0) setSize({ width: img.clientWidth, height: img.clientHeight });
    });
    ro.observe(img);
    return () => ro.disconnect();
  }, [version.url, kind]);

  const shapes = byPage[page] ?? [];
  const setShapes = (s: Shape[]) => {
    setByPage((m) => ({ ...m, [page]: s }));
    setDirty((d) => ({ ...d, [page]: true }));
    setSaved(false);
  };
  const undo = () => {
    const idx = [...shapes].reverse().findIndex((s) => !s.authorId || s.authorId === userId);
    if (idx === -1) return;
    const i = shapes.length - 1 - idx;
    setShapes([...shapes.slice(0, i), ...shapes.slice(i + 1)]);
  };
  const save = () => {
    setError(null);
    start(async () => {
      const r = await saveMarkup({ versionId: version.id, page, shapes });
      if (!r.ok) setError(r.error ?? "Could not save.");
      else {
        setByPage((m) => ({ ...m, [page]: r.shapes ?? shapes }));
        setDirty((d) => ({ ...d, [page]: false }));
        setSaved(true);
      }
    });
  };

  const markupable = kind === "image" || kind === "pdf";
  const toolbar = markupable && canEdit && (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {MARKUP_TOOLS.map((tl) => (
        <button key={tl} type="button" onClick={() => setTool(tl)} aria-pressed={tool === tl} className={`rounded border px-2 py-1 ${tool === tl ? "bg-foreground text-background" : ""}`}>
          {t(`tool_${tl}` as "tool_select")}
        </button>
      ))}
      <span className="flex items-center gap-1" aria-label={t("color")}>
        {MARKUP_COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} className={`size-6 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
        ))}
      </span>
      <Button type="button" size="sm" variant="ghost" onClick={undo} disabled={shapes.length === 0}>
        {t("undo")}
      </Button>
      <Button type="button" size="sm" onClick={save} disabled={!dirty[page] || pending}>
        {pending ? t("saving") : t("saveMarkup")}
      </Button>
      {saved && !dirty[page] && <span className="text-xs text-muted-foreground">{t("markupSaved")}</span>}
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );

  if (kind === "image") {
    return (
      <div className="flex flex-col gap-3">
        {toolbar}
        <div className="relative inline-block max-w-full self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={version.url} alt={version.name} className="block max-h-[75vh] max-w-full" draggable={false} />
          {size.width > 0 && <MarkupLayer width={size.width} height={size.height} shapes={shapes} onChange={setShapes} tool={tool} color={color} readOnly={!canEdit} promptText={t("textPrompt")} />}
        </div>
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button type="button" size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            {t("prevPage")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("pageOf", { page, pages })}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>
            {t("nextPage")}
          </Button>
        </div>
        {toolbar}
        <PdfViewer url={version.url} page={page} onPages={setPages} onRendered={setSize}>
          {size.width > 0 && <MarkupLayer width={size.width} height={size.height} shapes={shapes} onChange={setShapes} tool={tool} color={color} readOnly={!canEdit} promptText={t("textPrompt")} />}
        </PdfViewer>
      </div>
    );
  }

  if (kind === "model3d") {
    const ext = version.name.split(".").pop()?.toLowerCase() ?? "";
    return <ModelViewer url={version.url} ext={ext} mtlUrl={mtlUrl} labels={{ measure: t("measure"), measureHint: t("measureHint"), resetView: t("resetView"), loading: t("loadingModel"), distance: t("distance"), failed: t("modelFailed") }} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={version.name} className="max-h-[60vh] max-w-full rounded-md border" />
      ) : (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("noViewer")}</p>
      )}
      <p className="text-xs text-muted-foreground">{t("nativeHint")}</p>
    </div>
  );
}
