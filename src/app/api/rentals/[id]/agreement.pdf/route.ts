import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { can, getActor } from "@/lib/auth/session";
import { quoteFor, renderQuote } from "@/modules/pricing";

/** Rental agreement as PDF: the priced lines plus signature boxes. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor || !can(actor.role, "rentals.read")) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const quote = await quoteFor("rental", id);
  if (!quote) return new NextResponse("Not found", { status: 404 });
  const t = await getTranslations("pricing");
  const pdf = await renderQuote(quote, { kind: "agreement", title: t("agreementTitle"), terms: [quote.terms ?? t("defaultTerms"), t("agreementTerms")].join("\n"), labels: { day: t("dayWord"), days: t("daysWord") } });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="rental-${quote.holder.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${quote.window?.from ?? ""}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
