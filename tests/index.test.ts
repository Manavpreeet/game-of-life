import { describe, expect, it } from "vitest";
import * as api from "../src/index.js";

describe("public API surface", () => {
  it("exports the full documented set of names", () => {
    const expected = [
      "clone",
      "create",
      "fromString",
      "get",
      "inBounds",
      "set",
      "toString",
      "applyRule",
      "countLiveNeighbors",
      "DEFAULT_RULE",
      "NEIGHBOR_OFFSETS",
      "parseRulestring",
      "run",
      "step",
      "sparseFromCells",
      "sparseRun",
      "sparseStep",
      "sparseToCells",
      "parseRLE",
      "loadPattern",
      "PATTERN_NAMES",
    ];
    for (const name of expected) {
      expect(api, `expected export "${name}"`).toHaveProperty(name);
    }
  });

  it("dense engine: builds, steps, and stringifies a grid (README example)", () => {
    let grid = api.create(5, 5);
    api.set(grid, 1, 2, 1);
    api.set(grid, 2, 2, 1);
    api.set(grid, 3, 2, 1);
    grid = api.step(grid);
    expect(api.toString(grid)).toBe([".....", "..O..", "..O..", "..O..", "....."].join("\n"));
  });

  it("sparse engine: runs a glider under a custom rulestring (README example)", () => {
    const highlife = api.parseRulestring("B36/S23");
    const glider = api.sparseFromCells([
      [1, 0],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
    const after10 = api.sparseRun(glider, 10, highlife);
    expect(api.sparseToCells(after10).length).toBeGreaterThan(0);
  });

  it("loadPattern: loads a bundled pattern by name (README example)", () => {
    const { grid, name } = api.loadPattern("gosper-glider-gun");
    expect(name).toBe("Gosper glider gun");
    expect(grid.width).toBe(36);
  });

  it("parseRLE: parses raw RLE text into a usable grid", () => {
    const { grid } = api.parseRLE("x = 2, y = 2, rule = B3/S23\n2o$2o!");
    expect(api.toString(grid)).toBe(["OO", "OO"].join("\n"));
  });
});
