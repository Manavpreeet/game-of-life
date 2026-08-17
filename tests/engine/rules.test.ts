import { describe, expect, it } from "vitest";
import { create, get, set } from "../../src/engine/grid.js";
import { step } from "../../src/engine/life.js";
import { applyRule, DEFAULT_RULE, parseRulestring } from "../../src/engine/rules.js";

describe("rulestring parsing", () => {
  it("parses B3/S23 into the correct birth/survival sets", () => {
    const rule = parseRulestring("B3/S23");
    expect([...rule.births].sort()).toEqual([3]);
    expect([...rule.survivals].sort()).toEqual([2, 3]);
  });

  it("parses HighLife B36/S23", () => {
    const rule = parseRulestring("B36/S23");
    expect([...rule.births].sort()).toEqual([3, 6]);
    expect([...rule.survivals].sort()).toEqual([2, 3]);
  });

  it("rejects malformed rulestrings", () => {
    expect(() => parseRulestring("garbage")).toThrow();
  });
});

describe("HighLife (B36/S23)", () => {
  const highlife = parseRulestring("B36/S23");

  it("births a dead cell with 6 live neighbors, unlike standard B3/S23", () => {
    expect(applyRule(false, 6, highlife)).toBe(1);
    expect(applyRule(false, 6, DEFAULT_RULE)).toBe(0);
  });

  it("steps a grid under HighLife rules, producing a birth the default rule would not", () => {
    // Dead center cell surrounded by exactly 6 live neighbors (6 of its 8 Moore cells).
    const grid = create(5, 5);
    const sixNeighbors: ReadonlyArray<readonly [number, number]> = [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
    ];
    for (const [dx, dy] of sixNeighbors) set(grid, 2 + dx, 2 + dy, 1);

    const highlifeNext = step(grid, highlife);
    const defaultNext = step(grid, DEFAULT_RULE);

    expect(get(highlifeNext, 2, 2)).toBe(1);
    expect(get(defaultNext, 2, 2)).toBe(0);
  });
});
