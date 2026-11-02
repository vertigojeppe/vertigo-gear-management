import { describe, expect, it } from "vitest";
import { groupTodos, moved } from "../logic";

describe("to-do order", () => {
  it("groups by category: none first, then A–Z with Danish letters last", () => {
    const rows = [
      { id: "1", category: "Øvrigt" },
      { id: "2", category: null },
      { id: "3", category: "Indkøb" },
      { id: "4", category: "Øvrigt" },
      { id: "5", category: "Arbejde" },
    ];
    expect(groupTodos(rows).map((g) => [g.category, g.rows.map((r) => r.id)])).toEqual([
      [null, ["2"]],
      ["Arbejde", ["5"]],
      ["Indkøb", ["3"]],
      ["Øvrigt", ["1", "4"]],
    ]);
  });

  it("moves one step and stops at the ends", () => {
    expect(moved(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moved(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
    expect(moved(["a", "b", "c"], "a", "up")).toEqual(["a", "b", "c"]);
    expect(moved(["a", "b", "c"], "c", "down")).toEqual(["a", "b", "c"]);
    expect(moved(["a"], "x", "up")).toEqual(["a"]);
  });
});
