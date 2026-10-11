import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 configuration. The datasource URL lives here (not in the schema)
// so the same schema works for dev, test and production.
export default defineConfig({
  schema: "prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "",
  },
});
