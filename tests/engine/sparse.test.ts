import { describe, expect, it } from "vitest";
import { DEFAULT_RULE, parseRulestring } from "../../src/engine/rules.js";
import { fromCells, run, step, toCells, type SparseGrid } from "../../src/engine/sparse.js";

function sortedCells(grid: SparseGrid): string[] {
  return toCells(grid)
    .map(([x, y]) => `${x},${y}`)
    .sort();
}

describe("sparse: fromCells / toCells", () => {
  it("round-trips a set of coordinates, deduplicating repeats", () => {
    const grid = fromCells([
      [1, 2],
      [3, 4],
      [1, 2],
    ]);
    expect(sortedCells(grid)).toEqual(["1,2", "3,4"]);
  });

  it("produces an empty grid from no cells", () => {
    expect(toCells(fromCells([]))).toEqual([]);
  });
});

describe("sparse: step", () => {
  it("stays empty forever", () => {
    expect(toCells(step(fromCells([])))).toEqual([]);
  });

  it("kills an isolated live cell (underpopulation)", () => {
    const grid = fromCells([[5, 5]]);
    expect(toCells(step(grid))).toEqual([]);
  });

  it("keeps a block still life stable", () => {
    const block = fromCells([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
    expect(sortedCells(step(block))).toEqual(sortedCells(block));
  });

  it("oscillates a blinker between horizontal and vertical", () => {
    const horizontal = fromCells([
      [0, 1],
      [1, 1],
      [2, 1],
    ]);
    const vertical = fromCells([
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
    expect(sortedCells(step(horizontal))).toEqual(sortedCells(vertical));
    expect(sortedCells(step(step(horizontal)))).toEqual(sortedCells(horizontal));
  });

  it("translates a glider by (+1, +1) every 4 generations", () => {
    const glider = fromCells([
      [1, 0],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
    const after4 = run(glider, 4);
    const expected = fromCells([
      [2, 1],
      [3, 2],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(sortedCells(after4)).toEqual(sortedCells(expected));
  });

  it("honors a custom rulestring (HighLife birth on 6 neighbors)", () => {
    const highlife = parseRulestring("B36/S23");
    // Six live neighbors around a dead center cell at (2,2).
    const grid = fromCells([
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [3, 2],
      [1, 3],
    ]);
    const next = step(grid, highlife);
    const defaultNext = step(grid, DEFAULT_RULE);
    expect(toCells(next).some(([x, y]) => x === 2 && y === 2)).toBe(true);
    expect(toCells(defaultNext).some(([x, y]) => x === 2 && y === 2)).toBe(false);
  });

  it("is unbounded: a live cell far from the origin still behaves correctly", () => {
    const block = fromCells([
      [1_000_000, 1_000_000],
      [1_000_001, 1_000_000],
      [1_000_000, 1_000_001],
      [1_000_001, 1_000_001],
    ]);
    expect(sortedCells(step(block))).toEqual(sortedCells(block));
  });
});

describe("sparse: run", () => {
  it("returns the grid unchanged after 0 generations", () => {
    const block = fromCells([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]);
    expect(sortedCells(run(block, 0))).toEqual(sortedCells(block));
  });
});
