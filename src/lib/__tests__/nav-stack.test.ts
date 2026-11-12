import { describe, expect, it } from "vitest";
import { nextStack, rememberedUrl, type NavEntry } from "../nav-stack";

const e = (path: string, top = 0): NavEntry => ({ path, top });

describe("nextStack", () => {
  it("pushes a new page", () => {
    expect(nextStack([e("/inventory", 400)], "/inventory/models/a")).toEqual({ stack: [e("/inventory", 400), e("/inventory/models/a")], back: false });
  });

  it("pops on the browser's back to the page before, keeping its scroll position", () => {
    const r = nextStack([e("/inventory", 400), e("/inventory/models/a")], "/inventory", true);
    expect(r).toEqual({ stack: [e("/inventory", 400)], back: true });
  });

  it("pushes a followed link even to the page before", () => {
    const r = nextStack([e("/inventory/models/a"), e("/inventory")], "/inventory/models/a");
    expect(r).toEqual({ stack: [e("/inventory/models/a"), e("/inventory"), e("/inventory/models/a")], back: false });
  });

  it("leaves the stack alone on the same page", () => {
    const s = [e("/inventory")];
    expect(nextStack(s, "/inventory")).toEqual({ stack: s, back: false });
  });

  it("sends a breadcrumb to the page as it was last left", () => {
    const stack = [{ path: "/inventory", top: 0, url: "/inventory?q=dmx" }, e("/inventory/models/a"), e("/inventory/items/b")];
    expect(rememberedUrl(stack, "/inventory")).toBe("/inventory?q=dmx");
    expect(rememberedUrl(stack, "/inventory/items")).toBe("/inventory/items");
    expect(rememberedUrl([e("/inventory")], "/inventory")).toBe("/inventory");
  });

  it("keeps at most max entries", () => {
    expect(nextStack([e("/a"), e("/b")], "/c", false, 2).stack.map((x) => x.path)).toEqual(["/b", "/c"]);
  });
});
