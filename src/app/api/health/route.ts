import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Liveness + database check for the container healthcheck and uptime monitors. No auth, no details. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
