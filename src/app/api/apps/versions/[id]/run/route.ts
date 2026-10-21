import { NextResponse, type NextRequest } from "next/server";
import { can, getActor } from "@/lib/auth/session";
import { toolVersionFile } from "@/modules/apps";
import { files } from "@/modules/files";

/**
 * Serves a tool's HTML to signed-in users, always sandboxed: the CSP
 * `sandbox` directive (without allow-same-origin) gives the page an opaque
 * origin, so its scripts cannot read the app's cookies or call the API as
 * the user, whether it is framed by /apps/[id]/run or opened in a tab.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor || !can(actor.role, "apps.read")) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const fileId = await toolVersionFile(id);
  const file = fileId ? await files.open(fileId, false) : null;
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-modals allow-popups allow-downloads",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, no-cache",
    },
  });
}
