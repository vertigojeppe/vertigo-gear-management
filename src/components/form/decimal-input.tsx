import { Input } from "@/components/ui/input";

/**
 * A text box for numbers with decimals that takes a comma as well as a
 * point ("12,5"). A `type="number"` box drops a comma in browsers set to
 * English, so this is plain text with the phone's decimal keypad; the
 * server reads it with `decimalText` (`optionalNumber`, `decimal`), and
 * the zod schema checks the range.
 */
export function DecimalInput(props: Omit<React.ComponentProps<typeof Input>, "type" | "inputMode" | "min" | "max" | "step">) {
  return <Input type="text" inputMode="decimal" autoComplete="off" spellCheck={false} {...props} />;
}
