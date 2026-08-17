import type { Grid } from "./grid.js";
import { get } from "./grid.js";

const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
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

/** Pure B3/S23 rule: given current state and live neighbor count, returns next state. */
export function applyRule(alive: boolean, liveNeighbors: number): 0 | 1 {
  if (alive) {
    return liveNeighbors === 2 || liveNeighbors === 3 ? 1 : 0;
  }
  return liveNeighbors === 3 ? 1 : 0;
}
