import os from "node:os";
import { runCensus, type CensusOptions } from "../src/census/census.js";
import { runCensusParallel } from "../src/census/parallel.js";

function soupsPerSec(soups: number, ms: number): number {
  return soups / (ms / 1000);
}

async function timeMsAsync(fn: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

const soups = 400;
const options: Partial<CensusOptions> = {
  soups,
  width: 16,
  height: 16,
  density: 0.4,
  seedStart: 0,
};
const cpuCount = os.cpus().length;

console.log(`Census benchmark: single-threaded vs parallel (worker_threads)`);
console.log(`${soups} soups, 16x16, density 0.4, B3/S23, ${cpuCount} CPUs detected\n`);

const sequentialMs = await timeMsAsync(async () => runCensus(options));
const sequentialRate = soupsPerSec(soups, sequentialMs);
console.log(
  `single-threaded:      ${sequentialRate.toFixed(1)} soups/sec (${sequentialMs.toFixed(1)}ms)`,
);

for (const workerCount of [2, Math.max(2, cpuCount)]) {
  const ms = await timeMsAsync(() => runCensusParallel(options, workerCount));
  const rate = soupsPerSec(soups, ms);
  const speedup = rate / sequentialRate;
  console.log(
    `parallel (${String(workerCount).padStart(2)} workers): ${rate.toFixed(1)} soups/sec (${ms.toFixed(1)}ms) -> ${speedup.toFixed(1)}x`,
  );
}
