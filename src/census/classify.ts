import { create, get, set, type Grid } from "../engine/grid.js";
import { step } from "../engine/life.js";
import { DEFAULT_RULE, type RuleSet } from "../engine/rules.js";
import { canonicalKey } from "./canonical.js";
import { stabilize, type StabilizeStatus } from "./stabilize.js";

export type ObjectType = "still-life" | "oscillator" | "spaceship" | "extinct" | "unstabilized";

export interface ClassifiedObject {
  readonly type: ObjectType;
  readonly period: number;
  readonly displacement: readonly [number, number];
  readonly canonicalKey: string;
  readonly boundingBox: { readonly width: number; readonly height: number };
  readonly population: number;
}

const CLASSIFY_MAX_GENERATIONS = 100;
/** Cells of headroom on every side, so a moving spaceship has somewhere to go before the field boundary would clip it. */
const CLASSIFY_MARGIN = 60;

function typeFor(
  status: StabilizeStatus,
  period: number,
  displacement: readonly [number, number],
): ObjectType {
  if (status === "extinct") return "extinct";
  if (status === "unstabilized") return "unstabilized";
  if (displacement[0] !== 0 || displacement[1] !== 0) return "spaceship";
  return period === 1 ? "still-life" : "oscillator";
}

function liveCells(grid: Grid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (get(grid, x, y) === 1) cells.push([x, y]);
    }
  }
  return cells;
}

/**
 * A moving or oscillating object's canonical key must be invariant not just
 * under rotation/reflection but under *which phase of its period* got
 * captured: a glider's odd and even phases, for instance, aren't related by
 * any of the 8 dihedral transforms alone, even though they're the same
 * physical spaceship. Stepping through one full period and taking the
 * lexicographically smallest canonical key across all phases (equivalent to
 * the smallest over every phase x transform pair) makes the key phase-
 * invariant too.
 */
function phaseInvariantKey(field: Grid, period: number, rule: RuleSet): string {
  let current = field;
  let best: string | undefined;
  for (let i = 0; i < period; i++) {
    const candidate = canonicalKey(liveCells(current));
    if (best === undefined || candidate < best) best = candidate;
    current = step(current, rule);
  }
  return best as string;
}

/**
 * Classify a single already-separated object: re-run it in isolation on a
 * padded field (using the taxonomy's own definitions from the cycle
 * detector) and pair the result with its symmetry- and phase-invariant
 * canonical key. `cells` must already be normalized to origin (min x/y = 0),
 * as `separateComponents` and `nameFor`'s pattern library both produce.
 */
export function classifyObject(
  cells: ReadonlyArray<readonly [number, number]>,
  rule: RuleSet = DEFAULT_RULE,
  maxGenerations: number = CLASSIFY_MAX_GENERATIONS,
  margin: number = CLASSIFY_MARGIN,
): ClassifiedObject {
  let maxX = 0;
  let maxY = 0;
  for (const [x, y] of cells) {
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const width = maxX + 1;
  const height = maxY + 1;

  const field = create(width + margin * 2, height + margin * 2);
  for (const [x, y] of cells) set(field, x + margin, y + margin, 1);

  const result = stabilize(field, maxGenerations, rule);
  const key =
    result.status === "stable"
      ? phaseInvariantKey(field, result.period, rule)
      : canonicalKey(cells);

  return {
    type: typeFor(result.status, result.period, result.displacement),
    period: result.period,
    displacement: result.displacement,
    canonicalKey: key,
    boundingBox: { width, height },
    population: cells.length,
  };
}
