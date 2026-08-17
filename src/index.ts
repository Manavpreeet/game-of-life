/**
 * Public API for the game-of-life library.
 *
 * @example Dense engine, default Conway rules
 * ```ts
 * import { create, set, step, toString } from "game-of-life";
 *
 * let grid = create(5, 5);
 * set(grid, 1, 2, 1);
 * set(grid, 2, 2, 1);
 * set(grid, 3, 2, 1);
 * grid = step(grid); // one generation under B3/S23
 * console.log(toString(grid));
 * ```
 *
 * @example Sparse engine on an unbounded grid, HighLife rules
 * ```ts
 * import { fromCells, run, parseRulestring } from "game-of-life";
 *
 * const highlife = parseRulestring("B36/S23");
 * const glider = fromCells([[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]);
 * const after10 = run(glider, 10, highlife);
 * ```
 *
 * @example Loading a bundled pattern from RLE
 * ```ts
 * import { loadPattern } from "game-of-life";
 *
 * const { grid, name } = loadPattern("gosper-glider-gun");
 * ```
 */

export {
  clone,
  create,
  fromString,
  get,
  inBounds,
  set,
  toString,
  type Grid,
} from "./engine/grid.js";

export {
  applyRule,
  countLiveNeighbors,
  DEFAULT_RULE,
  NEIGHBOR_OFFSETS,
  parseRulestring,
  type RuleSet,
} from "./engine/rules.js";

export { run, step } from "./engine/life.js";

export {
  fromCells as sparseFromCells,
  run as sparseRun,
  step as sparseStep,
  toCells as sparseToCells,
  type SparseGrid,
} from "./engine/sparse.js";

export { parseRLE, type ParsedRLE } from "./io/rle.js";

export { loadPattern, PATTERN_NAMES, type PatternName } from "./io/patterns.js";
