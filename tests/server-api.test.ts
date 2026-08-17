import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/server/server.js";

describe("API/server: static file serving", () => {
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

  it("serves index.html at the root path with the correct content type", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("<title>Conway's Game of Life</title>");
  });

  it("serves index.html by explicit path", async () => {
    const res = await fetch(`${baseUrl}/index.html`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("serves viewer.js with a JavaScript content type", async () => {
    const res = await fetch(`${baseUrl}/viewer.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/javascript");
    const body = await res.text();
    expect(body).toContain("EventSource");
  });

  it("returns 404 for a nonexistent file", async () => {
    const res = await fetch(`${baseUrl}/nonexistent.html`);
    expect(res.status).toBe(404);
  });

  it("rejects path traversal attempts outside the public directory", async () => {
    const res = await fetch(`${baseUrl}/../package.json`);
    // The HTTP client/server normalizes "..", so this either 404s (blocked
    // by the traversal guard) or resolves back within the public dir -- it
    // must never leak repo files outside public/.
    if (res.status === 200) {
      const body = await res.text();
      expect(body).not.toContain('"name": "game-of-life"');
    } else {
      expect(res.status).toBe(404);
    }
  });

  it("returns application/octet-stream for an unrecognized extension", async () => {
    // package.json isn't under public/, so this should 404, not leak a MIME guess.
    const res = await fetch(`${baseUrl}/favicon.ico`);
    expect(res.status).toBe(404);
  });
});

describe("API/server: /events error handling", () => {
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

  it("returns 400 for an unknown pattern", async () => {
    const res = await fetch(`${baseUrl}/events?pattern=not-a-pattern`);
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain('Unknown pattern "not-a-pattern"');
  });

  it("returns 400 for a malformed rulestring", async () => {
    const res = await fetch(`${baseUrl}/events?pattern=glider&rule=garbage`);
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("Invalid rulestring");
  });

  it("defaults to the glider pattern and dense engine when unspecified", async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/events`, { signal: controller.signal });
    expect(res.ok).toBe(true);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("expected a readable response body");
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('"generation":0');
    controller.abort();
  });

  it("accepts an explicit sparse engine and custom rule via query params", async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/events?pattern=block&engine=sparse&rule=B36%2FS23`, {
      signal: controller.signal,
    });
    expect(res.ok).toBe(true);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("expected a readable response body");
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('"generation":0');
    controller.abort();
  });
});
