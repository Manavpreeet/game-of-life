import { get, type Grid } from "../engine/grid.js";
import { loadPattern, PATTERN_NAMES, type PatternName } from "../io/patterns.js";
import { parseRLE } from "../io/rle.js";
import { canonicalKey } from "./canonical.js";

/**
 * A few common still lifes/oscillators the base pattern library doesn't
 * bundle (it only carries what the base build needed). Defined locally here,
 * as plain RLE, so `io/patterns.ts` stays untouched -- this feature is
 * additive only.
 */
const EXTRA_PATTERNS: Record<string, string> = {
  beehive: "x = 4, y = 3, rule = B3/S23\nb2o$o2bo$b2o!",
  loaf: "x = 4, y = 4, rule = B3/S23\nb2o$o2bo$bobo$2bo!",
  toad: "x = 4, y = 2, rule = B3/S23\nb3o$3o!",
  beacon: "x = 4, y = 4, rule = B3/S23\n2o$2o$2b2o$2b2o!",
};

const DISPLAY_NAMES: Partial<Record<PatternName, string>> = {
  "gosper-glider-gun": "Gosper glider gun",
  lwss: "Lightweight spaceship",
};

function liveCellsOf(grid: Grid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (get(grid, x, y) === 1) cells.push([x, y]);
    }
  }
  return cells;
}

/** Build a canonical-key -> display-name table by canonicalizing the bundled pattern library at startup, rather than hand-encoding keys. */
function buildNameTable(): Map<string, string> {
  const table = new Map<string, string>();
  for (const name of PATTERN_NAMES) {
    const { grid } = loadPattern(name);
    table.set(canonicalKey(liveCellsOf(grid)), DISPLAY_NAMES[name] ?? name);
  }
  for (const [name, rle] of Object.entries(EXTRA_PATTERNS)) {
    const { grid } = parseRLE(rle);
    table.set(canonicalKey(liveCellsOf(grid)), name);
  }
  return table;
}

const NAME_TABLE = buildNameTable();
const UNKNOWN_KEY_PREVIEW_LENGTH = 24;

/** Look up a known object's display name by canonical key; unknown objects report a truncated key instead. */
export function nameFor(key: string): string {
  const known = NAME_TABLE.get(key);
  if (known) return known;
  const preview =
    key.length > UNKNOWN_KEY_PREVIEW_LENGTH ? `${key.slice(0, UNKNOWN_KEY_PREVIEW_LENGTH)}…` : key;
  return `unknown(${preview})`;
}
