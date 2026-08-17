import { describe, expect, it } from "vitest";
import { runCensus } from "../../src/census/census.js";
import { runCensusParallel } from "../../src/census/parallel.js";

describe("runCensusParallel", () => {
  it("produces a report identical to a single-threaded run over the same options", async () => {
    const options = { soups: 30, width: 12, height: 12, density: 0.4, seedStart: 0 };
    const sequential = runCensus(options);
    const parallel = await runCensusParallel(options, 4);

    expect(parallel.soups).toBe(sequential.soups);
    expect(parallel.extinctSoups).toBe(sequential.extinctSoups);
    expect(parallel.unstabilizedSoups).toBe(sequential.unstabilizedSoups);
    expect(parallel.entries.map((e) => [e.canonicalKey, e.count])).toEqual(
      sequential.entries.map((e) => [e.canonicalKey, e.count]),
    );
  }, 20000);

  it("still works with more workers than soups (falls back to one shard per soup)", async () => {
    const options = { soups: 3, width: 10, height: 10, density: 0.4, seedStart: 0 };
    const sequential = runCensus(options);
    const parallel = await runCensusParallel(options, 16);
    expect(parallel.soups).toBe(sequential.soups);
    expect(parallel.extinctSoups + parallel.unstabilizedSoups).toBeLessThanOrEqual(3);
  }, 20000);

  it("a single worker matches the sequential result exactly (workerCount=1)", async () => {
    const options = { soups: 12, width: 10, height: 10, density: 0.4, seedStart: 7 };
    const sequential = runCensus(options);
    const parallel = await runCensusParallel(options, 1);
    expect(parallel).toEqual(sequential);
  }, 20000);
});
