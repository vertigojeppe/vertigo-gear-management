"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

/**
 * Renders one PDF page to a canvas, sized to the container width. Reports
 * page count and the rendered size so a markup layer can sit on top.
 */
export function PdfViewer({ url, page, onPages, onRendered, children }: { url: string; page: number; onPages: (n: number) => void; onRendered: (size: { width: number; height: number }) => void; children?: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      try {
        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        onPages(doc.numPages);
        const pdfPage = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
        if (cancelled) return;
        const boxWidth = boxRef.current?.clientWidth ?? 800;
        const base = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(boxWidth / base.width, 2);
        const viewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current!;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const ctx = canvas.getContext("2d")!;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        const render = pdfPage.render({ canvasContext: ctx, viewport, canvas });
        task = render;
        await render.promise;
        if (cancelled) return;
        const s = { width: Math.floor(viewport.width), height: Math.floor(viewport.height) };
        setSize(s);
        onRendered(s);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-render on url/page only; callbacks are stable enough
  }, [url, page]);

  return (
    <div ref={boxRef} className="w-full">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="relative inline-block max-w-full bg-white shadow" style={{ width: size.width || undefined, height: size.height || undefined }}>
        <canvas ref={canvasRef} className="block max-w-full" />
        {children}
      </div>
    </div>
  );
}
