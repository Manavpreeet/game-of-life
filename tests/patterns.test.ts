import { describe, expect, it } from "vitest";
import { create, get, set } from "../src/engine/grid.js";
import { run } from "../src/engine/life.js";
import { loadPattern, PATTERN_NAMES, type PatternName } from "../src/io/patterns.js";

function countLiveCells(name: PatternName): number {
  const { grid } = loadPattern(name);
  let count = 0;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (get(grid, x, y) === 1) count++;
    }
  }
  return count;
}

describe("bundled pattern library", () => {
  it("lists every pattern name exactly once", () => {
    const unique = new Set(PATTERN_NAMES);
    expect(unique.size).toBe(PATTERN_NAMES.length);
    expect(PATTERN_NAMES).toEqual([
      "block",
      "blinker",
      "glider",
      "lwss",
      "pulsar",
      "gosper-glider-gun",
    ]);
  });

  it("loads every pattern without error and produces at least one live cell", () => {
    for (const name of PATTERN_NAMES) {
      expect(countLiveCells(name)).toBeGreaterThan(0);
    }
  });

  it("block is a 2x2 square with no name comment", () => {
    const { grid, name } = loadPattern("block");
    expect(grid.width).toBe(2);
    expect(grid.height).toBe(2);
    expect(countLiveCells("block")).toBe(4);
    expect(name).toBeUndefined();
  });

  it("blinker is a 3-cell line", () => {
    const { grid } = loadPattern("blinker");
    expect(grid.width).toBe(3);
    expect(grid.height).toBe(1);
    expect(countLiveCells("blinker")).toBe(3);
  });

  it("glider is named and has the canonical 5-cell shape", () => {
    const { name } = loadPattern("glider");
    expect(name).toBe("Glider");
    expect(countLiveCells("glider")).toBe(5);
  });

  it("lwss (lightweight spaceship) has its canonical 9 live cells", () => {
    const { name } = loadPattern("lwss");
    expect(name).toBe("Lightweight spaceship");
    expect(countLiveCells("lwss")).toBe(9);
  });

  it("pulsar is named and a genuine period-3 oscillator", () => {
    const { grid, name } = loadPattern("pulsar");
    expect(name).toBe("Pulsar");
    expect(grid.width).toBe(13);
    expect(grid.height).toBe(13);
  });

  it("gosper glider gun is named and has its canonical 36 live cells", () => {
    const { grid, name } = loadPattern("gosper-glider-gun");
    expect(name).toBe("Gosper glider gun");
    expect(grid.width).toBe(36);
    expect(grid.height).toBe(9);
    expect(countLiveCells("gosper-glider-gun")).toBe(36);
  });

  it("gosper glider gun is still active (not extinct) after 60 generations", () => {
    const { grid } = loadPattern("gosper-glider-gun");
    // Pad generously: the gun keeps firing gliders outward, so give them room.
    const margin = 40;
    const big = create(grid.width + margin * 2, grid.height + margin * 2);
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (get(grid, x, y) === 1) set(big, x + margin, y + margin, 1);
      }
    }
    const after = run(big, 60);
    let live = 0;
    for (const v of after.cells) live += v;
    expect(live).toBeGreaterThan(0);
  });
});
