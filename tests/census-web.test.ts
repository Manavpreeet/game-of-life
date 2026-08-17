// @vitest-environment jsdom
/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeMessageEvent {
  readonly data: string;
}

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  closed = false;
  onerror: (() => void) | null = null;
  private readonly listeners = new Map<string, Array<(ev: FakeMessageEvent) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (ev: FakeMessageEvent) => void): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(handler);
    this.listeners.set(type, existing);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: unknown): void {
    for (const handler of this.listeners.get(type) ?? []) {
      handler({ data: JSON.stringify(data) });
    }
  }
}

function setupDom(): void {
  document.body.innerHTML = `
    <div id="controls">
      <input id="soups" type="number" value="200" />
      <input id="size" type="number" value="16" />
      <input id="density" type="number" value="0.4" />
      <select id="rule">
        <option value="B3/S23">Conway (B3/S23)</option>
        <option value="B36/S23">HighLife (B36/S23)</option>
      </select>
      <input id="seedStart" type="number" value="0" />
      <button id="run" type="button">Run census</button>
    </div>
    <div id="progressWrap">
      <div id="progressBar"><div id="progressFill"></div></div>
      <div id="status">idle</div>
    </div>
    <div id="report"></div>
    <div id="inspector">
      <select id="patternSelect"></select>
      <div id="previewPane"></div>
    </div>
  `;
}

// jsdom implements <canvas> but not a real 2D rendering context (that needs
// the native `canvas` package, which this project deliberately doesn't
// depend on -- see pattern-grid.js's comment on why it degrades gracefully
// without one). Stub a no-op context so pattern-grid's draw loop has
// something to call without throwing.
class FakeContext {
  fillStyle = "";
  fillRect(): void {}
}

async function loadCensus(): Promise<void> {
  vi.resetModules();
  FakeEventSource.instances.length = 0;
  setupDom();
  vi.stubGlobal("EventSource", FakeEventSource);
  HTMLCanvasElement.prototype.getContext = (() =>
    new FakeContext()) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  // @ts-expect-error plain browser scripts with no type declarations
  await import("../public/pattern-view.js");
  // @ts-expect-error plain browser scripts with no type declarations
  await import("../public/pattern-grid.js");
  // @ts-expect-error plain browser scripts with no type declarations
  await import("../public/census.js");
}

function currentSource(): FakeEventSource {
  const source = FakeEventSource.instances.at(-1);
  if (!source) throw new Error("expected an EventSource to have been created");
  return source;
}

function clickRun(): void {
  (document.getElementById("run") as HTMLButtonElement).click();
}

const SAMPLE_REPORT = {
  soups: 60,
  width: 16,
  height: 16,
  density: 0.4,
  rule: "B3/S23",
  extinctSoups: 7,
  unstabilizedSoups: 0,
  unclassifiedObjects: 2,
  entries: [
    {
      canonicalKey: "0,0;0,1;1,0;1,1",
      name: "block",
      type: "still-life",
      count: 12,
      period: 1,
      boundingBox: { width: 2, height: 2 },
      examplePattern: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
    },
    {
      canonicalKey: "0,0;0,1;0,2;1,0;2,1",
      name: "glider",
      type: "spaceship",
      count: 1,
      period: 4,
      boundingBox: { width: 3, height: 3 },
      examplePattern: [
        [1, 0],
        [2, 1],
        [0, 2],
        [1, 2],
        [2, 2],
      ],
    },
  ],
};

