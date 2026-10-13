import { describe, expect, it } from "vitest";
import { checkRequest, computeAvailability, overbookedDays, unitDoubleBookings, type AllocationLike, type ItemLike } from "../availability";

const items: ItemLike[] = [
  { id: "p1", quantity: 1, status: "in_house" },
  { id: "p2", quantity: 1, status: "in_house" },
  { id: "p3", quantity: 1, status: "on_project" },
  { id: "p4", quantity: 1, status: "in_repair" },
  { id: "p5", quantity: 1, status: "retired" },
];

const alloc = (over: Partial<AllocationLike>): AllocationLike => ({
  id: "a",
  holderType: "project",
  holderId: "proj-a",
  holderName: "Project A",
  modelId: "m",
  quantity: 1,
  itemId: null,
  startDate: "2026-11-10",
  endDate: "2026-11-12",
  ...over,
});

describe("computeAvailability", () => {
  it("leaves own-projects-only units out when the request is for a rental", () => {
    const mixed: ItemLike[] = [...items, { id: "p6", quantity: 1, status: "in_house", notForRental: true }, { id: "bin", quantity: 10, status: "in_house", notForRental: true }];
    const forProject = computeAvailability(mixed, [], { from: "2026-11-01", to: "2026-11-02" });
    expect(forProject.owned).toBe(15);
    expect(forProject.notRentable).toBe(0);
    const forRental = computeAvailability(mixed, [], { from: "2026-11-01", to: "2026-11-02" }, undefined, { forRental: true });
    expect(forRental.owned).toBe(4);
    expect(forRental.notRentable).toBe(11);
    expect(forRental.available).toBe(3);
    // A rental asking for more than the rentable units falls short even though the shelf is full.
    expect(checkRequest(mixed, [], { from: "2026-11-01", to: "2026-11-02" }, 4, undefined, { forRental: true })).toMatchObject({ ok: false, shortfall: 1 });
    expect(checkRequest(mixed, [], { from: "2026-11-01", to: "2026-11-02" }, 4)).toMatchObject({ ok: true });
  });

  it("counts owned minus out-of-service when nothing is reserved", () => {
    const a = computeAvailability(items, [], { from: "2026-11-01", to: "2026-11-02" });
    expect(a.owned).toBe(4); // retired excluded
    expect(a.unavailable).toBe(1); // in repair
    expect(a.allocated).toBe(0);
    expect(a.available).toBe(3);
  });

  it("subtracts overlapping allocations only", () => {
    const allocations = [
      alloc({ id: "a1", startDate: "2026-11-10", endDate: "2026-11-12", quantity: 2 }),
      alloc({ id: "a2", startDate: "2026-11-20", endDate: "2026-11-21", quantity: 1, holderId: "proj-b" }),
    ];
    const a = computeAvailability(items, allocations, { from: "2026-11-12", to: "2026-11-15" });
    expect(a.allocated).toBe(2);
    expect(a.available).toBe(1);
    expect(a.conflicts.map((c) => c.id)).toEqual(["a1"]);
  });

  it("treats date ranges as inclusive on both ends", () => {
    const allocations = [alloc({ startDate: "2026-11-10", endDate: "2026-11-12" })];
    expect(computeAvailability(items, allocations, { from: "2026-11-12", to: "2026-11-12" }).allocated).toBe(1);
    expect(computeAvailability(items, allocations, { from: "2026-11-13", to: "2026-11-13" }).allocated).toBe(0);
    expect(computeAvailability(items, allocations, { from: "2026-11-01", to: "2026-11-10" }).allocated).toBe(1);
    expect(computeAvailability(items, allocations, { from: "2026-11-01", to: "2026-11-09" }).allocated).toBe(0);
  });

  it("excludes the holder being edited so a project does not conflict with itself", () => {
    const allocations = [alloc({ id: "a1", holderId: "proj-a", quantity: 3 }), alloc({ id: "a2", holderId: "proj-b", holderType: "rental", quantity: 1 })];
    const a = computeAvailability(items, allocations, { from: "2026-11-11", to: "2026-11-11" }, { holderType: "project", holderId: "proj-a" });
    expect(a.allocated).toBe(1);
    expect(a.conflicts[0].holderType).toBe("rental");
  });

  it("rentals and projects compete for the same units", () => {
    const allocations = [alloc({ id: "r1", holderType: "rental", holderId: "rent-1", holderName: "Nordic Light", quantity: 3 })];
    const r = checkRequest(items, allocations, { from: "2026-11-11", to: "2026-11-11" }, 2);
    expect(r.available).toBe(0);
    expect(r.shortfall).toBe(2);
    expect(r.ok).toBe(false);
    expect(r.conflicts[0].holderName).toBe("Nordic Light");
  });

  it("reports ok when the request fits", () => {
    const r = checkRequest(items, [alloc({ quantity: 1 })], { from: "2026-11-11", to: "2026-11-11" }, 2);
    expect(r.ok).toBe(true);
    expect(r.shortfall).toBe(0);
  });
});

describe("unitDoubleBookings", () => {
  it("finds the same unit reserved twice in overlapping windows", () => {
    const allocations = [
      alloc({ id: "x", itemId: "p1", startDate: "2026-11-10", endDate: "2026-11-12" }),
      alloc({ id: "y", itemId: "p1", startDate: "2026-11-12", endDate: "2026-11-14", holderId: "proj-b" }),
      alloc({ id: "z", itemId: "p1", startDate: "2026-11-20", endDate: "2026-11-21", holderId: "proj-c" }),
      alloc({ id: "w", itemId: "p2", startDate: "2026-11-10", endDate: "2026-11-14", holderId: "proj-d" }),
    ];
    const pairs = unitDoubleBookings(allocations);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].map((p) => p.id).sort()).toEqual(["x", "y"]);
  });
});

describe("overbookedDays", () => {
  it("lists days where demand exceeds supply", () => {
    const allocations = [
      alloc({ id: "a1", quantity: 2, startDate: "2026-11-10", endDate: "2026-11-12" }),
      alloc({ id: "a2", quantity: 2, startDate: "2026-11-12", endDate: "2026-11-13", holderId: "proj-b" }),
    ];
    const days = overbookedDays(items, allocations, { from: "2026-11-09", to: "2026-11-14" });
    expect(days).toEqual([{ day: "2026-11-12", shortfall: 1 }]);
  });
});
