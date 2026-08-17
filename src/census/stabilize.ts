import { get, type Grid } from "../engine/grid.js";
import { step } from "../engine/life.js";
import { DEFAULT_RULE, type RuleSet } from "../engine/rules.js";

export type StabilizeStatus = "extinct" | "stable" | "unstabilized";

export interface StabilizeResult {
  readonly status: StabilizeStatus;
  /** Generations between repeated states; 0 when extinct or unstabilized. */
  readonly period: number;
  /** Absolute-origin delta over one period; [0, 0] unless status is "stable". */
  readonly displacement: readonly [number, number];
  readonly finalGrid: Grid;
  readonly gensRun: number;
}

const DEFAULT_MAX_GENERATIONS = 5000;

function liveCells(grid: Grid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (get(grid, x, y) === 1) cells.push([x, y]);
    }
  }
  return cells;
}

interface NormalizedState {
  readonly hash: string;
  readonly originX: number;
  readonly originY: number;
}

/**
 * Translate live cells so the minimum x/y is 0, then serialize the shape.
 * This is the key trick: without normalizing away absolute position, a
 * moving spaceship's state never repeats, since it's never in the same place
 * twice even though its shape cycles.
 */
function normalize(cells: ReadonlyArray<readonly [number, number]>): NormalizedState {
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of cells) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  const shifted = cells
    .map(([x, y]): [number, number] => [x - minX, y - minY])
    .sort(([ax, ay], [bx, by]) => ax - bx || ay - by);
  return {
    hash: shifted.map(([x, y]) => `${x},${y}`).join(";"),
    originX: minX,
    originY: minY,
  };
}

/**
 * Step `grid` until its origin-normalized live-cell shape repeats a prior
 * one, dies out, or the generation cap is reached. The generation gap
 * between repeats is the period; the absolute-origin delta between them is
 * the displacement -- zero for still lifes/oscillators, non-zero for
 * spaceships.
 */
export function stabilize(
  grid: Grid,
  maxGenerations: number = DEFAULT_MAX_GENERATIONS,
  rule: RuleSet = DEFAULT_RULE,
): StabilizeResult {
  const seen = new Map<string, { generation: number; originX: number; originY: number }>();
  let current = grid;

  for (let generation = 0; generation <= maxGenerations; generation++) {
    const cells = liveCells(current);
    if (cells.length === 0) {
      return {
        status: "extinct",
        period: 0,
        displacement: [0, 0],
        finalGrid: current,
        gensRun: generation,
      };
    }

    const { hash, originX, originY } = normalize(cells);
    const prior = seen.get(hash);
    if (prior) {
      return {
        status: "stable",
        period: generation - prior.generation,
        displacement: [originX - prior.originX, originY - prior.originY],
        finalGrid: current,
        gensRun: generation,
      };
    }
    seen.set(hash, { generation, originX, originY });
    current = step(current, rule);
  }

  return {
    status: "unstabilized",
    period: 0,
    displacement: [0, 0],
    finalGrid: current,
    gensRun: maxGenerations,
  };
}
