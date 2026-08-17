import type { ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RULE } from "../../src/engine/rules.js";
import { streamGenerations, type GenerationFrame } from "../../src/server/stream.js";

class FakeResponse {
  headers: Record<string, string> | undefined;
  statusCode: number | undefined;
  writes: string[] = [];
  closeHandler: (() => void) | undefined;

  writeHead(status: number, headers: Record<string, string>): void {
    this.statusCode = status;
    this.headers = headers;
  }

  write(chunk: string): void {
    this.writes.push(chunk);
  }

  on(event: string, handler: () => void): void {
    if (event === "close") this.closeHandler = handler;
  }

  frames(): GenerationFrame[] {
    return this.writes.map((chunk) => {
      const match = /^event: generation\ndata: (.+)\n\n$/.exec(chunk);
      if (!match?.[1]) throw new Error(`unexpected SSE chunk: ${chunk}`);
      return JSON.parse(match[1]) as GenerationFrame;
    });
  }
}

describe("stream: streamGenerations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes SSE headers immediately", () => {
    const res = new FakeResponse();
    streamGenerations(res as unknown as ServerResponse, {
      pattern: "block",
      rule: DEFAULT_RULE,
      engine: "dense",
      speed: 8,
      width: 10,
      height: 10,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers?.["Content-Type"]).toBe("text/event-stream");
    expect(res.headers?.["Cache-Control"]).toBe("no-cache");
  });

  it("sends generation 0 synchronously, then increments on each tick (dense engine)", () => {
    const res = new FakeResponse();
    streamGenerations(res as unknown as ServerResponse, {
      pattern: "block",
      rule: DEFAULT_RULE,
      engine: "dense",
      speed: 10, // 100ms/tick
      width: 10,
      height: 10,
    });
    expect(res.frames()).toHaveLength(1);
    expect(res.frames()[0]?.generation).toBe(0);

    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    const frames = res.frames();
    expect(frames.map((f) => f.generation)).toEqual([0, 1, 2]);
  });

  it("keeps a still-life (block) stable across generations, matching its cell count", () => {
    const res = new FakeResponse();
    streamGenerations(res as unknown as ServerResponse, {
      pattern: "block",
      rule: DEFAULT_RULE,
      engine: "dense",
      speed: 10,
      width: 10,
      height: 10,
    });
    vi.advanceTimersByTime(100);
    const frames = res.frames();
    expect(frames[0]?.cells).toHaveLength(4);
    expect(frames[1]?.cells).toHaveLength(4);
  });

  it("produces equivalent live-cell counts for dense and sparse engines", () => {
    const denseRes = new FakeResponse();
    streamGenerations(denseRes as unknown as ServerResponse, {
      pattern: "glider",
      rule: DEFAULT_RULE,
      engine: "dense",
      speed: 10,
      width: 20,
      height: 20,
    });
    const sparseRes = new FakeResponse();
    streamGenerations(sparseRes as unknown as ServerResponse, {
      pattern: "glider",
      rule: DEFAULT_RULE,
      engine: "sparse",
      speed: 10,
      width: 20,
      height: 20,
    });
    expect(denseRes.frames()[0]?.cells).toHaveLength(5);
    expect(sparseRes.frames()[0]?.cells).toHaveLength(5);
  });

  it("reports the requested width/height on every frame", () => {
    const res = new FakeResponse();
    streamGenerations(res as unknown as ServerResponse, {
      pattern: "glider",
      rule: DEFAULT_RULE,
      engine: "sparse",
      speed: 10,
      width: 42,
      height: 24,
    });
    const frame = res.frames()[0];
    expect(frame?.width).toBe(42);
    expect(frame?.height).toBe(24);
  });

  it("stops sending frames once the response closes", () => {
    const res = new FakeResponse();
    streamGenerations(res as unknown as ServerResponse, {
      pattern: "block",
      rule: DEFAULT_RULE,
      engine: "dense",
      speed: 10,
      width: 10,
      height: 10,
    });
    res.closeHandler?.();
    const countAtClose = res.writes.length;
    vi.advanceTimersByTime(1000);
    expect(res.writes.length).toBe(countAtClose);
  });

  it("clamps the tick interval to a 16ms floor for very high speeds", () => {
    const res = new FakeResponse();
    streamGenerations(res as unknown as ServerResponse, {
      pattern: "block",
      rule: DEFAULT_RULE,
      engine: "dense",
      speed: 1000, // would compute to 1ms without the floor
      width: 10,
      height: 10,
    });
    vi.advanceTimersByTime(15);
    expect(res.frames()).toHaveLength(1); // no extra tick yet, below the 16ms floor
    vi.advanceTimersByTime(1);
    expect(res.frames()).toHaveLength(2);
  });
});