describe("census web page", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await loadCensus();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("connects to /census-events with the form's parameters on run", () => {
    clickRun();
    expect(FakeEventSource.instances).toHaveLength(1);
    const url = new URL(currentSource().url, "http://localhost");
    expect(url.pathname).toBe("/census-events");
    expect(url.searchParams.get("soups")).toBe("200");
    expect(url.searchParams.get("size")).toBe("16");
    expect(url.searchParams.get("density")).toBe("0.4");
    expect(url.searchParams.get("rule")).toBe("B3/S23");
    expect(url.searchParams.get("seedStart")).toBe("0");
  });

  it("disables the run button while a census is in flight", () => {
    clickRun();
    expect((document.getElementById("run") as HTMLButtonElement).disabled).toBe(true);
  });

  it("updates the progress bar and status text on progress events", () => {
    clickRun();
    currentSource().emit("progress", { done: 30, total: 200 });
    expect(document.getElementById("progressFill")?.style.width).toBe("15%");
    expect(document.getElementById("status")?.textContent).toBe("30 / 200 soups");
  });

  it("renders grouped entries with a pattern-view thumbnail on done", () => {
    clickRun();
    currentSource().emit("done", SAMPLE_REPORT);

    const report = document.getElementById("report") as HTMLElement;
    expect(report.textContent).toContain("Still lifes");
    expect(report.textContent).toContain("block");
    expect(report.textContent).toContain("x12");
    expect(report.textContent).toContain("Spaceships");
    expect(report.textContent).toContain("glider");
    expect(report.textContent).toContain("extinct");
    expect(report.textContent).toContain("7");
    expect(report.textContent).toContain("unclassified objects");

    const thumbs = report.querySelectorAll("pattern-view");
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]?.querySelectorAll("rect")).toHaveLength(4); // block: 4 live cells
  });

  it("re-enables the run button and closes the stream on done", () => {
    clickRun();
    currentSource().emit("done", SAMPLE_REPORT);
    expect((document.getElementById("run") as HTMLButtonElement).disabled).toBe(false);
    expect(currentSource().closed).toBe(true);
  });

  it("populates the inspector dropdown with one option per entry and previews the first by default", () => {
    clickRun();
    currentSource().emit("done", SAMPLE_REPORT);

    const select = document.getElementById("patternSelect") as HTMLSelectElement;
    expect(select.options).toHaveLength(2);
    expect(select.options[0]?.textContent).toBe("block (still-life) x12");

    const preview = document.getElementById("previewPane") as HTMLElement;
    expect(preview.textContent).toContain("block");
    expect(preview.textContent).toContain("still-life");
    const grid = preview.querySelector("pattern-grid");
    expect(grid).not.toBeNull();
    expect(grid?.getAttribute("rule")).toBe("B3/S23");
    expect(JSON.parse(grid?.getAttribute("cells") ?? "[]")).toEqual(
      SAMPLE_REPORT.entries[0]?.examplePattern,
    );
  });

  it("switching the dropdown updates the preview (and its live grid) to the selected entry", () => {
    clickRun();
    currentSource().emit("done", SAMPLE_REPORT);

    const select = document.getElementById("patternSelect") as HTMLSelectElement;
    select.value = "1";
    select.dispatchEvent(new Event("change"));

    const preview = document.getElementById("previewPane") as HTMLElement;
    expect(preview.textContent).toContain("glider");
    expect(preview.textContent).toContain("spaceship");
    expect(preview.textContent).toContain("period");
    expect(preview.textContent).toContain("4");
    expect(
      JSON.parse(preview.querySelector("pattern-grid")?.getAttribute("cells") ?? "[]"),
    ).toEqual(SAMPLE_REPORT.entries[1]?.examplePattern);
  });

  it("hides the inspector when a census produces no classified entries", () => {
    clickRun();
    currentSource().emit("done", { ...SAMPLE_REPORT, entries: [] });
    expect((document.getElementById("inspector") as HTMLElement).style.display).toBe("none");
  });

  it("shows a connection-lost message and re-enables the button on stream error", () => {
    clickRun();
    currentSource().onerror?.();
    expect(document.getElementById("status")?.textContent).toBe("connection lost");
    expect((document.getElementById("run") as HTMLButtonElement).disabled).toBe(false);
  });

  it("disabling the run button while in flight means a second click is a no-op (real <button disabled> semantics)", () => {
    clickRun();
    clickRun();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("erroring out, then running again, opens a fresh stream (the button was re-enabled)", () => {
    clickRun();
    currentSource().onerror?.();
    clickRun();
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(currentSource().closed).toBe(false);
  });
});
