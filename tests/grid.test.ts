import { describe, expect, it } from "vitest";
import { clone, create, fromString, get, inBounds, set, toString } from "../src/engine/grid.js";

describe("grid", () => {
  it("creates a grid of the given size, all dead", () => {
    const grid = create(3, 2);
    expect(grid.width).toBe(3);
    expect(grid.height).toBe(2);
    expect(grid.cells.length).toBe(6);
    expect([...grid.cells]).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("throws for non-positive dimensions", () => {
    expect(() => create(0, 1)).toThrow(RangeError);
    expect(() => create(1, -1)).toThrow(RangeError);
  });

  it("reports bounds correctly", () => {
    const grid = create(2, 2);
    expect(inBounds(grid, 0, 0)).toBe(true);
    expect(inBounds(grid, 1, 1)).toBe(true);
    expect(inBounds(grid, -1, 0)).toBe(false);
    expect(inBounds(grid, 2, 0)).toBe(false);
    expect(inBounds(grid, 0, 2)).toBe(false);
  });

  it("get returns 0 for out-of-bounds cells", () => {
    const grid = create(2, 2);
    expect(get(grid, -1, 0)).toBe(0);
    expect(get(grid, 5, 5)).toBe(0);
  });

  it("set/get round-trips a cell value", () => {
    const grid = create(2, 2);
    set(grid, 1, 0, 1);
    expect(get(grid, 1, 0)).toBe(1);
    expect(get(grid, 0, 0)).toBe(0);
  });

  it("set throws for out-of-bounds coordinates", () => {
    const grid = create(2, 2);
    expect(() => set(grid, 2, 0, 1)).toThrow(RangeError);
  });

  it("clone produces an independent copy", () => {
    const grid = create(2, 2);
    set(grid, 0, 0, 1);
    const copy = clone(grid);
    set(copy, 1, 1, 1);
    expect(get(grid, 1, 1)).toBe(0);
    expect(get(copy, 0, 0)).toBe(1);
  });

  it("fromString parses live/dead cells and pads short lines", () => {
    const grid = fromString(".O\nO.\nO");
    expect(grid.width).toBe(2);
    expect(grid.height).toBe(3);
    expect(get(grid, 0, 0)).toBe(0);
    expect(get(grid, 1, 0)).toBe(1);
    expect(get(grid, 0, 1)).toBe(1);
    expect(get(grid, 0, 2)).toBe(1);
    expect(get(grid, 1, 2)).toBe(0);
  });

  it("toString round-trips fromString output", () => {
    const pattern = "O.\n.O";
    const grid = fromString(pattern);
    expect(toString(grid)).toBe(pattern);
  });

  it("toString supports custom alive/dead characters", () => {
    const grid = fromString("O.\n.O");
    expect(toString(grid, "#", "-")).toBe("#-\n-#");
  });
});
