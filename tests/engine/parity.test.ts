import { describe, expect, it } from "vitest";
import { create, get, set } from "../../src/engine/grid.js";
import { run as denseRun } from "../../src/engine/life.js";
import { fromCells, run as sparseRun, toCells } from "../../src/engine/sparse.js";
import { loadPattern, type PatternName } from "../../src/io/patterns.js";

function cellKeys(cells: ReadonlyArray<readonly [number, number]>): string[] {
  return cells.map(([x, y]) => `${x},${y}`).sort();
}

/**
 * Run `name` through both engines for `generations` steps and assert the live-cell
 * sets agree exactly. The dense grid is padded by `margin` on every side so
 * Game-of-Life activity (which spreads at most one cell/generation) never reaches
 * the boundary and gets clipped -- the sparse engine has no such limit, so any
 * divergence here is a real bug, not a boundary artifact.
 */
function expectParity(name: PatternName, generations: number, margin: number): void {
  const { grid: source } = loadPattern(name);

  const dense = create(source.width + margin * 2, source.height + margin * 2);
  const initialCells: Array<[number, number]> = [];
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (get(source, x, y) === 1) {
        set(dense, x + margin, y + margin, 1);
        initialCells.push([x + margin, y + margin]);
      }
    }
  }
  const sparse = fromCells(initialCells);

  const denseAfter = denseRun(dense, generations);
  const sparseAfter = sparseRun(sparse, generations);

  const denseLiveCells: Array<[number, number]> = [];
  for (let y = 0; y < denseAfter.height; y++) {
    for (let x = 0; x < denseAfter.width; x++) {
      if (get(denseAfter, x, y) === 1) denseLiveCells.push([x, y]);
    }
  }

  expect(cellKeys(toCells(sparseAfter))).toEqual(cellKeys(denseLiveCells));
}

describe("dense vs sparse parity", () => {
  it("glider: agree after 16 generations (4 periods)", () => {
    expectParity("glider", 16, 26);
  });

  it("pulsar: agree after 9 generations (3 periods)", () => {
    expectParity("pulsar", 9, 19);
  });

  it("lwss: agree after 8 generations", () => {
    expectParity("lwss", 8, 18);
  });

  it("gosper glider gun: agree after 30 generations (still-active exhaust)", () => {
    expectParity("gosper-glider-gun", 30, 40);
  });
});
