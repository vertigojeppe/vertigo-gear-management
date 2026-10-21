import { prisma } from "@/lib/db";
import { bestMatches } from "@/lib/search";
import type { AppKind } from "../../../config/app.config";
import type { AppFilters } from "./schema";

export type AppVersionRow = { id: string; label: string | null; notes: string | null; createdAt: Date; uploadedBy: string | null; file: { id: string; name: string; size: number; mimeType: string } };

export type AppRow = {
  id: string;
  name: string;
  kind: AppKind;
  category: string | null;
  description: string | null;
  url: string | null;
  archived: boolean;
  updatedAt: Date;
  /** Newest version first; empty for links and for files not uploaded yet. */
  latest: AppVersionRow | null;
  versionCount: number;
};

const versionInclude = { file: { select: { id: true, name: true, size: true, mimeType: true } }, uploadedBy: { select: { name: true } } } as const;

type VersionRecord = { id: string; label: string | null; notes: string | null; createdAt: Date; uploadedBy: { name: string } | null; file: AppVersionRow["file"] };
const toVersion = (v: VersionRecord): AppVersionRow => ({ id: v.id, label: v.label, notes: v.notes, createdAt: v.createdAt, uploadedBy: v.uploadedBy?.name ?? null, file: v.file });

/** The list, searched forgivingly (name, category, description), newest version per app. Categories are grouped on the page. */
export async function appList(filters: AppFilters): Promise<{ rows: AppRow[]; closeMatches: boolean; categories: string[] }> {
  const rows = await prisma.app.findMany({
    where: { archived: filters.archived ? undefined : false, kind: filters.kind },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { versions: { orderBy: { createdAt: "desc" }, take: 1, include: versionInclude }, _count: { select: { versions: true } } },
  });
  const found = bestMatches(rows, (a) => [a.name, a.category, a.description], filters.q);
  const categories = [...new Set((await prisma.app.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ["category"] })).map((a) => a.category!))].sort((a, b) => a.localeCompare(b));
  return {
    rows: found.rows.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind as AppKind,
      category: a.category,
      description: a.description,
      url: a.url,
      archived: a.archived,
      updatedAt: a.updatedAt,
      latest: a.versions[0] ? toVersion(a.versions[0]) : null,
      versionCount: a._count.versions,
    })),
    closeMatches: found.close,
    categories,
  };
}

export async function appDetail(id: string) {
  const a = await prisma.app.findUnique({ where: { id }, include: { createdBy: { select: { name: true } }, versions: { orderBy: { createdAt: "desc" }, include: versionInclude } } });
  if (!a) return null;
  const versions = a.versions.map(toVersion);
  return {
    app: { id: a.id, name: a.name, kind: a.kind as AppKind, category: a.category, description: a.description, url: a.url, archived: a.archived, createdAt: a.createdAt, updatedAt: a.updatedAt, createdBy: a.createdBy?.name ?? null },
    versions,
    latest: versions[0] ?? null,
  };
}

/** The tool HTML for /api/apps/versions/[id]/run: only versions of tool apps. */
export async function toolVersionFile(versionId: string) {
  const v = await prisma.appVersion.findUnique({ where: { id: versionId }, include: { app: { select: { kind: true } }, file: { select: { id: true } } } });
  return v && v.app.kind === "tool" ? v.file.id : null;
}
