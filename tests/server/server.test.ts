import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/server/server.js";

describe("SSE generation stream", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    server = createApp();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("emits at least 5 distinct sequential generations", async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/events?pattern=glider&speed=50`, {
      signal: controller.signal,
    });
    expect(res.ok).toBe(true);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body?.getReader();
    if (!reader) throw new Error("expected a readable response body");
    const decoder = new TextDecoder();
    let buffer = "";
    const generations = new Set<number>();

    while (generations.size < 5) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (const match of buffer.matchAll(/"generation":(\d+)/g)) {
        generations.add(Number(match[1]));
      }
    }

    controller.abort();
    const sorted = [...generations].sort((a, b) => a - b);
    expect(sorted).toEqual(sorted.map((_, i) => i)); // sequential from 0, no gaps or dupes
    expect(generations.size).toBeGreaterThanOrEqual(5);
  });

  it("closes cleanly on client disconnect: server keeps serving other requests afterward", async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/events?pattern=block&speed=50`, {
      signal: controller.signal,
    });
    const reader = res.body?.getReader();
    if (!reader) throw new Error("expected a readable response body");
    await reader.read(); // receive at least one frame before disconnecting
    controller.abort();

    // Give the server a moment to observe the disconnect and stop its interval.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const followUp = await fetch(`${baseUrl}/`);
    expect(followUp.status).toBe(200);
  });
});
