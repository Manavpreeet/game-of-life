import { describe, expect, it } from "vitest";
import { create, get, set, toString, type Grid } from "../src/engine/grid.js";
import { run } from "../src/engine/life.js";
import { parseRLE } from "../src/io/rle.js";

/** Embed `grid` into a larger, zero-padded grid so boundary cells don't clip neighbor counts. */
function pad(grid: Grid, margin: number): Grid {
  const padded = create(grid.width + margin * 2, grid.height + margin * 2);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (get(grid, x, y) === 1) set(padded, x + margin, y + margin, 1);
    }
  }
  return padded;
}

const GLIDER_RLE = `#N Glider
#C https://www.conwaylife.com/wiki/Glider
x = 3, y = 3, rule = B3/S23
bob$2bo$3o!`;

const PULSAR_RLE = `#N Pulsar
#C https://www.conwaylife.com/wiki/Pulsar
x = 13, y = 13, rule = B3/S23
2b3o3b3o2b$$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2b$$2b3o3b3o2b$o4bobo4bo$o4bobo4bo$o4bobo4bo$$2b3o3b3o2b!`;

const PULSAR_ROWS = [
  "..OOO...OOO..",
  ".............",
  "O....O.O....O",
  "O....O.O....O",
  "O....O.O....O",
  "..OOO...OOO..",
  ".............",
  "..OOO...OOO..",
  "O....O.O....O",
  "O....O.O....O",
  "O....O.O....O",
  ".............",
  "..OOO...OOO..",
];

describe("RLE: glider", () => {
  it("parses to the canonical glider shape at the expected coordinates", () => {
    const { grid, name } = parseRLE(GLIDER_RLE);
    expect(name).toBe("Glider");
    expect(toString(grid)).toBe([".O.", "..O", "OOO"].join("\n"));
  });
});

describe("RLE: pulsar", () => {
  it("parses to the canonical 13x13 pulsar shape at the expected coordinates", () => {
    const { grid, name } = parseRLE(PULSAR_RLE);
    expect(name).toBe("Pulsar");
    expect(toString(grid)).toBe(PULSAR_ROWS.join("\n"));
  });

  it("is a genuine period-3 oscillator: returns to its parsed shape after 3 generations", () => {
    const { grid } = parseRLE(PULSAR_RLE);
    const padded = pad(grid, 4);
    const after3 = run(padded, 3);
    expect(toString(after3)).toBe(toString(pad(grid, 4)));
  });
});
