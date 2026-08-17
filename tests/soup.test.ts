import { describe, expect, it } from "vitest";
import { toString } from "../src/engine/grid.js";
import { generateSoup } from "../src/census/soup.js";

describe("soup generation", () => {
  it("is deterministic: the same seed reproduces an identical soup", () => {
    const a = generateSoup(42, 16, 16, 0.4);
    const b = generateSoup(42, 16, 16, 0.4);
    expect(toString(a)).toBe(toString(b));
  });

  it("different seeds produce different soups", () => {
    const a = generateSoup(0, 16, 16, 0.4);
    const b = generateSoup(1, 16, 16, 0.4);
    expect(toString(a)).not.toBe(toString(b));
  });

  it("respects the requested density within statistical tolerance", () => {
    const width = 200;
    const height = 200;
    const density = 0.3;
    const grid = generateSoup(7, width, height, density);
    const population = grid.cells.reduce((sum, cell) => sum + cell, 0);
    const fraction = population / (width * height);
    expect(Math.abs(fraction - density)).toBeLessThan(0.02);
  });

  it("zero density produces an empty grid", () => {
    const grid = generateSoup(0, 10, 10, 0);
    expect(grid.cells.reduce((sum, cell) => sum + cell, 0)).toBe(0);
  });
});
