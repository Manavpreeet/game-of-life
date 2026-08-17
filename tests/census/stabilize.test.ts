import { describe, expect, it } from "vitest";
import { create, fromString, set } from "../../src/engine/grid.js";
import { stabilize } from "../../src/census/stabilize.js";

describe("stabilize: still life", () => {
  it("detects a block as period 1 with zero displacement", () => {
    const block = fromString(["....", ".OO.", ".OO.", "...."].join("\n"));
    const result = stabilize(block);
    expect(result.status).toBe("stable");
    expect(result.period).toBe(1);
    expect(result.displacement).toEqual([0, 0]);
  });
});

describe("stabilize: oscillator", () => {
  it("detects a blinker as period 2 with zero displacement", () => {
    const blinker = fromString([".....", ".....", ".OOO.", ".....", "....."].join("\n"));
    const result = stabilize(blinker);
    expect(result.status).toBe("stable");
    expect(result.period).toBe(2);
    expect(result.displacement).toEqual([0, 0]);
  });
});

describe("stabilize: spaceship", () => {
  it("detects a glider as period 4 with displacement (1, 1)", () => {
    const grid = create(30, 30);
    const GLIDER: ReadonlyArray<readonly [number, number]> = [
      [1, 0],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ];
    for (const [dx, dy] of GLIDER) set(grid, 3 + dx, 3 + dy, 1);

    const result = stabilize(grid);
    expect(result.status).toBe("stable");
    expect(result.period).toBe(4);
    expect(result.displacement).toEqual([1, 1]);
  });
});

describe("stabilize: extinction", () => {
  it("detects a died-out soup as extinct", () => {
    const grid = create(10, 10);
    set(grid, 5, 5, 1); // a single live cell always dies next generation
    const result = stabilize(grid);
    expect(result.status).toBe("extinct");
  });
});

describe("stabilize: unstabilized", () => {
  it("reports unstabilized when no cycle is found within the generation cap", () => {
    const grid = create(30, 30);
    const GLIDER: ReadonlyArray<readonly [number, number]> = [
      [1, 0],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ];
    for (const [dx, dy] of GLIDER) set(grid, 3 + dx, 3 + dy, 1);

    const result = stabilize(grid, 2); // a glider needs 4 generations to repeat
    expect(result.status).toBe("unstabilized");
    expect(result.gensRun).toBe(2);
  });
});
