import { describe, expect, it } from "vitest";
import {
  embedInDenseGrid,
  parseArgs,
  patternToCells,
  renderDense,
  renderSparseViewport,
} from "../../src/cli.js";
import { create, fromString, set } from "../../src/engine/grid.js";
import { DEFAULT_RULE } from "../../src/engine/rules.js";

describe("cli: parseArgs", () => {
  it("applies defaults when no flags are given", () => {
    const opts = parseArgs([]);
    expect(opts).toEqual({
      pattern: "glider",
      rule: DEFAULT_RULE,
      generations: 300,
      width: 50,
      height: 26,
      engine: "dense",
      delayMs: 120,
    });
  });

  it("parses all flags when provided", () => {
    const opts = parseArgs([
      "--pattern",
      "block",
      "--rule",
      "B36/S23",
      "--gens",
      "10",
      "--width",
      "20",
      "--height",
      "15",
      "--engine",
      "sparse",
      "--delay",
      "5",
    ]);
    expect(opts.pattern).toBe("block");
    expect(opts.generations).toBe(10);
    expect(opts.width).toBe(20);
    expect(opts.height).toBe(15);
    expect(opts.engine).toBe("sparse");
    expect(opts.delayMs).toBe(5);
    expect([...opts.rule.births].sort()).toEqual([3, 6]);
    expect([...opts.rule.survivals].sort()).toEqual([2, 3]);
  });

  it("rejects an unknown pattern name", () => {
    expect(() => parseArgs(["--pattern", "not-a-real-pattern"])).toThrow(/Unknown --pattern/);
  });

  it("falls back to dense for any --engine value other than 'sparse'", () => {
    expect(parseArgs(["--engine", "bogus"]).engine).toBe("dense");
  });

  it("treats a flag with no following value as a boolean 'true'", () => {
    // --pattern is the last token, so it has no value to consume.
    expect(() => parseArgs(["--pattern"])).toThrow(/Unknown --pattern "true"/);
  });

  it("does not consume a following token that is itself a flag", () => {
    const opts = parseArgs(["--engine", "--gens", "5"]);
    expect(opts.engine).toBe("dense"); // "--engine" got "true", not "--gens"
    expect(opts.generations).toBe(5);
  });
});

describe("cli: embedInDenseGrid", () => {
  it("centers the pattern within a larger requested viewport", () => {
    const pattern = fromString("O");
    const grid = embedInDenseGrid(pattern, 5, 3);
    expect(grid.width).toBe(5);
    expect(grid.height).toBe(3);
    expect(renderDense(grid)).toBe(["·····", "··█··", "·····"].join("\n"));
  });

  it("grows the grid to fit a pattern larger than the requested viewport", () => {
    const pattern = fromString("OOO\nOOO\nOOO");
    const grid = embedInDenseGrid(pattern, 1, 1);
    expect(grid.width).toBe(3);
    expect(grid.height).toBe(3);
  });
});

describe("cli: patternToCells", () => {
  it("extracts coordinates of every live cell", () => {
    const pattern = fromString(".O\nO.");
    const cells = patternToCells(pattern);
    expect(cells.sort()).toEqual([
      [0, 1],
      [1, 0],
    ]);
  });

  it("returns an empty array for an all-dead pattern", () => {
    const pattern = create(3, 3);
    expect(patternToCells(pattern)).toEqual([]);
  });
});

describe("cli: renderDense", () => {
  it("renders live cells as █ and dead cells as ·", () => {
    const grid = create(2, 1);
    set(grid, 1, 0, 1);
    expect(renderDense(grid)).toBe("·█");
  });
});

describe("cli: renderSparseViewport", () => {
  it("renders live cells within the viewport, translated by the given offset", () => {
    const cells: Array<[number, number]> = [
      [0, 0],
      [1, 1],
    ];
    expect(renderSparseViewport(cells, 0, 0, 2, 2)).toBe(["█·", "·█"].join("\n"));
  });

  it("omits live cells that fall outside the viewport window", () => {
    const cells: Array<[number, number]> = [[100, 100]];
    expect(renderSparseViewport(cells, 0, 0, 2, 2)).toBe(["··", "··"].join("\n"));
  });

  it("applies the offset so out-of-view coordinates can be brought into frame", () => {
    const cells: Array<[number, number]> = [[10, 10]];
    expect(renderSparseViewport(cells, 10, 10, 2, 2)).toBe(["█·", "··"].join("\n"));
  });
});
