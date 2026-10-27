import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { processOutbox, pruneOutbox, registerOutboxHandler, signBody } from "./outbox";

const TYPE = `test.handler.${Date.now()}`;

beforeAll(() => {
  registerOutboxHandler(TYPE, async (payload) => {
    if (payload.fail === true) throw new Error("boom");
  });
});

afterAll(async () => {
  await prisma.outbox.deleteMany({ where: { type: TYPE } });
  await prisma.$disconnect();
});

describe("outbox", () => {
  it("processes due rows and marks them done", async () => {
    const row = await prisma.outbox.create({ data: { type: TYPE, payload: { fail: false } } });
    await processOutbox(50);
    const after = await prisma.outbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("done");
    expect(after.attempts).toBe(1);
  });

  it("retries failed rows with backoff and keeps the error", async () => {
    const row = await prisma.outbox.create({ data: { type: TYPE, payload: { fail: true } } });
    await processOutbox(50);
    const after = await prisma.outbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("pending");
    expect(after.attempts).toBe(1);
    expect(after.lastError).toContain("boom");
    expect(after.nextRunAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("fails rows with no handler", async () => {
    const row = await prisma.outbox.create({ data: { type: `${TYPE}.unknown`, payload: {} } });
    await processOutbox(50);
    const after = await prisma.outbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("failed");
    await prisma.outbox.delete({ where: { id: row.id } });
  });

  it("prunes delivered rows after the retention period, never failed ones", async () => {
    const old = new Date(Date.now() - 40 * 86_400_000);
    const [doneOld, doneNew, failedOld] = await Promise.all([
      prisma.outbox.create({ data: { type: TYPE, payload: {}, status: "done", updatedAt: old } }),
      prisma.outbox.create({ data: { type: TYPE, payload: {}, status: "done" } }),
      prisma.outbox.create({ data: { type: TYPE, payload: {}, status: "failed", updatedAt: old } }),
    ]);
    expect(await pruneOutbox()).toBeGreaterThanOrEqual(1);
    const left = await prisma.outbox.findMany({ where: { id: { in: [doneOld.id, doneNew.id, failedOld.id] } }, select: { id: true } });
    expect(left.map((r) => r.id).sort()).toEqual([doneNew.id, failedOld.id].sort());
  });

  it("signs bodies with HMAC-SHA256", () => {
    expect(signBody("secret", '{"a":1}')).toMatch(/^[a-f0-9]{64}$/);
    expect(signBody("secret", "x")).not.toBe(signBody("other", "x"));
  });
});
