import { applyRule, DEFAULT_RULE, NEIGHBOR_OFFSETS, type RuleSet } from "./rules.js";

/** Sparse representation: the set of live cells only, keyed "x,y". Grid is unbounded. */
export type SparseGrid = ReadonlySet<string>;

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function parseKey(cellKey: string): [number, number] {
  const [xs, ys] = cellKey.split(",");
  return [Number(xs), Number(ys)];
}

export function fromCells(cells: Iterable<readonly [number, number]>): SparseGrid {
  const grid = new Set<string>();
  for (const [x, y] of cells) grid.add(key(x, y));
  return grid;
}

export function toCells(grid: SparseGrid): Array<[number, number]> {
  return [...grid].map(parseKey);
}

/**
 * Advance one generation. Only live cells and their neighbors are ever examined
 * (any cell further away has zero live neighbors and can never be born), which is
 * what makes this engine viable on effectively infinite grids.
 */
export function step(grid: SparseGrid, rule: RuleSet = DEFAULT_RULE): SparseGrid {
  const neighborCounts = new Map<string, number>();
  for (const cellKey of grid) {
    const [x, y] = parseKey(cellKey);
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const neighborKey = key(x + dx, y + dy);
      neighborCounts.set(neighborKey, (neighborCounts.get(neighborKey) ?? 0) + 1);
    }
    if (!neighborCounts.has(cellKey)) neighborCounts.set(cellKey, 0);
  }

  const next = new Set<string>();
  for (const [cellKey, liveNeighbors] of neighborCounts) {
    if (applyRule(grid.has(cellKey), liveNeighbors, rule) === 1) next.add(cellKey);
  }
  return next;
}

/** Run `generations` steps under `rule` (default B3/S23), returning the final live-cell set. */
export function run(
  grid: SparseGrid,
  generations: number,
  rule: RuleSet = DEFAULT_RULE,
): SparseGrid {
  let current = grid;
  for (let i = 0; i < generations; i++) {
    current = step(current, rule);
  }
  return current;
}
