import { describe, expect, it } from "vitest";
import { create, fromString, get, set, toString, type Grid } from "../src/engine/grid.js";
import { applyRule, countLiveNeighbors } from "../src/engine/rules.js";

/**
 * Minimal reference generation step built directly from grid + rules primitives.
 * life.ts's double-buffered `step` (added next slice) must agree with this.
 */
function nextGeneration(grid: Grid): Grid {
  const next = create(grid.width, grid.height);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const alive = get(grid, x, y) === 1;
      const neighbors = countLiveNeighbors(grid, x, y);
      set(next, x, y, applyRule(alive, neighbors));
    }
  }
  return next;
}

describe("block still life", () => {
  it("remains unchanged across generations", () => {
    const block = fromString(["....", ".OO.", ".OO.", "...."].join("\n"));
    const after = nextGeneration(block);
    expect(toString(after)).toBe(toString(block));
  });
});

describe("blinker oscillator", () => {
  it("flips between horizontal and vertical every generation", () => {
    const horizontal = fromString([".....", ".....", ".OOO.", ".....", "....."].join("\n"));
    const vertical = fromString([".....", "..O..", "..O..", "..O..", "....."].join("\n"));

    const gen1 = nextGeneration(horizontal);
    expect(toString(gen1)).toBe(toString(vertical));

    const gen2 = nextGeneration(gen1);
    expect(toString(gen2)).toBe(toString(horizontal));
  });
});
