import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ForbiddenError, type Actor } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import type { Permission } from "../../../config/app.config";
import { apiActor } from "./auth";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) return json({ error: err.message, details: err.details }, { status: err.status });
  if (err instanceof z.ZodError) {
    return json({ error: "Validation failed", details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 422 });
  }
  if (err instanceof ForbiddenError) return json({ error: "Forbidden" }, { status: 403 });
  if (err && typeof err === "object" && "name" in err) {
    const e = err as { name: string; message: string; field?: string; code?: string };
    if (e.code === "P2025") return json({ error: "Not found" }, { status: 404 });
    if (e.name.endsWith("Error") && e.name !== "Error" && !e.name.startsWith("Prisma")) {
      return json({ error: e.message, field: e.field }, { status: 400 });
    }
  }
  console.error(err);
  return json({ error: "Internal error" }, { status: 500 });
}

/**
 * Wrap a route handler: authenticates, checks a permission, maps errors.
 * `ctx.params` is awaited and passed as plain object.
 */
export function handler<P extends Record<string, string> = Record<string, string>>(
  permission: Permission | null,
  fn: (req: NextRequest, actor: Actor, params: P) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      const actor = await apiActor(req);
      if (!actor) throw new ApiError(401, "Unauthorized");
      if (permission && !can(actor.role, permission)) throw new ApiError(403, "Forbidden");
      return await fn(req, actor, await ctx.params);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readJson<S extends z.ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Body must be JSON");
  }
  return schema.parse(body);
}

export function queryObject(req: NextRequest): Record<string, string> {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}

export function notFound(): never {
  throw new ApiError(404, "Not found");
}
