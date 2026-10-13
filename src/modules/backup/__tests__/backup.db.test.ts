import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { backup } from "../service";
import { TABLES } from "../tables";

/**
 * The export is checked against the live table counts. The restore
 * round-trip replaces the whole database with its own export inside one
 * transaction; it runs only when BACKUP_RESTORE_TEST=1 (CI sets it on its
 * throwaway database) so a developer's data is never touched by accident.
 */
const admin: Actor = { id: "", email: "", name: "Test Admin", role: "admin" };

describe("backup", () => {
  it("exports every table with its row count", async () => {
    admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
    // Counts are taken before and after: the outbox worker and other sessions may insert rows meanwhile.
    const count = (t: (typeof TABLES)[number]) => (prisma as unknown as Record<string, { count(): Promise<number> }>)[t.delegate].count();
    const before = Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t.name, await count(t)])));
    const file = await backup.export(admin);
    const after = Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t.name, await count(t)])));
    expect(file.version).toBe(1);
    for (const t of TABLES) {
      const n = file.tables[t.name]?.length ?? -1;
      expect(n, t.name).toBeGreaterThanOrEqual(Math.min(before[t.name], after[t.name]));
      expect(n, t.name).toBeLessThanOrEqual(Math.max(before[t.name], after[t.name]));
    }
    await expect(backup.export({ ...admin, role: "member" })).rejects.toThrow();
  });

  it.skipIf(process.env.BACKUP_RESTORE_TEST !== "1")("restores its own export to an identical database", async () => {
    admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
    const before = await backup.export(admin);
    const counts = Object.fromEntries(Object.entries(before.tables).map(([k, v]) => [k, v.length]));
    const roundTrip = JSON.parse(JSON.stringify(before)); // dates and decimals as strings, like an uploaded file
    const result = await backup.restore(admin, roundTrip);
    expect(result.tables).toBe(TABLES.length);
    const after = await backup.export(admin);
    for (const t of TABLES) {
      if (t.name === "ActivityLog") expect(after.tables[t.name].length).toBe(counts[t.name] + 1); // the restore itself is logged
      else expect(after.tables[t.name].length, t.name).toBe(counts[t.name]);
    }
    const item = before.tables.Item[0] as { id: string; assetTag: string };
    if (item) expect((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).assetTag).toBe(item.assetTag);
  });
});
