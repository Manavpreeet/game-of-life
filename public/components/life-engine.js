/**
 * Shared client-side simulation primitives for the public/ frontend: a
 * live-cell-set step function, Bxx/Sxx rulestring parsing, and a seeded soup
 * generator. These mirror src/engine/sparse.ts, src/engine/rules.ts, and
 * src/census/soup.ts -- this is a plain browser script with no build step,
 * so it can't import the TypeScript engine directly, and duplicating this
 * small kernel is the pragmatic tradeoff over adding a bundler. Loaded as a
 * global (no <script type="module">), so every function here hangs off
 * `window` for other public/ scripts to use directly.
 */
(function (global) {
  const NEIGHBOR_OFFSETS = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];

  function parseRulestring(raw) {
    const match = /^B([0-8]*)\/S([0-8]*)$/i.exec((raw ?? "").trim());
    if (!match) return { births: new Set([3]), survivals: new Set([2, 3]) };
    return {
      births: new Set([...match[1]].map(Number)),
      survivals: new Set([...match[2]].map(Number)),
    };
  }

  /** Advance a live-cell Set (keyed "x,y") one generation under `rule`. */
  function stepLiveCells(live, rule) {
    const neighborCounts = new Map();
    for (const key of live) {
      const [x, y] = key.split(",").map(Number);
      for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const neighborKey = `${x + dx},${y + dy}`;
        neighborCounts.set(neighborKey, (neighborCounts.get(neighborKey) ?? 0) + 1);
      }
      if (!neighborCounts.has(key)) neighborCounts.set(key, 0);
    }
    const next = new Set();
    for (const [key, count] of neighborCounts) {
      const set = live.has(key) ? rule.survivals : rule.births;
      if (set.has(count)) next.add(key);
    }
    return next;
  }

  /** mulberry32: same seeded PRNG as src/census/soup.ts, so a given seed reproduces the exact same soup here as it would server-side. */
  function mulberry32(seed) {
    let state = seed >>> 0;
    return function next() {
      state = (state + 0x6d2b79f5) | 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Fill a width x height field with live cells at `density` probability, seeded -- returns a flat [x, y] cell list, not a live-cell Set. */
  function generateSoupCells(seed, width, height, density) {
    const rng = mulberry32(seed);
    const cells = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (rng() < density) cells.push([x, y]);
      }
    }
    return cells;
  }

  global.LifeEngine = { parseRulestring, stepLiveCells, generateSoupCells };
})(window);
