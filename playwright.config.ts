import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  // The dev server compiles routes on first hit; too many parallel first
  // requests make Turbopack race on its manifests. CI runs a built app.
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    // The specs sign in as the seeded admin, so admins are not sent to the 2FA setup page here.
    env: { TWO_FACTOR_REQUIRED_ROLES: process.env.TWO_FACTOR_REQUIRED_ROLES ?? "none", PROJECT_GEAR: process.env.PROJECT_GEAR ?? "on" },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
