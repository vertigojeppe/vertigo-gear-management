import { NextResponse, type NextRequest } from "next/server";
import { can, getActor } from "@/lib/auth/session";
import { FileError, uploads } from "@/modules/files";

type Ctx = { params: Promise<{ id: string }> };

async function actorOr401() {
  const actor = await getActor();
  if (!actor || !can(actor.role, "files.write")) return null;
  return actor;
}

function fail(err: unknown) {
  if (err instanceof FileError) return NextResponse.json({ error: err.message }, { status: 409 });
  throw err;
}

/** Where did the upload get to? The client resumes from `received`. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const actor = await actorOr401();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await uploads.status(actor, id));
  } catch (err) {
    return fail(err);
  }
}

/** Append one chunk. Body is the raw bytes; ?offset= must equal bytes received so far. */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const actor = await actorOr401();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? "NaN");
  if (!Number.isInteger(offset) || offset < 0) return NextResponse.json({ error: "Bad offset" }, { status: 400 });
  const chunk = Buffer.from(await req.arrayBuffer());
  try {
    return NextResponse.json(await uploads.appendChunk(actor, id, offset, chunk));
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const actor = await actorOr401();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await uploads.abandon(actor, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
