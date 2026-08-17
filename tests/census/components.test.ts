import { describe, expect, it } from "vitest";
import { create, set } from "../../src/engine/grid.js";
import { separateComponents } from "../../src/census/components.js";

describe("separateComponents", () => {
  it("isolates a block and a distant blinker as two components with correct shapes", () => {
    const grid = create(20, 20);
    // Block at (1,1)-(2,2).
    set(grid, 1, 1, 1);
    set(grid, 2, 1, 1);
    set(grid, 1, 2, 1);
    set(grid, 2, 2, 1);
    // Blinker far away, horizontal, at y=15.
    set(grid, 14, 15, 1);
    set(grid, 15, 15, 1);
    set(grid, 16, 15, 1);

    const components = separateComponents(grid);
    expect(components).toHaveLength(2);

    const byPopulation = [...components].sort((a, b) => a.population - b.population);
    const blinker = byPopulation[0];
    const block = byPopulation[1];

    expect(block?.population).toBe(4);
    expect(block?.boundingBox).toEqual({ x: 1, y: 1, width: 2, height: 2 });

    expect(blinker?.population).toBe(3);
    expect(blinker?.boundingBox).toEqual({ x: 14, y: 15, width: 3, height: 1 });
    expect(blinker?.cells).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
  });

  it("merges components whose bounding boxes lie within the proximity gap", () => {
    const grid = create(10, 10);
    set(grid, 1, 1, 1);
    set(grid, 3, 1, 1); // 2 cells away from the first -- within the default gap of 2
    const components = separateComponents(grid);
    expect(components).toHaveLength(1);
    expect(components[0]?.population).toBe(2);
  });

  it("returns no components for an empty grid", () => {
    expect(separateComponents(create(5, 5))).toHaveLength(0);
  });
});
