import { create, set, type Grid } from "../engine/grid.js";

export type Rng = () => number;

/**
 * mulberry32: a small, fast, seeded PRNG returning floats in [0, 1). Same
 * seed -> same output sequence forever, which is the property a reproducible
 * census depends on (Math.random() would make every run unverifiable).
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fill a `width x height` grid with live cells at `density` probability,
 * driven by a seeded PRNG. The same (seed, width, height, density) always
 * produces the same soup, which is what makes a census re-verifiable.
 */
export function generateSoup(seed: number, width: number, height: number, density: number): Grid {
  const rng = mulberry32(seed);
  const grid = create(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rng() < density) set(grid, x, y, 1);
    }
  }
  return grid;
}
