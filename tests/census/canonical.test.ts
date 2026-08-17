import { describe, expect, it } from "vitest";
import { canonicalKey } from "../../src/census/canonical.js";

const GLIDER: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [2, 1],
  [0, 2],
  [1, 2],
  [2, 2],
];

const BLOCK: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

const BLINKER: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [2, 0],
];

function rotate90(cells: ReadonlyArray<readonly [number, number]>): Array<[number, number]> {
  return cells.map(([x, y]): [number, number] => [-y, x]);
}

function mirrorX(cells: ReadonlyArray<readonly [number, number]>): Array<[number, number]> {
  return cells.map(([x, y]): [number, number] => [-x, y]);
}

describe("canonicalKey", () => {
  it("is invariant under all 4 rotations of a glider", () => {
    const key = canonicalKey(GLIDER);
    let rotated = GLIDER as ReadonlyArray<readonly [number, number]>;
    for (let i = 0; i < 4; i++) {
      rotated = rotate90(rotated);
      expect(canonicalKey(rotated)).toBe(key);
    }
  });

  it("is invariant under mirroring a glider (and its rotations)", () => {
    const key = canonicalKey(GLIDER);
    let mirrored = mirrorX(GLIDER) as ReadonlyArray<readonly [number, number]>;
    for (let i = 0; i < 4; i++) {
      expect(canonicalKey(mirrored)).toBe(key);
      mirrored = rotate90(mirrored);
    }
  });

  it("is invariant under translation", () => {
    const translated = GLIDER.map(([x, y]): [number, number] => [x + 5, y + 9]);
    expect(canonicalKey(translated)).toBe(canonicalKey(GLIDER));
  });

  it("assigns distinct keys to distinct patterns", () => {
    const keys = new Set([canonicalKey(BLOCK), canonicalKey(BLINKER), canonicalKey(GLIDER)]);
    expect(keys.size).toBe(3);
  });
});
