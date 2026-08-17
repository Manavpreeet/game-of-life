import { parseRLE, type ParsedRLE } from "./rle.js";

const PATTERN_RLE = {
  block: "x = 2, y = 2, rule = B3/S23\n2o$2o!",
  blinker: "x = 3, y = 1, rule = B3/S23\n3o!",
  glider: "#N Glider\nx = 3, y = 3, rule = B3/S23\nbob$2bo$3o!",
  lwss: "#N Lightweight spaceship\nx = 5, y = 4, rule = B3/S23\nbo2bo$o4b$o3bo$4o!",
  pulsar:
    "#N Pulsar\nx = 13, y = 13, rule = B3/S23\n" +
    "2b3o3b3o2b$$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2b$$2b3o3b3o2b" +
    "$o4bobo4bo$o4bobo4bo$o4bobo4bo$$2b3o3b3o2b!",
  "gosper-glider-gun":
    "#N Gosper glider gun\nx = 36, y = 9, rule = B3/S23\n" +
    "24bo11b$22bobo11b$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o14b" +
    "$2o8bo3bob2o4bobo11b$10bo5bo7bo11b$11bo3bo20b$12b2o!",
} as const satisfies Record<string, string>;

export type PatternName = keyof typeof PATTERN_RLE;

export const PATTERN_NAMES: readonly PatternName[] = Object.keys(
  PATTERN_RLE,
) as PatternName[];

/** Load one of the bundled canonical patterns by name. */
export function loadPattern(name: PatternName): ParsedRLE {
  return parseRLE(PATTERN_RLE[name]);
}
