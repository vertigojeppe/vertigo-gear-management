import { NextResponse, type NextRequest } from "next/server";
import { can, getActor } from "@/lib/auth/session";
import { FileError, uploads } from "@/modules/files";

/** All chunks are in: create the File row. Returns { fileId, name, mimeType, size }. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor || !can(actor.role, "files.write")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await uploads.complete(actor, id));
  } catch (err) {
    if (err instanceof FileError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
