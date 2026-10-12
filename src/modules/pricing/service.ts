import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { assertCan } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import type { RateExtraRule } from "../../../config/app.config";
import type { RateTier } from "./engine";
import type { ExtraLineInput, QuoteSettingsInput, RateTableInput } from "./schema";

export class PricingError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "PricingError";
  }
}

export type HolderKind = "project" | "rental";
export type Holder = { kind: HolderKind; id: string };

const num = (v: { toNumber(): number } | number | null | undefined): number | null => (v === null || v === undefined ? null : typeof v === "number" ? v : v.toNumber());

export type RateTableDto = {
  id: string;
  name: string;
  isDefault: boolean;
  extraRule: RateExtraRule;
  extraFactor: number;
  notes: string | null;
  tiers: RateTier[];
  createdAt: Date;
  updatedAt: Date;
};

type TableRow = NonNullable<Awaited<ReturnType<typeof prisma.rateTable.findUnique<{ where: { id: string }; include: { tiers: true } }>>>>;

export function toRateTableDto(t: TableRow): RateTableDto {
  return {
    id: t.id,
    name: t.name,
    isDefault: t.isDefault,
    extraRule: t.extraRule as RateExtraRule,
    extraFactor: num(t.extraFactor) ?? 0,
    notes: t.notes,
    tiers: [...t.tiers].sort((a, b) => a.days - b.days).map((x) => ({ days: x.days, factor: num(x.factor) ?? 0 })),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

const permissionFor = (kind: HolderKind): "projects.write" | "rentals.write" => (kind === "project" ? "projects.write" : "rentals.write");
const where = (h: Holder) => (h.kind === "project" ? { projectId: h.id } : { rentalId: h.id });

/* ------------------------------------------------------------------------ */
/* Rate tables                                                              */
/* ------------------------------------------------------------------------ */

export const rateTables = {
  async list(): Promise<RateTableDto[]> {
    const rows = await prisma.rateTable.findMany({ include: { tiers: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
    return rows.map(toRateTableDto);
  },

  async get(id: string): Promise<RateTableDto | null> {
    const t = await prisma.rateTable.findUnique({ where: { id }, include: { tiers: true } });
    return t ? toRateTableDto(t) : null;
  },

  /** The table used when a project or rental has none chosen (the default, else the first). */
  async fallback(): Promise<RateTableDto | null> {
    const t = (await prisma.rateTable.findFirst({ where: { isDefault: true }, include: { tiers: true } })) ?? (await prisma.rateTable.findFirst({ include: { tiers: true }, orderBy: { createdAt: "asc" } }));
    return t ? toRateTableDto(t) : null;
  },

  async create(actor: Actor, input: RateTableInput, tiers: RateTier[]): Promise<RateTableDto> {
    assertCan(actor, "settings.manage");
    if (await prisma.rateTable.findFirst({ where: { name: { equals: input.name, mode: "insensitive" } } })) throw new PricingError("A rate table with that name already exists.", "name");
    const count = await prisma.rateTable.count();
    const t = await prisma.$transaction(async (tx) => {
      const makeDefault = input.isDefault || count === 0;
      if (makeDefault) await tx.rateTable.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      const row = await tx.rateTable.create({
        data: { name: input.name, isDefault: makeDefault, extraRule: input.extraRule, extraFactor: input.extraFactor ?? 0, notes: input.notes ?? null, tiers: { create: tiers } },
        include: { tiers: true },
      });
      await logActivity(actor, { entityType: "settings", entityId: row.id, action: "rate_table_created", summary: `Created rate table ${row.name} (${tiers.length} tiers)` }, tx);
      return row;
    });
    return toRateTableDto(t);
  },

  async update(actor: Actor, id: string, input: RateTableInput, tiers: RateTier[]): Promise<RateTableDto> {
    assertCan(actor, "settings.manage");
    const clash = await prisma.rateTable.findFirst({ where: { id: { not: id }, name: { equals: input.name, mode: "insensitive" } } });
    if (clash) throw new PricingError("A rate table with that name already exists.", "name");
    const t = await prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.rateTable.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
      const current = await tx.rateTable.findUniqueOrThrow({ where: { id } });
      // The default cannot be switched off directly; another table takes over by being made the default.
      const isDefault = input.isDefault || current.isDefault;
      await tx.rateTier.deleteMany({ where: { rateTableId: id } });
      const row = await tx.rateTable.update({
        where: { id },
        data: { name: input.name, isDefault, extraRule: input.extraRule, extraFactor: input.extraFactor ?? 0, notes: input.notes ?? null, tiers: { create: tiers } },
        include: { tiers: true },
      });
      await logActivity(actor, { entityType: "settings", entityId: id, action: "rate_table_updated", summary: `Updated rate table ${row.name} (${tiers.length} tiers)` }, tx);
      return row;
    });
    return toRateTableDto(t);
  },

  async remove(actor: Actor, id: string): Promise<void> {
    assertCan(actor, "settings.manage");
    const t = await prisma.rateTable.findUniqueOrThrow({ where: { id }, include: { _count: { select: { projects: true, rentals: true } } } });
    if (t.isDefault) throw new PricingError("Make another table the default before deleting this one.");
    if (t._count.projects + t._count.rentals > 0) throw new PricingError(`${t.name} is used by ${t._count.projects} projects and ${t._count.rentals} rentals.`);
    await prisma.rateTable.delete({ where: { id } });
    await logActivity(actor, { entityType: "settings", entityId: id, action: "rate_table_deleted", summary: `Deleted rate table ${t.name}` });
  },
};

/* ------------------------------------------------------------------------ */
/* Quote settings and extra lines on a project or a rental                  */
/* ------------------------------------------------------------------------ */

export const quotes = {
  async setSettings(actor: Actor, holder: Holder, input: QuoteSettingsInput): Promise<void> {
    assertCan(actor, permissionFor(holder.kind));
    if (input.rateTableId && !(await prisma.rateTable.findUnique({ where: { id: input.rateTableId } }))) throw new PricingError("Rate table not found.", "rateTableId");
    const data = { rateTableId: input.rateTableId ?? null, chargeDays: input.chargeDays ?? null, discountPct: input.discountPct ?? null, terms: input.terms ?? null };
    if (holder.kind === "project") await prisma.project.update({ where: { id: holder.id }, data });
    else await prisma.rental.update({ where: { id: holder.id }, data });
    await logActivity(actor, {
      entityType: holder.kind,
      entityId: holder.id,
      action: "quote_settings",
      summary: `Quote settings: ${input.rateTableId ? "rate table chosen" : "default rate table"}${input.chargeDays ? `, ${input.chargeDays} charge days` : ""}${input.discountPct ? `, ${input.discountPct}% discount` : ""}`,
    });
  },
};

export const extraLines = {
  async add(actor: Actor, holder: Holder, input: ExtraLineInput) {
    assertCan(actor, permissionFor(holder.kind));
    const last = await prisma.extraLine.findFirst({ where: where(holder), orderBy: { sortOrder: "desc" } });
    const row = await prisma.extraLine.create({ data: { ...where(holder), description: input.description, quantity: input.quantity, unitPrice: input.unitPrice, discountPct: input.discountPct ?? null, sortOrder: (last?.sortOrder ?? 0) + 1 } });
    await logActivity(actor, { entityType: holder.kind, entityId: holder.id, action: "extra_line_added", summary: `Added line ${input.quantity}× ${input.description} (${input.unitPrice})` });
    return row;
  },

  async update(actor: Actor, holder: Holder, lineId: string, input: ExtraLineInput) {
    assertCan(actor, permissionFor(holder.kind));
    const existing = await prisma.extraLine.findUniqueOrThrow({ where: { id: lineId } });
    if ((holder.kind === "project" ? existing.projectId : existing.rentalId) !== holder.id) throw new PricingError("Line not found.");
    const row = await prisma.extraLine.update({ where: { id: lineId }, data: { description: input.description, quantity: input.quantity, unitPrice: input.unitPrice, discountPct: input.discountPct ?? null } });
    await logActivity(actor, { entityType: holder.kind, entityId: holder.id, action: "extra_line_updated", summary: `Updated line ${input.quantity}× ${input.description}` });
    return row;
  },

  async remove(actor: Actor, holder: Holder, lineId: string) {
    assertCan(actor, permissionFor(holder.kind));
    const existing = await prisma.extraLine.findUniqueOrThrow({ where: { id: lineId } });
    if ((holder.kind === "project" ? existing.projectId : existing.rentalId) !== holder.id) throw new PricingError("Line not found.");
    await prisma.extraLine.delete({ where: { id: lineId } });
    await logActivity(actor, { entityType: holder.kind, entityId: holder.id, action: "extra_line_removed", summary: `Removed line ${existing.description}` });
  },
};
