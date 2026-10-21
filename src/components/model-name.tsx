import { cn } from "cn";
import { modelLabel } from "@/lib/format";

/**
 * A model on screen: name and size first ("Pointe", "DMX 5-pin 5 m"), the
 * manufacturer small and grey after it. Text-only places (PDFs, packing
 * lists, the calendar) use modelLabel without the manufacturer;
 * dropdown options use modelLabelWithMaker.
 */
export function ModelName({ model, maker, className }: { model: { manufacturer?: string | null; name: string; variant?: string | null }; maker?: string; className?: string }) {
  const shown = (maker ?? model.manufacturer ?? "").trim();
  return (
    <span className={className}>
      {modelLabel(model)}
      {shown && (
        <>
          {" "}
          <span className={cn("ml-1 text-[0.85em] font-normal text-muted-foreground")}>{shown}</span>
        </>
      )}
    </span>
  );
}
