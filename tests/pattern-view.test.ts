// @vitest-environment jsdom
/// <reference lib="dom" />
import { beforeEach, describe, expect, it } from "vitest";

async function loadElement(): Promise<void> {
  // @ts-expect-error pattern-view.js is a plain browser script with no type declarations
  await import("../public/pattern-view.js");
}

function mount(attrs: Record<string, string>): Element {
  const el = document.createElement("pattern-view");
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  document.body.appendChild(el);
  return el;
}

describe("<pattern-view>", () => {
  beforeEach(async () => {
    document.body.innerHTML = "";
    await loadElement();
  });

  it("renders one <rect> per live cell, sized by cell-size", () => {
    const el = mount({ cells: "[[0,0],[1,0],[0,1]]", "cell-size": "5" });
    const rects = el.querySelectorAll("rect");
    expect(rects).toHaveLength(3);
    expect(rects[0]?.getAttribute("width")).toBe("5");
    expect(rects[0]?.getAttribute("height")).toBe("5");
  });

  it("sizes the SVG viewBox to the shape's own bounding box", () => {
    const el = mount({ cells: "[[0,0],[2,0],[2,3]]", "cell-size": "4" });
    const svg = el.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe(`${(2 + 1) * 4}`);
    expect(svg?.getAttribute("height")).toBe(`${(3 + 1) * 4}`);
  });

  it("positions each rect at cell coordinates scaled by cell-size", () => {
    const el = mount({ cells: "[[1,2]]", "cell-size": "10" });
    const rect = el.querySelector("rect");
    expect(rect?.getAttribute("x")).toBe("10");
    expect(rect?.getAttribute("y")).toBe("20");
  });

  it("defaults cell-size to 4 when the attribute is absent", () => {
    const el = mount({ cells: "[[0,0]]" });
    expect(el.querySelector("rect")?.getAttribute("width")).toBe("4");
  });

  it("renders an empty svg for an empty cells list", () => {
    const el = mount({ cells: "[]", "cell-size": "4" });
    expect(el.querySelectorAll("rect")).toHaveLength(0);
    expect(el.querySelector("svg")).not.toBeNull();
  });

  it("renders an empty svg for malformed cells JSON, rather than throwing", () => {
    expect(() => mount({ cells: "not json", "cell-size": "4" })).not.toThrow();
    const el = document.querySelector("pattern-view");
    expect(el?.querySelectorAll("rect")).toHaveLength(0);
  });

  it("re-renders when the cells attribute changes", () => {
    const el = mount({ cells: "[[0,0]]", "cell-size": "4" });
    expect(el.querySelectorAll("rect")).toHaveLength(1);
    el.setAttribute("cells", "[[0,0],[1,0],[0,1],[1,1]]");
    expect(el.querySelectorAll("rect")).toHaveLength(4);
  });
});
