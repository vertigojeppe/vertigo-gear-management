import { NextResponse, type NextRequest } from "next/server";
import { buildOpenApiDocument } from "@/lib/api/openapi";
import { publicOrigin } from "@/lib/request-origin";

export function GET(req: NextRequest) {
  const base = publicOrigin(req);
  return NextResponse.json(buildOpenApiDocument(base));
}
