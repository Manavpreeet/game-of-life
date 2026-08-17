import { create, get, set, type Grid } from "../src/engine/grid.js";
import { run as denseRun } from "../src/engine/life.js";
import { fromCells, run as sparseRun, type SparseGrid } from "../src/engine/sparse.js";

const GLIDER: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [2, 1],
  [0, 2],
  [1, 2],
  [2, 2],
];

function timeMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function gensPerSec(generations: number, ms: number): number {
  return generations / (ms / 1000);
}

function randomSoup(width: number, height: number, density: number): Grid {
  const grid = create(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.random() < density) set(grid, x, y, 1);
    }
  }
  return grid;
}

function denseLiveCells(grid: Grid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (get(grid, x, y) === 1) cells.push([x, y]);
    }
  }
  return cells;
}

function report(label: string, generations: number, dense: Grid, sparse: SparseGrid): void {
  const denseMs = timeMs(() => denseRun(dense, generations));
  const sparseMs = timeMs(() => sparseRun(sparse, generations));
  const denseRate = gensPerSec(generations, denseMs);
  const sparseRate = gensPerSec(generations, sparseMs);

  console.log(`${label} (${generations} generations)`);
  console.log(`  dense:  ${denseRate.toFixed(1)} gens/sec (${denseMs.toFixed(1)}ms)`);
  console.log(`  sparse: ${sparseRate.toFixed(1)} gens/sec (${sparseMs.toFixed(1)}ms)`);
  const faster = denseRate > sparseRate ? "dense" : "sparse";
  const ratio = Math.max(denseRate, sparseRate) / Math.min(denseRate, sparseRate);
  console.log(`  -> ${faster} is ${ratio.toFixed(1)}x faster here\n`);
}

console.log("Game of Life benchmark: dense (Uint8Array) vs sparse (live-cell Set)\n");

// Sparse-favorable case: one glider drifting across a huge, mostly-empty field.
// Dense pays for every cell in the field on every step; sparse only pays for
// the handful of live cells and their neighbors.
{
  const size = 1000;
  const offset = 10;
  const dense = create(size, size);
  const initialCells: Array<[number, number]> = [];
  for (const [dx, dy] of GLIDER) {
    set(dense, offset + dx, offset + dy, 1);
    initialCells.push([offset + dx, offset + dy]);
  }
  const sparse = fromCells(initialCells);
  report(`Sparse-favorable: glider on ${size}x${size} field`, 400, dense, sparse);
}

// Dense-favorable case: a ~50% random soup. Nearly every cell is live or
// adjacent to a live cell, so sparse's per-cell Map bookkeeping loses its
// advantage and dense's flat array scan wins.
{
  const size = 150;
  const dense = randomSoup(size, size, 0.5);
  const sparse = fromCells(denseLiveCells(dense));
  report(`Dense-favorable: 50% random soup on ${size}x${size}`, 100, dense, sparse);
}
