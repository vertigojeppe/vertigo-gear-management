import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getStorage } from "../src/lib/storage";

/**
 * Removes what the browser tests leave behind in a dev database:
 * "Testlight" models/items, "e2e …" API tokens and their activity rows.
 * CI starts from a fresh database, so this is for local use:
 *   npm run db:clean-tests
 */
async function main() {
  const tokens = await prisma.apiToken.deleteMany({ where: { name: { startsWith: "e2e " } } });
  const testUsers = await prisma.user.findMany({ where: { email: { startsWith: "e2e-" } }, select: { id: true } });
  await prisma.activityLog.deleteMany({ where: { entityType: "user", entityId: { in: testUsers.map((u) => u.id) } } });
  const removedUsers = await prisma.user.deleteMany({ where: { id: { in: testUsers.map((u) => u.id) } } });
  const testApps = await prisma.app.findMany({ where: { name: { startsWith: "E2E " } }, select: { id: true, versions: { select: { file: { select: { id: true, storageKey: true } } } } } });
  await prisma.activityLog.deleteMany({ where: { entityType: "app", entityId: { in: testApps.map((a) => a.id) } } });
  await prisma.app.deleteMany({ where: { id: { in: testApps.map((a) => a.id) } } });
  const appFiles = testApps.flatMap((a) => a.versions.map((v) => v.file));
  await prisma.file.deleteMany({ where: { id: { in: appFiles.map((x) => x.id) } } });
  for (const x of appFiles) await getStorage().delete(x.storageKey).catch(() => undefined);
  const wishes = await prisma.wishItem.deleteMany({ where: { manufacturer: "Testlight" } });
  await prisma.subHireLine.deleteMany({ where: { item: { manufacturer: "Testlight" } } });
  await prisma.subHireItem.deleteMany({ where: { manufacturer: "Testlight" } });
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
  await prisma.activityLog.deleteMany({ where: { entityId: { in: testProjects.map((p) => p.id) } } });
  const projects = await prisma.project.deleteMany({ where: { id: { in: testProjects.map((p) => p.id) } } });
  // Packing lists go with their project; share links and templates do not.
  const liveLists = (await prisma.packingList.findMany({ select: { id: true } })).map((l) => l.id);
  await prisma.shareLink.deleteMany({ where: { targetType: "packing_list", targetId: { notIn: liveLists } } });
  await prisma.packingTemplate.deleteMany({ where: { name: { startsWith: "E2E template " } } });
  const rentals = await prisma.rental.deleteMany({ where: { startDate: { gte: new Date("2032-01-01T00:00:00Z") }, notes: null } });
  // Clients the browser tests created from the project/rental forms (after their projects and rentals are gone).
  const testClients = await prisma.client.findMany({ where: { name: { startsWith: "E2E client " } }, select: { id: true } });
  await prisma.location.deleteMany({ where: { renterId: { in: testClients.map((c) => c.id) } } });
  await prisma.client.deleteMany({ where: { id: { in: testClients.map((c) => c.id) }, projects: { none: {} }, rentals: { none: {} } } });
  // Spreadsheet imports made by the browser test (file name "E2E import …"):
  // the import's activity row lists every id it created.
  const imports = await prisma.activityLog.findMany({ where: { action: "spreadsheet_imported", summary: { contains: "E2E import" } } });
  for (const log of imports.reverse()) {
    const c = (log.details as { created?: Record<string, string[]> } | null)?.created ?? {};
    const ids = (k: string) => c[k] ?? [];
    await prisma.allocation.deleteMany({ where: { rentalId: { in: ids("rentals") } } });
    await prisma.rental.deleteMany({ where: { id: { in: ids("rentals") } } });
    await prisma.location.deleteMany({ where: { renterId: { in: ids("clients") } } });
    await prisma.client.deleteMany({ where: { id: { in: ids("clients") } } });
    await prisma.item.deleteMany({ where: { id: { in: ids("items") } } });
    await prisma.model.deleteMany({ where: { id: { in: ids("models") } } });
    await prisma.location.deleteMany({ where: { id: { in: ids("locations") } } });
    await prisma.contact.deleteMany({ where: { id: { in: ids("contacts") } } });
    await prisma.rateTable.deleteMany({ where: { id: { in: ids("rateTables") } } });
    await prisma.wishItem.deleteMany({ where: { id: { in: ids("wishes") } } });
    await prisma.purchase.deleteMany({ where: { id: { in: ids("purchases") } } });
    await prisma.subHireItem.deleteMany({ where: { id: { in: ids("subHireItems") } } });
    for (const id of ids("categories").reverse()) await prisma.category.delete({ where: { id } }).catch(() => undefined);
    await prisma.activityLog.delete({ where: { id: log.id } });
  }
  await prisma.outbox.deleteMany({ where: { status: { in: ["done", "failed"] } } });
  console.log(`Removed ${tokens.count} tokens, ${removedUsers.count} test users, ${testApps.length} test apps, ${ids.length} models, ${wishes.count} wishes, ${items.length} items, ${logs.count} activity rows, ${projects.count} test projects, ${rentals.count} test rentals, ${imports.length} test imports.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
