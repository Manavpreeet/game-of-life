import type { Grid } from "./grid.js";
import { create, get, set } from "./grid.js";
import { applyRule, countLiveNeighbors, DEFAULT_RULE, type RuleSet } from "./rules.js";

/**
 * Advance one generation under `rule` (default B3/S23). Reads are taken entirely
 * from `grid`; writes land in a fresh buffer, so births/deaths are simultaneous
 * (the classic "NaiveLife" bug this avoids: mutating in place would let a cell's
 * own update affect its neighbors' counts within the same generation).
 */
export function step(grid: Grid, rule: RuleSet = DEFAULT_RULE): Grid {
  const next = create(grid.width, grid.height);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const alive = get(grid, x, y) === 1;
      const neighbors = countLiveNeighbors(grid, x, y);
      set(next, x, y, applyRule(alive, neighbors, rule));
    }
  }
  return next;
}

/** Run `generations` steps under `rule` (default B3/S23), returning the final grid. */
export function run(grid: Grid, generations: number, rule: RuleSet = DEFAULT_RULE): Grid {
  let current = grid;
  for (let i = 0; i < generations; i++) {
    current = step(current, rule);
  }
  return current;
}
