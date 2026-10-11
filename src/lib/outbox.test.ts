import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { processOutbox, registerOutboxHandler, signBody } from "./outbox";

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

  it("signs bodies with HMAC-SHA256", () => {
    expect(signBody("secret", '{"a":1}')).toMatch(/^[a-f0-9]{64}$/);
    expect(signBody("secret", "x")).not.toBe(signBody("other", "x"));
  });
});
