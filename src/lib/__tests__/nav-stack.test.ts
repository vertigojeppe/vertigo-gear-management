import { describe, expect, it } from "vitest";
import { nextStack, type NavEntry } from "../nav-stack";

const e = (path: string, top = 0): NavEntry => ({ path, top });

describe("nextStack", () => {
  it("pushes a new page", () => {
    expect(nextStack([e("/inventory", 400)], "/inventory/models/a")).toEqual({ stack: [e("/inventory", 400), e("/inventory/models/a")], back: false });
  });

  it("pops when arriving at the page before, keeping its scroll position", () => {
    const r = nextStack([e("/inventory", 400), e("/inventory/models/a")], "/inventory");
    expect(r).toEqual({ stack: [e("/inventory", 400)], back: true });
  });

  it("leaves the stack alone on the same page", () => {
    const s = [e("/inventory")];
    expect(nextStack(s, "/inventory")).toEqual({ stack: s, back: false });
  });

  it("keeps at most max entries", () => {
    expect(nextStack([e("/a"), e("/b")], "/c", 2).stack.map((x) => x.path)).toEqual(["/b", "/c"]);
  });
});
