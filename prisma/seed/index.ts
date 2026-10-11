import "dotenv/config";
import { prisma } from "../../src/lib/db";
import { seedUsers } from "./users";

// Re-runnable demo data. Every seeder upserts on a stable key so running
// `npm run db:seed` twice leaves the database in the same state.
// Tests use the same seeders.
async function main() {
  console.log("Seeding database...");
  const users = await seedUsers(prisma);
  console.log(`  users: ${users.length}`);
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
