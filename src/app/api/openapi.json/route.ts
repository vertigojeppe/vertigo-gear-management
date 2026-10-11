import { NextResponse, type NextRequest } from "next/server";
import { buildOpenApiDocument } from "@/lib/api/openapi";

export function GET(req: NextRequest) {
  const base = (process.env.APP_URL ?? req.nextUrl.origin).replace(/\/$/, "");
  return NextResponse.json(buildOpenApiDocument(base));
}
