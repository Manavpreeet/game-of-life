import { create, set } from "../engine/grid.js";
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

/**
 * Classify a single already-separated object: re-run it in isolation on a
 * padded field (using the taxonomy's own definitions from the cycle
 * detector) and pair the result with its symmetry-invariant canonical key.
 * `cells` must already be normalized to origin (min x/y = 0), as
 * `separateComponents` and `nameFor`'s pattern library both produce.
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

  return {
    type: typeFor(result.status, result.period, result.displacement),
    period: result.period,
    displacement: result.displacement,
    canonicalKey: canonicalKey(cells),
    boundingBox: { width, height },
    population: cells.length,
  };
}
