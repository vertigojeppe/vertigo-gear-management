import { NextResponse, type NextRequest } from "next/server";
import { can, getActor } from "@/lib/auth/session";
import { FileError, uploads } from "@/modules/files";

/** Start a resumable upload: { name, mimeType, size } → { id, chunkSize, size }. */
export async function POST(req: NextRequest) {
  const actor = await getActor();
  if (!actor || !can(actor.role, "files.write")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { name?: string; mimeType?: string; size?: number } | null;
  if (!body || typeof body.name !== "string" || typeof body.size !== "number") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  try {
    return NextResponse.json(await uploads.start(actor, { name: body.name, mimeType: String(body.mimeType ?? ""), size: body.size }));
  } catch (err) {
    if (err instanceof FileError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
