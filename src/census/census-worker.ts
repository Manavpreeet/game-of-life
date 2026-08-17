import { parentPort, workerData } from "node:worker_threads";
import { runCensus, type CensusOptions } from "./census.js";

/**
 * worker_threads entry point: run one shard of a census (the options this
 * worker was given via `workerData` -- a disjoint seed range of a larger
 * run, see parallel.ts) and post the resulting partial `CensusReport` back
 * to the main thread. `RuleSet`'s `Set<number>` fields survive the
 * structured-clone algorithm postMessage uses, so no serialization step is
 * needed here.
 */
if (!parentPort) {
  throw new Error("census-worker.ts must be run inside a worker_threads Worker");
}

const options = workerData as Partial<CensusOptions>;
const report = runCensus(options);
parentPort.postMessage(report);
