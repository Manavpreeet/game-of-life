import type { ServerResponse } from "node:http";
import { create, get as gridGet, set as gridSet, type Grid } from "../engine/grid.js";
import { step as denseStep } from "../engine/life.js";
import type { RuleSet } from "../engine/rules.js";
import { fromCells, step as sparseStep, toCells, type SparseGrid } from "../engine/sparse.js";
import { loadPattern, type PatternName } from "../io/patterns.js";

export interface StreamOptions {
  readonly pattern: PatternName;
  readonly rule: RuleSet;
  readonly engine: "dense" | "sparse";
  readonly speed: number; // generations per second
  readonly width: number;
  readonly height: number;
}

export interface GenerationFrame {
  readonly generation: number;
  readonly width: number;
  readonly height: number;
  readonly cells: ReadonlyArray<readonly [number, number]>;
}

function embed(pattern: Grid, width: number, height: number): Grid {
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

function denseToCells(grid: Grid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (gridGet(grid, x, y) === 1) cells.push([x, y]);
    }
  }
  return cells;
}

/**
 * Write a Server-Sent Events stream of generations to `res` on a fixed-interval
 * timer, one JSON frame per tick. Stops (and frees the interval) automatically
 * when the client disconnects, via the response's 'close' event.
 */
export function streamGenerations(res: ServerResponse, options: StreamOptions): () => void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const { grid: pattern } = loadPattern(options.pattern);
  const offsetX = -Math.floor(options.width / 2);
  const offsetY = -Math.floor(options.height / 2);

  let dense: Grid | undefined;
  let sparse: SparseGrid | undefined;
  if (options.engine === "dense") {
    dense = embed(pattern, options.width, options.height);
  } else {
    const cells: Array<[number, number]> = [];
    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        if (gridGet(pattern, x, y) === 1) cells.push([x, y]);
      }
    }
    sparse = fromCells(cells);
  }

  let generation = 0;

  function currentCells(): Array<[number, number]> {
    if (dense) return denseToCells(dense);
    return toCells(sparse as SparseGrid).map(([x, y]): [number, number] => [
      x - offsetX,
      y - offsetY,
    ]);
  }

  function sendFrame(): void {
    const frame: GenerationFrame = {
      generation,
      width: options.width,
      height: options.height,
      cells: currentCells(),
    };
    res.write(`event: generation\ndata: ${JSON.stringify(frame)}\n\n`);
    generation++;
    if (dense) dense = denseStep(dense, options.rule);
    else sparse = sparseStep(sparse as SparseGrid, options.rule);
  }

  sendFrame();
  const intervalMs = Math.max(16, Math.round(1000 / options.speed));
  const timer = setInterval(sendFrame, intervalMs);

  const stop = (): void => clearInterval(timer);
  res.on("close", stop);
  return stop;
}
