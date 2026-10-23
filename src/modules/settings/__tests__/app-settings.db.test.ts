import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/auth/session";
import { appSettings } from "../app-settings";

/** Settings › Layout against the dev database; the row as it was is put back afterwards. */
const admin: Actor = { id: "", email: "", name: "Alex Admin", role: "admin" };
const member: Actor = { id: "", email: "", name: "Mette Member", role: "member" };
let before: { value: unknown } | null = null;

beforeAll(async () => {
  admin.id = (await prisma.user.findFirst({ where: { role: "admin" } }))?.id ?? "";
  before = await prisma.appSetting.findUnique({ where: { key: "layout" } });
  await prisma.appSetting.deleteMany({ where: { key: "layout" } });
});

afterAll(async () => {
  await prisma.appSetting.deleteMany({ where: { key: "layout" } });
  if (before) await prisma.appSetting.create({ data: { key: "layout", value: before.value as string } });
  await prisma.activityLog.deleteMany({ where: { entityType: "settings", entityId: "layout", action: "layout_changed", userId: admin.id, createdAt: { gte: started } } });
});
const started = new Date();

describe("appSettings.layout", () => {
  it("is roomy until an admin chooses otherwise", async () => {
    expect(await appSettings.layout()).toBe("roomy");
  });

  it("stores the admin's choice and logs it", async () => {
    expect(await appSettings.setLayout(admin, "compact")).toBe("compact");
    expect((await prisma.appSetting.findUniqueOrThrow({ where: { key: "layout" } })).value).toBe("compact");
    const log = await prisma.activityLog.findFirst({ where: { entityId: "layout", action: "layout_changed" }, orderBy: { createdAt: "desc" } });
    expect(log?.summary).toBe("Changed the page layout to compact");
  });

  it("refuses an unknown layout and anyone without settings.manage", async () => {
    await expect(appSettings.setLayout(admin, "huge")).rejects.toThrow("Choose a layout.");
    await expect(appSettings.setLayout(member, "roomy")).rejects.toThrow();
  });
});
