import { DEFAULT_RULE, type RuleSet } from "../engine/rules.js";
import { classifyObject, type ObjectType } from "./classify.js";
import { separateComponents } from "./components.js";
import { nameFor } from "./names.js";
import { generateSoup } from "./soup.js";
import { stabilize } from "./stabilize.js";

export interface CensusOptions {
  readonly soups: number;
  readonly width: number;
  readonly height: number;
  readonly density: number;
  readonly rule: RuleSet;
  /** Generation cap for settling each soup (not for classifying its objects -- see classify.ts). */
  readonly maxGenerations: number;
  readonly seedStart: number;
}

export interface CensusEntry {
  readonly canonicalKey: string;
  readonly name: string;
  readonly type: ObjectType;
  readonly count: number;
  readonly period: number;
  readonly boundingBox: { readonly width: number; readonly height: number };
  readonly examplePattern: ReadonlyArray<readonly [number, number]>;
}

export interface CensusReport {
  readonly soups: number;
  readonly width: number;
  readonly height: number;
  readonly density: number;
  readonly rule: string;
  readonly extinctSoups: number;
  readonly unstabilizedSoups: number;
  /** Separated objects that didn't reclassify as a persistent still life/oscillator/spaceship in isolation -- see the `unclassifiedObjects` field on `Counters`. */
  readonly unclassifiedObjects: number;
  /** Sorted: still lifes, then oscillators, then spaceships; each group by count descending. */
  readonly entries: readonly CensusEntry[];
}

const DEFAULT_OPTIONS: CensusOptions = {
  soups: 200,
  width: 16,
  height: 16,
  density: 0.4,
  rule: DEFAULT_RULE,
  maxGenerations: 5000,
  seedStart: 0,
};

interface TallyEntry {
  name: string;
  type: ObjectType;
  count: number;
  period: number;
  boundingBox: { width: number; height: number };
  example: ReadonlyArray<readonly [number, number]>;
}

interface Counters {
  extinct: number;
  unstabilized: number;
  /** Separated objects that, re-run in isolation, don't behave as a persistent still life/oscillator/spaceship -- typically a component that only *looked* separable in `separateComponents`' snapshot but was actually still interacting with a neighbor. Tracked apart from the tally rather than mislabeled as a "pattern". */
  unclassifiedObjects: number;
}

/** Fill in defaults for any options a caller (e.g. a CLI, or a worker shard) didn't specify. */
export function resolveOptions(options: Partial<CensusOptions>): CensusOptions {
  return { ...DEFAULT_OPTIONS, ...options };
}

/** Settle one seeded soup and fold its resulting objects into `tally`/`counters`. Shared by the synchronous and streaming orchestrators so both produce identical results for identical options. */
function processSoup(
  seed: number,
  opts: CensusOptions,
  tally: Map<string, TallyEntry>,
  counters: Counters,
): void {
  const soup = generateSoup(seed, opts.width, opts.height, opts.density);
  const settled = stabilize(soup, opts.maxGenerations, opts.rule);

  if (settled.status === "extinct") {
    counters.extinct++;
    return;
  }
  if (settled.status === "unstabilized") {
    counters.unstabilized++;
    return;
  }

  for (const component of separateComponents(settled.finalGrid)) {
    const classified = classifyObject(component.cells, opts.rule);
    if (classified.type === "extinct" || classified.type === "unstabilized") {
      counters.unclassifiedObjects++;
      continue;
    }
    const key = classified.canonicalKey;
    const existing = tally.get(key);
    if (existing) {
      existing.count++;
    } else {
      tally.set(key, {
        name: nameFor(key),
        type: classified.type,
        count: 1,
        period: classified.period,
        boundingBox: classified.boundingBox,
        example: component.cells,
      });
    }
  }
}

function rulesetToString(rule: RuleSet): string {
  const births = [...rule.births].sort().join("");
  const survivals = [...rule.survivals].sort().join("");
  return `B${births}/S${survivals}`;
}

const TYPE_ORDER: Record<ObjectType, number> = {
  "still-life": 0,
  oscillator: 1,
  spaceship: 2,
  extinct: 3,
  unstabilized: 4,
};

function finalizeReport(
  opts: CensusOptions,
  tally: Map<string, TallyEntry>,
  counters: Counters,
): CensusReport {
  const entries: CensusEntry[] = [...tally.entries()]
    .map(([key, entry]) => ({
      canonicalKey: key,
      name: entry.name,
      type: entry.type,
      count: entry.count,
      period: entry.period,
      boundingBox: entry.boundingBox,
      examplePattern: entry.example,
    }))
    .sort(
      (a, b) =>
        TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
        b.count - a.count ||
        a.name.localeCompare(b.name),
    );

  return {
    soups: opts.soups,
    width: opts.width,
    height: opts.height,
    density: opts.density,
    rule: rulesetToString(opts.rule),
    extinctSoups: counters.extinct,
    unstabilizedSoups: counters.unstabilized,
    unclassifiedObjects: counters.unclassifiedObjects,
    entries,
  };
}

