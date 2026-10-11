import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "config/**/*.test.ts", "prisma/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
