import { describe, expect, it } from "vitest";
import { mergeCensusReports, runCensus } from "../../src/census/census.js";

describe("mergeCensusReports", () => {
  it("merging one shard's worth of soups equals running them all at once", () => {
    const options = { soups: 40, width: 12, height: 12, density: 0.4, seedStart: 0 };
    const whole = runCensus(options);

    const shardA = runCensus({ ...options, soups: 20, seedStart: 0 });
    const shardB = runCensus({ ...options, soups: 20, seedStart: 20 });
    const merged = mergeCensusReports([shardA, shardB]);

    expect(merged.soups).toBe(whole.soups);
    expect(merged.extinctSoups).toBe(whole.extinctSoups);
    expect(merged.unstabilizedSoups).toBe(whole.unstabilizedSoups);
    expect(merged.unclassifiedObjects).toBe(whole.unclassifiedObjects);
    expect(merged.entries.map((e) => [e.canonicalKey, e.count])).toEqual(
      whole.entries.map((e) => [e.canonicalKey, e.count]),
    );
  });

  it("sums counts for the same canonical key across shards", () => {
    const a = runCensus({ soups: 10, width: 10, height: 10, density: 0.3, seedStart: 0 });
    const b = runCensus({ soups: 10, width: 10, height: 10, density: 0.3, seedStart: 10 });
    const merged = mergeCensusReports([a, b]);

    for (const entry of merged.entries) {
      const fromA = a.entries.find((e) => e.canonicalKey === entry.canonicalKey)?.count ?? 0;
      const fromB = b.entries.find((e) => e.canonicalKey === entry.canonicalKey)?.count ?? 0;
      expect(entry.count).toBe(fromA + fromB);
    }
  });

  it("throws on an empty list rather than silently returning nothing", () => {
    expect(() => mergeCensusReports([])).toThrow();
  });

  it("a single-report merge is a no-op", () => {
    const report = runCensus({ soups: 15, width: 10, height: 10, density: 0.4, seedStart: 5 });
    expect(mergeCensusReports([report])).toEqual(report);
  });
});
