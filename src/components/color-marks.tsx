import { colorHex, needsOutline } from "@/lib/colors";
import { cn } from "cn";

/** Thin vertical bar in a category's colour; renders nothing without one. */
export function ColorBar({ color, className }: { color: string | null | undefined; className?: string }) {
  const hex = colorHex(color);
  if (!hex) return null;
  return <span aria-hidden className={cn("w-1 shrink-0 self-stretch rounded-full", needsOutline(color) && "ring-1 ring-border", className)} style={{ backgroundColor: hex }} />;
}

/** Small round dot in a tape colour (cable lengths); renders nothing without one. */
export function ColorDot({ color, title, className }: { color: string | null | undefined; title?: string; className?: string }) {
  const hex = colorHex(color);
  if (!hex) return null;
  return <span role={title ? "img" : undefined} aria-label={title} title={title} className={cn("inline-block size-2.5 shrink-0 rounded-full align-middle", needsOutline(color) && "ring-1 ring-border", className)} style={{ backgroundColor: hex }} />;
}
