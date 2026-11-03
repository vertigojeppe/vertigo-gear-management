"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const OpenPhoto = createContext<(index: number) => void>(() => {});

/**
 * Shows a set of photos one at a time in a dialog: arrows, ← / → keys and a
 * swipe step through them without closing it. Wrap the grid in it and make
 * each picture a `PhotoButton`.
 */
export function PhotoViewer({ photos, children }: { photos: { url: string; name: string }[]; children: ReactNode }) {
  const tc = useTranslations("common");
  const [index, setIndex] = useState<number | null>(null);
  const swipeFrom = useRef<number | null>(null);
  const step = (by: number) => setIndex((i) => (i === null ? i : (i + by + photos.length) % photos.length));
  const photo = index === null ? null : photos[index];
  return (
    <OpenPhoto.Provider value={setIndex}>
      {children}
      <Dialog open={photo !== null} onOpenChange={(open) => !open && setIndex(null)}>
        <DialogContent
          className="flex h-[calc(100dvh-2rem)] flex-col sm:max-w-[calc(100vw-4rem)]"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") step(-1);
            if (e.key === "ArrowRight") step(1);
          }}
        >
          {photo && (
            <>
              <DialogTitle className="truncate pr-8">{photo.name}</DialogTitle>
              <div
                className="relative min-h-0 flex-1 touch-pan-y"
                onPointerDown={(e) => (swipeFrom.current = e.clientX)}
                onPointerUp={(e) => {
                  const dx = swipeFrom.current === null ? 0 : e.clientX - swipeFrom.current;
                  swipeFrom.current = null;
                  if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={photo.url} src={photo.url} alt={photo.name} className="size-full object-contain select-none" draggable={false} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="icon" onClick={() => step(-1)} disabled={photos.length < 2} aria-label={tc("previous")}>
                  <ChevronLeft />
                </Button>
                <span className="flex items-center gap-3 text-muted-foreground tabular-nums">
                  {index! + 1} / {photos.length}
                  <a href={photo.url} target="_blank" rel="noreferrer" aria-label={photo.name} className="hover:text-foreground">
                    <ExternalLink className="size-4" />
                  </a>
                </span>
                <Button variant="outline" size="icon" onClick={() => step(1)} disabled={photos.length < 2} aria-label={tc("next")}>
                  <ChevronRight />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </OpenPhoto.Provider>
  );
}

/** Opens photo `index` of the surrounding `PhotoViewer`. */
export function PhotoButton({ index, label, children }: { index: number; label: string; children: ReactNode }) {
  const open = useContext(OpenPhoto);
  return (
    <button type="button" onClick={() => open(index)} aria-label={label} className="block w-full cursor-zoom-in">
      {children}
    </button>
  );
}
