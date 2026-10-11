import "dotenv/config";
import { prisma } from "../src/lib/db";

/**
 * Removes what the browser tests leave behind in a dev database:
 * "Testlight" models/items, "e2e …" API tokens and their activity rows.
 * CI starts from a fresh database, so this is for local use:
 *   npm run db:clean-tests
 */
async function main() {
  const tokens = await prisma.apiToken.deleteMany({ where: { name: { startsWith: "e2e " } } });
  const models = await prisma.model.findMany({ where: { manufacturer: "Testlight" }, select: { id: true } });
  const ids = models.map((m) => m.id);
  const items = await prisma.item.findMany({ where: { modelId: { in: ids } }, select: { id: true } });
  await prisma.item.deleteMany({ where: { modelId: { in: ids } } });
  await prisma.model.deleteMany({ where: { id: { in: ids } } });
  const logs = await prisma.activityLog.deleteMany({
    where: {
      OR: [{ entityId: { in: [...ids, ...items.map((i) => i.id)] } }, { summary: { contains: "test-" } }, { summary: { contains: '"e2e ' } }],
    },
  });
  // Projects and rentals created by the browser tests (names/dates only they use).
  const testProjects = await prisma.project.findMany({ where: { name: { startsWith: "E2E show " } }, select: { id: true } });
  await prisma.location.deleteMany({ where: { projectId: { in: testProjects.map((p) => p.id) } } });
  const projects = await prisma.project.deleteMany({ where: { id: { in: testProjects.map((p) => p.id) } } });
  const rentals = await prisma.rental.deleteMany({ where: { startDate: { gte: new Date("2032-01-01T00:00:00Z") }, notes: null } });
  await prisma.outbox.deleteMany({ where: { status: { in: ["done", "failed"] } } });
  console.log(`Removed ${tokens.count} tokens, ${ids.length} models, ${items.length} items, ${logs.count} activity rows, ${projects.count} test projects, ${rentals.count} test rentals.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
