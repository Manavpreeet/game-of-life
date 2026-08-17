/** One worker's slice of a census run: a contiguous seed range of its own. */
export interface CensusShard {
  readonly soups: number;
  readonly seedStart: number;
}

/**
 * Split `soups` seeded runs (starting at `seedStart`) into up to
 * `workerCount` contiguous, non-overlapping shards -- each worker gets its
 * own seed range, so sharding never changes *which* soups get run, only
 * which thread runs them (merging the shards' reports back together
 * reproduces exactly what a single-threaded run over the same range would
 * have produced). Never returns more shards than there are soups to run,
 * and never an empty shard.
 */
export function computeShards(
  soups: number,
  seedStart: number,
  workerCount: number,
): CensusShard[] {
  const count = Math.max(1, Math.min(workerCount, soups));
  const base = Math.floor(soups / count);
  const remainder = soups % count;

  const shards: CensusShard[] = [];
  let cursor = seedStart;
  for (let i = 0; i < count; i++) {
    // Distribute the remainder one-per-shard across the first `remainder`
    // shards, so sizes differ by at most 1 rather than dumping it all on
    // the last shard.
    const size = base + (i < remainder ? 1 : 0);
    if (size === 0) continue;
    shards.push({ soups: size, seedStart: cursor });
    cursor += size;
  }
  return shards;
}
