import { get, type Grid } from "../engine/grid.js";

export interface Component {
  /** Live cells normalized so the minimum x/y is 0. */
  readonly cells: ReadonlyArray<readonly [number, number]>;
  /** Bounding box in the original grid's coordinates. */
  readonly boundingBox: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly population: number;
}

const MOORE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

const DEFAULT_GAP = 2;

function rawGroups(grid: Grid): Array<Array<[number, number]>> {
  const visited = new Set<string>();
  const groups: Array<Array<[number, number]>> = [];

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (get(grid, x, y) !== 1) continue;
      const startKey = `${x},${y}`;
      if (visited.has(startKey)) continue;

      const group: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[x, y]];
      visited.add(startKey);

      while (stack.length > 0) {
        const [cx, cy] = stack.pop() as [number, number];
        group.push([cx, cy]);
        for (const [dx, dy] of MOORE_OFFSETS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= grid.width || ny < 0 || ny >= grid.height) continue;
          const nKey = `${nx},${ny}`;
          if (visited.has(nKey) || get(grid, nx, ny) !== 1) continue;
          visited.add(nKey);
          stack.push([nx, ny]);
        }
      }
      groups.push(group);
    }
  }
  return groups;
}

interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function boundsOf(cells: ReadonlyArray<readonly [number, number]>): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of cells) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** True when two bounding boxes are touching or within `gap` cells of each other. */
function boxesWithinGap(a: Bounds, b: Bounds, gap: number): boolean {
  const dx = Math.max(a.minX - b.maxX, b.minX - a.maxX, 0);
  const dy = Math.max(a.minY - b.maxY, b.minY - a.maxY, 0);
  return dx <= gap && dy <= gap;
}

/** Union-find, used to merge raw components whose boxes lie within `gap`. */
class UnionFind {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(i: number): number {
    let root = i;
    while (this.parent[root] !== root) root = this.parent[root] as number;
    while (this.parent[i] !== root) {
      const next = this.parent[i] as number;
      this.parent[i] = root;
      i = next;
    }
    return root;
  }

  union(i: number, j: number): void {
    const ri = this.find(i);
    const rj = this.find(j);
    if (ri !== rj) this.parent[ri] = rj;
  }
}

/**
 * Split a settled grid into isolated objects via Moore-adjacency connected-
 * component labeling, then merge components whose bounding boxes lie within
 * `gap` cells of each other. The merge step is a scoped simplification for
 * oscillators (e.g. a pulsar's quadrants) whose live cells momentarily
 * separate mid-period even though they are one physical object; a full
 * solution would track the union of live cells across an entire period
 * before labeling, which this feature intentionally does not attempt.
 */
export function separateComponents(grid: Grid, gap: number = DEFAULT_GAP): Component[] {
  const groups = rawGroups(grid);
  const boxes = groups.map(boundsOf);

  const unionFind = new UnionFind(groups.length);
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      if (boxesWithinGap(boxes[i] as Bounds, boxes[j] as Bounds, gap)) unionFind.union(i, j);
    }
  }

  const merged = new Map<number, Array<[number, number]>>();
  for (let i = 0; i < groups.length; i++) {
    const root = unionFind.find(i);
    const bucket = merged.get(root) ?? [];
    bucket.push(...(groups[i] as Array<[number, number]>));
    merged.set(root, bucket);
  }

  return [...merged.values()].map((cells) => {
    const { minX, minY, maxX, maxY } = boundsOf(cells);
    const normalized = cells
      .map(([x, y]): [number, number] => [x - minX, y - minY])
      .sort(([ax, ay], [bx, by]) => ax - bx || ay - by);
    return {
      cells: normalized,
      boundingBox: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
      population: normalized.length,
    };
  });
}
