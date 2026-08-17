type Point = readonly [number, number];
type Transform = (x: number, y: number) => Point;

/** The 8 dihedral transforms: 4 rotations x 2 reflections (identity included). */
const TRANSFORMS: readonly Transform[] = [
  (x, y) => [x, y],
  (x, y) => [-y, x],
  (x, y) => [-x, -y],
  (x, y) => [y, -x],
  (x, y) => [-x, y],
  (x, y) => [x, -y],
  (x, y) => [y, x],
  (x, y) => [-y, -x],
];

function normalizeAndSerialize(cells: ReadonlyArray<Point>): string {
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of cells) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
  }
  return cells
    .map(([x, y]): Point => [x - minX, y - minY])
    .sort(([ax, ay], [bx, by]) => ax - bx || ay - by)
    .map(([x, y]) => `${x},${y}`)
    .join(";");
}

/**
 * A symmetry-invariant key for a shape: apply all 8 dihedral transforms,
 * normalize each to its own origin, and take the lexicographically smallest
 * serialization. Two objects share a canonical key exactly when one is a
 * rotation or reflection of the other -- a deliberately simplified stand-in
 * for a real apgcode (see Catagolue), sufficient for aggregating a census.
 */
export function canonicalKey(cells: ReadonlyArray<Point>): string {
  let best: string | undefined;
  for (const transform of TRANSFORMS) {
    const candidate = normalizeAndSerialize(cells.map(([x, y]) => transform(x, y)));
    if (best === undefined || candidate < best) best = candidate;
  }
  return best as string;
}