/**
 * Run `soups` seeded random grids to completion, classify every surviving
 * object, and aggregate counts by canonical (symmetry-invariant) key. Soups
 * are seeded `seedStart .. seedStart + soups - 1`, so a census is fully
 * reproducible from its options alone.
 */
export function runCensus(
  options: Partial<CensusOptions> = {},
  onProgress?: (done: number, total: number) => void,
): CensusReport {
  const opts = resolveOptions(options);
  const tally = new Map<string, TallyEntry>();
  const counters: Counters = { extinct: 0, unstabilized: 0, unclassifiedObjects: 0 };

  for (let i = 0; i < opts.soups; i++) {
    processSoup(opts.seedStart + i, opts, tally, counters);
    onProgress?.(i + 1, opts.soups);
  }

  return finalizeReport(opts, tally, counters);
}

/**
 * Same aggregation as `runCensus`, but as an async generator that yields
 * `{ done, total }` after each soup and hands control back to the event loop
 * in between -- so a caller streaming progress over the network (see
 * `server/census-stream.ts`) can actually flush each update instead of
 * blocking until the whole run finishes.
 */
export async function* runCensusStream(
  options: Partial<CensusOptions> = {},
): AsyncGenerator<{ done: number; total: number }, CensusReport, void> {
  const opts = resolveOptions(options);
  const tally = new Map<string, TallyEntry>();
  const counters: Counters = { extinct: 0, unstabilized: 0, unclassifiedObjects: 0 };

  for (let i = 0; i < opts.soups; i++) {
    processSoup(opts.seedStart + i, opts, tally, counters);
    yield { done: i + 1, total: opts.soups };
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  return finalizeReport(opts, tally, counters);
}

/** Ranked, human-readable census summary grouped by type -- the sample shape documented in the README. */
export function renderCensusSummary(report: CensusReport): string {
  const lines: string[] = [
    `Census over ${report.soups} soups (${report.width}x${report.height}, density ${report.density.toFixed(2)}, rule ${report.rule})`,
  ];

  const groups: ReadonlyArray<readonly [string, ObjectType]> = [
    ["Still lifes", "still-life"],
    ["Oscillators", "oscillator"],
    ["Spaceships", "spaceship"],
  ];
  for (const [label, type] of groups) {
    const items = report.entries.filter((entry) => entry.type === type);
    if (items.length === 0) continue;
    lines.push(`${label.padEnd(12)}: ${items.map((e) => `${e.name} x${e.count}`).join("  ")}`);
  }

  lines.push(`${"Extinct".padEnd(12)}: ${report.extinctSoups} soups`);
  if (report.unstabilizedSoups > 0) {
    lines.push(`${"Unstabilized".padEnd(12)}: ${report.unstabilizedSoups} soups`);
  }

  const unknown = report.entries.filter((entry) => entry.name.startsWith("unknown("));
  if (unknown.length > 0) {
    lines.push(`${"Unknown".padEnd(12)}: ${unknown.length} patterns (reported by canonical key)`);
  }
  if (report.unclassifiedObjects > 0) {
    lines.push(
      `${"Unclassified".padEnd(12)}: ${report.unclassifiedObjects} objects (imperfect separation -- see README)`,
    );
  }

  return lines.join("\n");
}

/**
 * Combine independently-run partial census reports (e.g. one per
 * worker_threads shard, each covering a disjoint seed range of the same
 * options) into a single report, as if they'd all been tallied together by
 * `runCensus`. Counts by canonical key are summed; `examplePattern` keeps
 * whichever shard's example was encountered first. `soups`/width/height/
 * density/rule are taken from the first report (shards of one run always
 * share these).
 */
export function mergeCensusReports(reports: readonly CensusReport[]): CensusReport {
  if (reports.length === 0) {
    throw new Error("mergeCensusReports requires at least one report");
  }
  const first = reports[0] as CensusReport;

  let soups = 0;
  let extinctSoups = 0;
  let unstabilizedSoups = 0;
  let unclassifiedObjects = 0;
  const tally = new Map<string, CensusEntry>();

  for (const report of reports) {
    soups += report.soups;
    extinctSoups += report.extinctSoups;
    unstabilizedSoups += report.unstabilizedSoups;
    unclassifiedObjects += report.unclassifiedObjects;
    for (const entry of report.entries) {
      const existing = tally.get(entry.canonicalKey);
      tally.set(
        entry.canonicalKey,
        existing ? { ...existing, count: existing.count + entry.count } : entry,
      );
    }
  }

  const entries = [...tally.values()].sort(
    (a, b) =>
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || b.count - a.count || a.name.localeCompare(b.name),
  );

  return {
    soups,
    width: first.width,
    height: first.height,
    density: first.density,
    rule: first.rule,
    extinctSoups,
    unstabilizedSoups,
    unclassifiedObjects,
    entries,
  };
}
