"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Previous / next between a plan's pictures on the document page (the
 * markup viewer stays), also on the ← / → keys while nothing is being typed.
 */
export function DocumentStepper({ prevHref, nextHref, position, total, labels }: { prevHref: string; nextHref: string; position: number; total: number; labels: { previous: string; next: string; unsaved: string } }) {
  const router = useRouter();
  const mayLeave = () => !document.querySelector("[data-unsaved]") || window.confirm(labels.unsaved);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || el?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (mayLeave()) router.push(e.key === "ArrowLeft" ? prevHref : nextHref);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="flex items-center gap-2 text-sm">
      <Link href={prevHref} onClick={(e) => !mayLeave() && e.preventDefault()} className={buttonVariants({ variant: "outline", size: "icon-sm" })} aria-label={labels.previous}>
        <ChevronLeft />
      </Link>
      <span className="tabular-nums text-muted-foreground">
        {position} / {total}
      </span>
      <Link href={nextHref} onClick={(e) => !mayLeave() && e.preventDefault()} className={buttonVariants({ variant: "outline", size: "icon-sm" })} aria-label={labels.next}>
        <ChevronRight />
      </Link>
    </div>
  );
}
