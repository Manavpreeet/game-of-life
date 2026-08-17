/** Dense grid: a flat Uint8Array of 0/1 cells, row-major, fixed width/height. */
export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;
}

export function create(width: number, height: number): Grid {
  if (width <= 0 || height <= 0) {
    throw new RangeError(`Grid dimensions must be positive, got ${width}x${height}`);
  }
  return { width, height, cells: new Uint8Array(width * height) };
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && x < grid.width && y >= 0 && y < grid.height;
}

export function get(grid: Grid, x: number, y: number): number {
  if (!inBounds(grid, x, y)) return 0;
  return grid.cells[y * grid.width + x] ?? 0;
}

export function set(grid: Grid, x: number, y: number, value: 0 | 1): void {
  if (!inBounds(grid, x, y)) {
    throw new RangeError(`(${x}, ${y}) is outside ${grid.width}x${grid.height} grid`);
  }
  grid.cells[y * grid.width + x] = value;
}

export function clone(grid: Grid): Grid {
  return { width: grid.width, height: grid.height, cells: grid.cells.slice() };
}

/**
 * Build a grid from a multi-line string: '.' or ' ' = dead, anything else = alive.
 * Lines are padded/truncated to the widest line's length.
 */
export function fromString(pattern: string): Grid {
  const lines = pattern.replace(/^\n+|\n+$/g, "").split("\n");
  const width = Math.max(...lines.map((line) => line.length));
  const height = lines.length;
  const grid = create(width, height);
  for (let y = 0; y < height; y++) {
    const line = lines[y] ?? "";
    for (let x = 0; x < width; x++) {
      const ch = line[x];
      set(grid, x, y, ch !== undefined && ch !== "." && ch !== " " ? 1 : 0);
    }
  }
  return grid;
}

export function toString(grid: Grid, alive = "O", dead = "."): string {
  const rows: string[] = [];
  for (let y = 0; y < grid.height; y++) {
    let row = "";
    for (let x = 0; x < grid.width; x++) {
      row += get(grid, x, y) ? alive : dead;
    }
    rows.push(row);
  }
  return rows.join("\n");
}
