// @vitest-environment jsdom
/// <reference lib="dom" />
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSoup } from "../../src/census/soup.js";
import { get as gridGet, type Grid } from "../../src/engine/grid.js";

interface LifeEngine {
  parseRulestring(raw: string | null): { births: Set<number>; survivals: Set<number> };
  stepLiveCells(
    live: Set<string>,
    rule: { births: Set<number>; survivals: Set<number> },
  ): Set<string>;
  generateSoupCells(
    seed: number,
    width: number,
    height: number,
    density: number,
  ): Array<[number, number]>;
}

declare global {
  interface Window {
    LifeEngine: LifeEngine;
  }
}

async function loadEngine(): Promise<LifeEngine> {
  vi.resetModules();
  // @ts-expect-error life-engine.js is a plain browser script with no type declarations
  await import("../../public/components/life-engine.js");
  return window.LifeEngine;
}

function serverSoupCells(grid: Grid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (gridGet(grid, x, y) === 1) cells.push([x, y]);
    }
  }
  return cells;
}

describe("LifeEngine.parseRulestring", () => {
  it("parses Conway's default rule", async () => {
    const engine = await loadEngine();
    const rule = engine.parseRulestring("B3/S23");
    expect(rule.births).toEqual(new Set([3]));
    expect(rule.survivals).toEqual(new Set([2, 3]));
  });

  it("parses HighLife (B36/S23)", async () => {
    const engine = await loadEngine();
    const rule = engine.parseRulestring("B36/S23");
    expect(rule.births).toEqual(new Set([3, 6]));
  });

  it("falls back to Conway's rule for unparseable input", async () => {
    const engine = await loadEngine();
    const rule = engine.parseRulestring("not-a-rule");
    expect(rule.births).toEqual(new Set([3]));
    expect(rule.survivals).toEqual(new Set([2, 3]));
  });
});

describe("LifeEngine.stepLiveCells", () => {
  it("keeps a block (still life) unchanged", async () => {
    const engine = await loadEngine();
    const rule = engine.parseRulestring("B3/S23");
    const block = new Set(["0,0", "1,0", "0,1", "1,1"]);
    expect(engine.stepLiveCells(block, rule)).toEqual(block);
  });

  it("moves a glider by (1, 1) every 4 generations", async () => {
    const engine = await loadEngine();
    const rule = engine.parseRulestring("B3/S23");
    let live = new Set(["1,0", "2,1", "0,2", "1,2", "2,2"]);
    for (let i = 0; i < 4; i++) live = engine.stepLiveCells(live, rule);
    const expected = new Set(["2,1", "3,2", "1,3", "2,3", "3,3"]);
    expect(live).toEqual(expected);
  });
});

describe("LifeEngine.generateSoupCells", () => {
  beforeEach(async () => {
    await loadEngine();
  });

  it("is deterministic: the same seed reproduces the same cells", async () => {
    const engine = await loadEngine();
    const a = engine.generateSoupCells(42, 12, 12, 0.4);
    const b = engine.generateSoupCells(42, 12, 12, 0.4);
    expect(a).toEqual(b);
  });

  it("matches the server's seeded soup generator bit-for-bit", async () => {
    const engine = await loadEngine();
    for (const seed of [0, 1, 7, 42]) {
      const clientCells = engine.generateSoupCells(seed, 16, 16, 0.4);
      const serverCells = serverSoupCells(generateSoup(seed, 16, 16, 0.4));
      expect(clientCells).toEqual(serverCells);
    }
  });
});
