import { describe, expect, it } from "vitest";
import { can } from "./permissions";

// The permission matrix is the thing that keeps a freelancer from editing
// the inventory. Keep these in sync with ROLES in config/app.config.ts.
describe("can()", () => {
  it("admin can do everything", () => {
    expect(can("admin", "users.manage")).toBe(true);
    expect(can("admin", "settings.manage")).toBe(true);
    expect(can("admin", "inventory.write")).toBe(true);
  });

  it("member edits gear, projects, lists and plans but not users or settings", () => {
    expect(can("member", "inventory.write")).toBe(true);
    expect(can("member", "projects.write")).toBe(true);
    expect(can("member", "packing.write")).toBe(true);
    expect(can("member", "plans.write")).toBe(true);
    expect(can("member", "rentals.write")).toBe(true);
    expect(can("member", "inventory.finance")).toBe(true);
    expect(can("member", "users.manage")).toBe(false);
    expect(can("member", "settings.manage")).toBe(false);
  });

  it("viewer is read-only and cannot see finance fields", () => {
    expect(can("viewer", "inventory.read")).toBe(true);
    expect(can("viewer", "projects.read")).toBe(true);
    expect(can("viewer", "inventory.write")).toBe(false);
    expect(can("viewer", "inventory.finance")).toBe(false);
    expect(can("viewer", "share.create")).toBe(false);
  });
});
