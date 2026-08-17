import type { Grid } from "./grid.js";
import { get } from "./grid.js";

export const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/** Count live neighbors in the 8-cell Moore neighborhood. Cells outside the grid count as dead. */
export function countLiveNeighbors(grid: Grid, x: number, y: number): number {
  let count = 0;
  for (const [dx, dy] of NEIGHBOR_OFFSETS) {
    count += get(grid, x + dx, y + dy);
  }
  return count;
}

/** A rulestring's birth/survival neighbor counts (0-8 each), e.g. B3/S23. */
export interface RuleSet {
  readonly births: ReadonlySet<number>;
  readonly survivals: ReadonlySet<number>;
}

const RULESTRING_PATTERN = /^B([0-8]*)\/S([0-8]*)$/i;

/** Parse a `Bxx/Sxx` rulestring (e.g. "B3/S23", "B36/S23" for HighLife) into a RuleSet. */
export function parseRulestring(rulestring: string): RuleSet {
  const match = RULESTRING_PATTERN.exec(rulestring.trim());
  if (!match) {
    throw new Error(`Invalid rulestring "${rulestring}": expected format Bxx/Sxx`);
  }
  const [, births, survivals] = match;
  return {
    births: new Set([...(births ?? "")].map(Number)),
    survivals: new Set([...(survivals ?? "")].map(Number)),
  };
}

/** Standard Conway rules: a live cell survives on 2-3 neighbors, a dead cell is born on 3. */
export const DEFAULT_RULE: RuleSet = parseRulestring("B3/S23");

/** Given current state, live neighbor count, and a rule (default B3/S23), returns next state. */
export function applyRule(
  alive: boolean,
  liveNeighbors: number,
  rule: RuleSet = DEFAULT_RULE,
): 0 | 1 {
  const set = alive ? rule.survivals : rule.births;
  return set.has(liveNeighbors) ? 1 : 0;
}
