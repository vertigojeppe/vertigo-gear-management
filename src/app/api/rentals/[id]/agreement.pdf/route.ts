import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { rentalDetail, renderAgreement } from "@/modules/rentals";

/** Rental agreement as PDF. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor || !can(actor.role, "rentals.read")) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const detail = await rentalDetail(id);
  if (!detail) return new NextResponse("Not found", { status: 404 });
  const pdf = await renderAgreement(detail);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="rental-${detail.client.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${detail.rental.startDate}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
