import type { PrismaClient } from "../../src/generated/prisma/client";

/**
 * The three rate tables from the `lejefaktor` sheet (see MIGRATION.md).
 * Standard is the default. Re-runnable: tables are matched by name and
 * their tiers replaced, so editing a factor in the sheet and re-seeding
 * updates the demo database; tables added in the app are left alone.
 */
export const RATE_TABLE_SEED: { name: string; isDefault: boolean; extraRule: "none" | "per_day" | "per_10_days"; extraFactor: number; notes: string; tiers: { days: number; factor: number }[] }[] = [
  {
    name: "Standard",
    isDefault: true,
    extraRule: "per_day",
    extraFactor: 0.1,
    notes: "Vertigo lejefaktor standard. 5–7 days share the 2.7 factor; every day after 30 adds 10% of the day-1 price.",
    tiers: [
      { days: 1, factor: 1 },
      { days: 2, factor: 1.5 },
      { days: 3, factor: 2 },
      { days: 4, factor: 2.4 },
      { days: 5, factor: 2.7 },
      { days: 10, factor: 3.6 },
      { days: 14, factor: 4.2 },
      { days: 21, factor: 5.5 },
      { days: 30, factor: 6.5 },
    ],
  },
  {
    name: "Theatre",
    isDefault: false,
    extraRule: "per_10_days",
    extraFactor: 0.5,
    notes: "Ny teater lejefaktor: meant for rentals of 14 days and more. The 1-day factor 0.5 is the base and is not used on its own. +0.5 per started 10 days after 30 days (6 months = 10.8).",
    tiers: [
      { days: 1, factor: 0.5 },
      { days: 14, factor: 2.1 },
      { days: 21, factor: 2.8 },
      { days: 30, factor: 3.3 },
    ],
  },
  {
    name: "Revised",
    isDefault: false,
    extraRule: "per_10_days",
    extraFactor: 0.5,
    notes: "Revideret lejefaktor. The sheet has two copies that differ at 30 days (3.3 and 3.4); 3.3 is used because the +0.5 per 10 days series on the sheet continues from it.",
    tiers: [
      { days: 1, factor: 1 },
      { days: 2, factor: 1.5 },
      { days: 3, factor: 1.7 },
      { days: 5, factor: 1.9 },
      { days: 7, factor: 2.1 },
      { days: 10, factor: 2.3 },
      { days: 14, factor: 2.6 },
      { days: 21, factor: 3 },
      { days: 30, factor: 3.3 },
    ],
  },
];

export async function seedPricing(prisma: PrismaClient): Promise<number> {
  let n = 0;
  for (const t of RATE_TABLE_SEED) {
    const existing = await prisma.rateTable.findFirst({ where: { name: t.name } });
    const data = { name: t.name, isDefault: t.isDefault, extraRule: t.extraRule, extraFactor: t.extraFactor, notes: t.notes, importSource: "lejefaktor!A1" };
    const row = existing ? await prisma.rateTable.update({ where: { id: existing.id }, data }) : await prisma.rateTable.create({ data });
    await prisma.rateTier.deleteMany({ where: { rateTableId: row.id } });
    await prisma.rateTier.createMany({ data: t.tiers.map((x) => ({ rateTableId: row.id, days: x.days, factor: x.factor })) });
    n++;
  }
  // Exactly one default.
  const def = await prisma.rateTable.findFirst({ where: { isDefault: true }, orderBy: { createdAt: "asc" } });
  if (def) await prisma.rateTable.updateMany({ where: { isDefault: true, id: { not: def.id } }, data: { isDefault: false } });
  return n;
}
