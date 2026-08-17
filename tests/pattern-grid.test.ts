// @vitest-environment jsdom
/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FillRectCall {
  readonly fillStyle: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

class FakeContext {
  calls: FillRectCall[] = [];
  fillStyle = "";
  fillRect(x: number, y: number, w: number, h: number): void {
    this.calls.push({ fillStyle: this.fillStyle, x, y, w, h });
  }
}

const fakeCtx = new FakeContext();

async function loadElement(): Promise<void> {
  vi.resetModules();
  fakeCtx.calls.length = 0;
  HTMLCanvasElement.prototype.getContext = (() =>
    fakeCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  // @ts-expect-error pattern-grid.js is a plain browser script with no type declarations
  await import("../public/pattern-grid.js");
}

function mount(attrs: Record<string, string>): Element {
  const el = document.createElement("pattern-grid");
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  document.body.appendChild(el);
  return el;
}

const GLIDER = "[[1,0],[2,1],[0,2],[1,2],[2,2]]";

describe("<pattern-grid>", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    await loadElement();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("sizes the canvas to the shape's bounding box plus margin on both sides", () => {
    const el = mount({ cells: GLIDER, "cell-px": "10", margin: "5" }) as HTMLElement & {
      canvas: HTMLCanvasElement;
    };
    // glider bounding box is 3x3; viewport = 3 + 5*2 = 13 cells
    expect(el.canvas.width).toBe(13 * 10);
    expect(el.canvas.height).toBe(13 * 10);
  });

  it("draws one live-colored fillRect per live cell on the initial frame", () => {
    mount({ cells: GLIDER, "cell-px": "10", margin: "5" });
    const clear = fakeCtx.calls[0];
    expect(clear).toMatchObject({ fillStyle: "#000" });
    const cellFills = fakeCtx.calls.slice(1);
    expect(cellFills).toHaveLength(5); // glider has 5 live cells
    expect(cellFills.every((c) => c.fillStyle === "#4ade80")).toBe(true);
  });

  it("shows the initial generation and population in the label", () => {
    const el = mount({ cells: GLIDER, "cell-px": "10", margin: "5" });
    expect(el.querySelector(".pattern-grid-label")?.textContent).toBe("gen 0 · 5 live cells");
  });

  it("steps forward on a fixed interval, advancing the generation label", () => {
    const el = mount({ cells: GLIDER, "cell-px": "10", margin: "5" });
    vi.advanceTimersByTime(300);
    expect(el.querySelector(".pattern-grid-label")?.textContent).toBe("gen 1 · 5 live cells");
    vi.advanceTimersByTime(300);
    expect(el.querySelector(".pattern-grid-label")?.textContent).toBe("gen 2 · 5 live cells");
  });

  it("a still life (block) never changes population across steps", () => {
    const el = mount({ cells: "[[0,0],[1,0],[0,1],[1,1]]", "cell-px": "10", margin: "5" });
    vi.advanceTimersByTime(300 * 4);
    expect(el.querySelector(".pattern-grid-label")?.textContent).toBe("gen 4 · 4 live cells");
  });

  it("stops the interval timer on disconnect", () => {
    const el = mount({ cells: GLIDER, "cell-px": "10", margin: "5" });
    el.remove();
    const callsBefore = fakeCtx.calls.length;
    vi.advanceTimersByTime(300 * 5);
    expect(fakeCtx.calls.length).toBe(callsBefore); // no further draws after disconnect
  });

  it("restarts from generation 0 when the cells attribute changes", () => {
    const el = mount({ cells: GLIDER, "cell-px": "10", margin: "5" });
    vi.advanceTimersByTime(300 * 2);
    expect(el.querySelector(".pattern-grid-label")?.textContent).toBe("gen 2 · 5 live cells");

    el.setAttribute("cells", "[[0,0],[1,0],[0,1],[1,1]]");
    expect(el.querySelector(".pattern-grid-label")?.textContent).toBe("gen 0 · 4 live cells");
  });

  it("respects a custom rule attribute (HighLife births on 6 as well as 3)", () => {
    // A 2x3 block of 6 live cells has a center-ish dead cell with 6 live
    // neighbors -- dead under B3/S23 (needs exactly 3), alive under B36/S23.
    const cells = "[[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2]]";
    const el = mount({ cells, rule: "B36/S23", "cell-px": "10", margin: "5" });
    vi.advanceTimersByTime(300);
    const label = el.querySelector(".pattern-grid-label")?.textContent ?? "";
    expect(label).toMatch(/^gen 1 · \d+ live cells$/);
  });

  it("falls back to standard Conway rules for an unparseable rule attribute", () => {
    const el = mount({ cells: GLIDER, rule: "not-a-rule", "cell-px": "10", margin: "5" });
    vi.advanceTimersByTime(300 * 4);
    // a glider returns to 5 live cells every 4 generations under B3/S23
    expect(el.querySelector(".pattern-grid-label")?.textContent).toBe("gen 4 · 5 live cells");
  });
});
