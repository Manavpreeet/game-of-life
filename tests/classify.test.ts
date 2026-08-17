import { describe, expect, it } from "vitest";
import { classifyObject } from "../src/census/classify.js";
import { loadPattern } from "../src/io/patterns.js";
import { get } from "../src/engine/grid.js";

function liveCellsOf(name: Parameters<typeof loadPattern>[0]): Array<[number, number]> {
  const { grid } = loadPattern(name);
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (get(grid, x, y) === 1) cells.push([x, y]);
    }
  }
  return cells;
}

describe("classifyObject", () => {
  it("classifies a block as a still life", () => {
    const result = classifyObject(liveCellsOf("block"));
    expect(result.type).toBe("still-life");
    expect(result.period).toBe(1);
  });

  it("classifies a pulsar as a period-3 oscillator", () => {
    const result = classifyObject(liveCellsOf("pulsar"));
    expect(result.type).toBe("oscillator");
    expect(result.period).toBe(3);
    expect(result.displacement).toEqual([0, 0]);
  });

  it("classifies a glider as a spaceship with displacement (1, 1)", () => {
    const result = classifyObject(liveCellsOf("glider"));
    expect(result.type).toBe("spaceship");
    expect(result.period).toBe(4);
    expect(result.displacement).toEqual([1, 1]);
  });

  it("assigns the same canonical key to a block regardless of classification", () => {
    const a = classifyObject(liveCellsOf("block"));
    const b = classifyObject(liveCellsOf("block"));
    expect(a.canonicalKey).toBe(b.canonicalKey);
  });
});
