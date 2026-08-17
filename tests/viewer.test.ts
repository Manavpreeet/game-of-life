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

const fakeCtx = new FakeContext();

function setupDom(): void {
  document.body.innerHTML = `
    <div id="controls">
      <select id="pattern">
        <option value="glider">glider</option>
        <option value="lwss">lwss</option>
        <option value="pulsar">pulsar</option>
        <option value="gosper-glider-gun">gosper-glider-gun</option>
        <option value="block">block</option>
        <option value="blinker">blinker</option>
      </select>
      <select id="engine">
        <option value="dense">dense</option>
        <option value="sparse">sparse</option>
      </select>
      <input id="speed" type="range" min="1" max="30" value="8" />
      <button id="playPause" type="button">Pause</button>
      <button id="reset" type="button">Reset</button>
    </div>
    <canvas id="board" width="720" height="432"></canvas>
    <div id="status">connecting...</div>
  `;
}

async function loadViewer(): Promise<void> {
  vi.resetModules();
  FakeEventSource.instances.length = 0;
  fakeCtx.calls.length = 0;
  setupDom();
  vi.stubGlobal("EventSource", FakeEventSource);
  HTMLCanvasElement.prototype.getContext = (() =>
    fakeCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  // @ts-expect-error viewer.js is a plain browser script with no type declarations
  await import("../public/viewer.js");
}

function currentSource(): FakeEventSource {
  const source = FakeEventSource.instances.at(-1);
  if (!source) throw new Error("expected an EventSource to have been created");
  return source;
}

function fireChange(el: Element): void {
  el.dispatchEvent(new Event("change"));
}

describe("web viewer", () => {
  beforeEach(async () => {
    await loadViewer();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("connects to /events with the default pattern/engine/speed on load", () => {
    expect(FakeEventSource.instances).toHaveLength(1);
    const url = new URL(currentSource().url, "http://localhost");
    expect(url.pathname).toBe("/events");
    expect(url.searchParams.get("pattern")).toBe("glider");
    expect(url.searchParams.get("engine")).toBe("dense");
    expect(url.searchParams.get("speed")).toBe("8");
  });

  it("draws a full-canvas clear followed by one fillRect per live cell", () => {
    currentSource().emit("generation", {
      generation: 3,
      width: 10,
      height: 10,
      cells: [
        [0, 0],
        [1, 1],
      ],
    });
    const [clear, ...cellFills] = fakeCtx.calls;
    expect(clear).toMatchObject({ fillStyle: "#000", x: 0, y: 0, w: 720, h: 432 });
    expect(cellFills).toHaveLength(2);
    expect(cellFills.every((c) => c.fillStyle === "#4ade80")).toBe(true);
  });

  it("updates the status text with the current generation on each frame", () => {
    currentSource().emit("generation", { generation: 7, width: 10, height: 10, cells: [] });
    expect(document.getElementById("status")?.textContent).toBe("generation 7");
  });

  it("shows a connection-lost message when the stream errors", () => {
    currentSource().onerror?.();
    expect(document.getElementById("status")?.textContent).toBe("connection lost");
  });

  it("pausing closes the stream, flips the button label, and does not reconnect on control changes", () => {
    const playPause = document.getElementById("playPause") as HTMLButtonElement;
    playPause.click();

    expect(currentSource().closed).toBe(true);
    expect(playPause.textContent).toBe("Play");
    expect(document.getElementById("status")?.textContent).toBe("paused");

    fireChange(document.getElementById("pattern") as HTMLSelectElement);
    expect(FakeEventSource.instances).toHaveLength(1); // no new connection while paused
  });

  it("pressing play again after pause opens a fresh connection", () => {
    const playPause = document.getElementById("playPause") as HTMLButtonElement;
    playPause.click(); // pause
    playPause.click(); // play

    expect(playPause.textContent).toBe("Pause");
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
  });

  it("reset always reconnects fresh, even while playing", () => {
    (document.getElementById("reset") as HTMLButtonElement).click();
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[0]?.closed).toBe(true);
    expect((document.getElementById("playPause") as HTMLButtonElement).textContent).toBe("Pause");
  });

  it("changing pattern/engine/speed while playing reconnects with the new params", () => {
    const pattern = document.getElementById("pattern") as HTMLSelectElement;
    pattern.value = "pulsar";
    fireChange(pattern);

    expect(FakeEventSource.instances).toHaveLength(2);
    const url = new URL(currentSource().url, "http://localhost");
    expect(url.searchParams.get("pattern")).toBe("pulsar");
  });

  it("closing the previous EventSource before opening a new one on reconnect", () => {
    const engine = document.getElementById("engine") as HTMLSelectElement;
    engine.value = "sparse";
    fireChange(engine);

    expect(FakeEventSource.instances[0]?.closed).toBe(true);
    expect(FakeEventSource.instances[1]?.closed).toBe(false);
  });
});
