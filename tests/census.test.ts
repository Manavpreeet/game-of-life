import { describe, expect, it } from "vitest";
import { runCensus } from "../src/census/census.js";

describe("runCensus: reproducibility", () => {
  it("produces an identical report for identical options", () => {
    const options = { soups: 25, width: 10, height: 10, density: 0.35, seedStart: 0 };
    const a = runCensus(options);
    const b = runCensus(options);
    expect(a).toEqual(b);
  });

  it("a soup search on an all-dead field is deterministically all extinctions", () => {
    const report = runCensus({ soups: 5, width: 4, height: 4, density: 0 });
    expect(report.extinctSoups).toBe(5);
    expect(report.unstabilizedSoups).toBe(0);
    expect(report.entries).toHaveLength(0);
  });

  it("different seed ranges over the same options generally diverge", () => {
    const optionsA = { soups: 20, width: 10, height: 10, density: 0.35, seedStart: 0 };
    const optionsB = { soups: 20, width: 10, height: 10, density: 0.35, seedStart: 1000 };
    expect(runCensus(optionsA)).not.toEqual(runCensus(optionsB));
  });
});

describe("runCensus: aggregation", () => {
  it("sorts entries by type group, then by count descending", () => {
    const report = runCensus({ soups: 60, width: 16, height: 16, density: 0.4, seedStart: 0 });
    const typeRank: Record<string, number> = {
      "still-life": 0,
      oscillator: 1,
      spaceship: 2,
    };
    for (let i = 1; i < report.entries.length; i++) {
      const prev = report.entries[i - 1];
      const curr = report.entries[i];
      if (!prev || !curr) continue;
      const prevRank = typeRank[prev.type] ?? 3;
      const currRank = typeRank[curr.type] ?? 3;
      expect(prevRank).toBeLessThanOrEqual(currRank);
      if (prevRank === currRank) expect(prev.count).toBeGreaterThanOrEqual(curr.count);
    }
  });

  it("every soup outcome is accounted for as extinction, unstabilization, or classified objects", () => {
    const report = runCensus({ soups: 40, width: 16, height: 16, density: 0.4, seedStart: 0 });
    const settledSoups = report.soups - report.extinctSoups - report.unstabilizedSoups;
    const totalObjects = report.entries.reduce((sum, entry) => sum + entry.count, 0);
    // Settled soups can yield zero, one, or several objects each, so we can
    // only assert consistency in the extremes: no settled soups means no
    // objects, and objects only exist when at least one soup settled.
    if (settledSoups === 0) expect(totalObjects).toBe(0);
    if (totalObjects > 0) expect(settledSoups).toBeGreaterThan(0);
  });
});
