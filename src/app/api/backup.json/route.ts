import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { backup } from "@/modules/backup";

/** Whole-database backup as a JSON download (admin). Files on the uploads volume are not inside. */
export async function GET() {
  const actor = await getActor();
  if (!actor || !can(actor.role, "users.manage")) return new NextResponse("Unauthorized", { status: 401 });
  const data = await backup.export(actor);
  const stamp = data.exportedAt.replace(/[:T]/g, "-").slice(0, 16);
  return new NextResponse(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="vertigo-gear-backup-${stamp}.json"`, "Cache-Control": "no-store" },
  });
}
