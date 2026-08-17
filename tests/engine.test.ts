import { describe, expect, it } from "vitest";
import { create, fromString, get, set, toString, type Grid } from "../src/engine/grid.js";
import { run, step } from "../src/engine/life.js";

describe("block still life", () => {
  it("remains unchanged across generations", () => {
    const block = fromString(["....", ".OO.", ".OO.", "...."].join("\n"));
    const after = step(block);
    expect(toString(after)).toBe(toString(block));
  });
});

describe("blinker oscillator", () => {
  it("flips between horizontal and vertical every generation", () => {
    const horizontal = fromString([".....", ".....", ".OOO.", ".....", "....."].join("\n"));
    const vertical = fromString([".....", "..O..", "..O..", "..O..", "....."].join("\n"));

    const gen1 = step(horizontal);
    expect(toString(gen1)).toBe(toString(vertical));

    const gen2 = step(gen1);
    expect(toString(gen2)).toBe(toString(horizontal));
  });
});

/** Standard glider, top-left-relative offsets. Translates by (+1, +1) every 4 generations. */
const GLIDER_CELLS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [2, 1],
  [0, 2],
  [1, 2],
  [2, 2],
];

function liveCells(grid: Grid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (get(grid, x, y) === 1) cells.push([x, y]);
    }
  }
  return cells.sort(([ax, ay], [bx, by]) => ax - bx || ay - by);
}

describe("glider", () => {
  it("translates by (+1, +1) and returns to its original shape after 4 generations", () => {
    const ox = 3;
    const oy = 3;
    const grid = create(12, 12);
    for (const [dx, dy] of GLIDER_CELLS) set(grid, ox + dx, oy + dy, 1);

    const after4 = run(grid, 4);

    const expected = GLIDER_CELLS.map(([dx, dy]): [number, number] => [
      ox + 1 + dx,
      oy + 1 + dy,
    ]).sort(([ax, ay], [bx, by]) => ax - bx || ay - by);

    expect(liveCells(after4)).toEqual(expected);
  });
});
