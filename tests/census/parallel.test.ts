import { describe, expect, it } from "vitest";
import { computeShards } from "../../src/census/parallel.js";

describe("computeShards", () => {
  it("splits evenly when soups divides workerCount cleanly", () => {
    expect(computeShards(40, 0, 4)).toEqual([
      { soups: 10, seedStart: 0 },
      { soups: 10, seedStart: 10 },
      { soups: 10, seedStart: 20 },
      { soups: 10, seedStart: 30 },
    ]);
  });

  it("distributes the remainder one-per-shard rather than dumping it on the last shard", () => {
    const shards = computeShards(10, 0, 3);
    expect(shards.map((s) => s.soups)).toEqual([4, 3, 3]);
  });

  it("covers every seed exactly once, contiguously, in order", () => {
    const shards = computeShards(37, 100, 5);
    let expectedNext = 100;
    let total = 0;
    for (const shard of shards) {
      expect(shard.seedStart).toBe(expectedNext);
      expectedNext += shard.soups;
      total += shard.soups;
    }
    expect(total).toBe(37);
  });

  it("never produces more shards than soups", () => {
    expect(computeShards(3, 0, 10)).toHaveLength(3);
  });

  it("never produces an empty shard", () => {
    for (const shard of computeShards(7, 0, 10)) {
      expect(shard.soups).toBeGreaterThan(0);
    }
  });

  it("clamps a workerCount below 1 to a single shard covering everything", () => {
    expect(computeShards(20, 5, 0)).toEqual([{ soups: 20, seedStart: 5 }]);
  });

  it("a single worker gets one shard covering the whole range", () => {
    expect(computeShards(50, 0, 1)).toEqual([{ soups: 50, seedStart: 0 }]);
  });
});
