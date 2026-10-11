import { describe, expect, it } from "vitest";
import { buildTree, descendantIds, flattenTree, pathNames, wouldCycle } from "../tree";

const rows = [
  { id: "video", name: "Video", parentId: null, sortOrder: 1 },
  { id: "proj", name: "Projectors", parentId: "video", sortOrder: 0 },
  { id: "laserproj", name: "Laser projectors", parentId: "proj", sortOrder: 0 },
  { id: "light", name: "Lighting", parentId: null, sortOrder: 0 },
  { id: "led", name: "LED", parentId: "light", sortOrder: 0 },
];

describe("tree helpers", () => {
  it("builds a sorted tree with depths", () => {
    const tree = buildTree(rows);
    expect(tree.map((n) => n.name)).toEqual(["Lighting", "Video"]);
    const video = tree[1];
    expect(video.children[0].name).toBe("Projectors");
    expect(video.children[0].children[0].depth).toBe(2);
  });

  it("flattens depth-first", () => {
    expect(flattenTree(buildTree(rows)).map((n) => n.id)).toEqual(["light", "led", "video", "proj", "laserproj"]);
  });

  it("finds descendants and paths", () => {
    expect(descendantIds(rows, "video").sort()).toEqual(["laserproj", "proj", "video"]);
    expect(pathNames(rows, "laserproj")).toEqual(["Video", "Projectors", "Laser projectors"]);
  });

  it("detects cycles when re-parenting", () => {
    expect(wouldCycle(rows, "video", "laserproj")).toBe(true);
    expect(wouldCycle(rows, "video", "video")).toBe(true);
    expect(wouldCycle(rows, "video", "light")).toBe(false);
    expect(wouldCycle(rows, "video", null)).toBe(false);
  });
});
