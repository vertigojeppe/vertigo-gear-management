import "dotenv/config";
import { prisma } from "../../src/lib/db";
import { seedUsers } from "./users";
import { seedInventory } from "./inventory";
import { seedCustomFields } from "./custom-fields";
import { seedProjects } from "./projects";
import { seedPacking } from "./packing";
import { seedContacts } from "./contacts";

// Re-runnable demo data. Every seeder upserts on a stable key so running
// `npm run db:seed` twice leaves the database in the same state.
// Tests use the same seeders.
async function main() {
  console.log("Seeding database...");
  const users = await seedUsers(prisma);
  console.log(`  users: ${users.length}`);
  const contacts = await seedContacts(prisma);
  console.log(`  contacts: ${contacts}`);
  const inv = await seedInventory(prisma);
  console.log(`  categories: ${inv.categories}, locations: ${inv.locations}, models: ${inv.models}, items: ${inv.items}, kits: ${inv.kits}`);
  // Custom fields are scoped to categories, so they come after the inventory.
  const cf = await seedCustomFields(prisma);
  console.log(`  custom fields: ${cf}`);
  const pr = await seedProjects(prisma);
  console.log(`  clients: ${pr.clients}, projects: ${pr.projects}, reservations: ${pr.allocations}, rentals: ${pr.rentals}`);
  const pk = await seedPacking(prisma);
  console.log(`  packing templates: ${pk.templates}, packing lists: ${pk.lists}`);
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
