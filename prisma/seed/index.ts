import "dotenv/config";
import { prisma } from "../../src/lib/db";
import { seedUsers } from "./users";
import { seedInventory } from "./inventory";
import { seedCustomFields } from "./custom-fields";

// Re-runnable demo data. Every seeder upserts on a stable key so running
// `npm run db:seed` twice leaves the database in the same state.
// Tests use the same seeders.
async function main() {
  console.log("Seeding database...");
  const users = await seedUsers(prisma);
  console.log(`  users: ${users.length}`);
  const cf = await seedCustomFields(prisma);
  console.log(`  custom fields: ${cf}`);
  const inv = await seedInventory(prisma);
  console.log(`  categories: ${inv.categories}, locations: ${inv.locations}, models: ${inv.models}, items: ${inv.items}, kits: ${inv.kits}`);
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
