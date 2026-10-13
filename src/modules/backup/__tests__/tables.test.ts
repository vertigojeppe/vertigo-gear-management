import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { sortSelfRefs, TABLES, validateBackup } from "../tables";

describe("backup tables", () => {
  it("lists every table of the schema exactly once", () => {
    const schema = Object.values(Prisma.ModelName).sort();
    const listed = TABLES.map((t) => t.name).sort();
    expect(listed).toEqual(schema);
  });
  it("sorts parents before children within a table", () => {
    const rows = [
      { id: "c", parentId: "b" },
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
      { id: "x", parentId: "missing" },
    ];
    expect(sortSelfRefs(rows, "parentId").map((r) => r.id)).toEqual(["a", "b", "c", "x"]);
  });
  it("validates the file shape", () => {
    expect(validateBackup(null)).toEqual(["Not a JSON object."]);
    expect(validateBackup({ version: 2, tables: {} })).toEqual(["Unsupported backup version 2."]);
    expect(validateBackup({ version: 1, tables: { User: [{ id: "u1" }], Nope: [] } })).toEqual(["Unknown table Nope."]);
    expect(validateBackup({ version: 1, tables: { User: [{ name: "no id" }] } })).toEqual(["Table User has a row without an id."]);
    expect(validateBackup({ version: 1, tables: { User: [] } })).toEqual([]);
  });
});
