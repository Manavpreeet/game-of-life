import { create, get as gridGet, set as gridSet, toString as gridToString, type Grid } from "./engine/grid.js";
import { step as denseStep } from "./engine/life.js";
import { DEFAULT_RULE, parseRulestring, type RuleSet } from "./engine/rules.js";
import { fromCells, step as sparseStep, toCells, type SparseGrid } from "./engine/sparse.js";
import { loadPattern, PATTERN_NAMES, type PatternName } from "./io/patterns.js";

interface CliOptions {
  readonly pattern: PatternName;
  readonly rule: RuleSet;
  readonly generations: number; // 0 = run until interrupted
  readonly width: number;
  readonly height: number;
  readonly engine: "dense" | "sparse";
  readonly delayMs: number;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const raw: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        raw[key] = next;
        i++;
      } else {
        raw[key] = "true";
      }
    }
  }

  const patternArg = raw.pattern ?? "glider";
  if (!(PATTERN_NAMES as readonly string[]).includes(patternArg)) {
    throw new Error(`Unknown --pattern "${patternArg}". Available: ${PATTERN_NAMES.join(", ")}`);
  }

  return {
    pattern: patternArg as PatternName,
    rule: raw.rule ? parseRulestring(raw.rule) : DEFAULT_RULE,
    generations: raw.gens ? Number(raw.gens) : 300,
    width: raw.width ? Number(raw.width) : 50,
    height: raw.height ? Number(raw.height) : 26,
    engine: raw.engine === "sparse" ? "sparse" : "dense",
    delayMs: raw.delay ? Number(raw.delay) : 120,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

function renderDense(grid: Grid): string {
  return gridToString(grid, "█", "·");
}

function renderSparseViewport(
  cells: ReadonlyArray<readonly [number, number]>,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
): string {
  const live = new Set(cells.map(([x, y]) => `${x},${y}`));
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = "";
    for (let x = 0; x < width; x++) {
      row += live.has(`${x + offsetX},${y + offsetY}`) ? "█" : "·";
    }
    rows.push(row);
  }
  return rows.join("\n");
}

function embedInDenseGrid(pattern: Grid, width: number, height: number): Grid {
  const w = Math.max(width, pattern.width);
  const h = Math.max(height, pattern.height);
  const grid = create(w, h);
  const marginX = Math.floor((w - pattern.width) / 2);
  const marginY = Math.floor((h - pattern.height) / 2);
  for (let y = 0; y < pattern.height; y++) {
    for (let x = 0; x < pattern.width; x++) {
      if (gridGet(pattern, x, y) === 1) gridSet(grid, x + marginX, y + marginY, 1);
    }
  }
  return grid;
}

function patternToCells(pattern: Grid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < pattern.height; y++) {
    for (let x = 0; x < pattern.width; x++) {
      if (gridGet(pattern, x, y) === 1) cells.push([x, y]);
    }
  }
  return cells;
}

async function runDense(opts: CliOptions, pattern: Grid, name: string): Promise<void> {
  let grid = embedInDenseGrid(pattern, opts.width, opts.height);
  const infinite = opts.generations === 0;
  for (let gen = 0; infinite || gen <= opts.generations; gen++) {
    clearScreen();
    const genLabel = infinite ? `${gen}` : `${gen}/${opts.generations}`;
    console.log(`${name}  engine=dense  generation ${genLabel}  (ctrl+c to quit)\n`);
    console.log(renderDense(grid));
    grid = denseStep(grid, opts.rule);
    await sleep(opts.delayMs);
  }
}

async function runSparse(opts: CliOptions, pattern: Grid, name: string): Promise<void> {
  let sparse: SparseGrid = fromCells(patternToCells(pattern));
  const offsetX = -Math.floor(opts.width / 2);
  const offsetY = -Math.floor(opts.height / 2);
  const infinite = opts.generations === 0;
  for (let gen = 0; infinite || gen <= opts.generations; gen++) {
    clearScreen();
    const genLabel = infinite ? `${gen}` : `${gen}/${opts.generations}`;
    console.log(`${name}  engine=sparse  generation ${genLabel}  (ctrl+c to quit)\n`);
    console.log(renderSparseViewport(toCells(sparse), offsetX, offsetY, opts.width, opts.height));
    sparse = sparseStep(sparse, opts.rule);
    await sleep(opts.delayMs);
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const { grid: pattern, name } = loadPattern(opts.pattern);
  const label = name ?? opts.pattern;

  if (opts.engine === "dense") {
    await runDense(opts, pattern, label);
  } else {
    await runSparse(opts, pattern, label);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
