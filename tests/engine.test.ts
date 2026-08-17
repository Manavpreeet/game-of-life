import { describe, expect, it } from "vitest";
import { fromString, toString } from "../src/engine/grid.js";
import { step } from "../src/engine/life.js";

describe("block still life", () => {
  it("remains unchanged across generations", () => {
    const block = fromString(["....", ".OO.", ".OO.", "...."].join("\n"));
    const after = step(block);
    expect(toString(after)).toBe(toString(block));
  });
});

describe("blinker oscillator", () => {
  it("flips between horizontal and vertical every generation", () => {
    const horizontal = fromString([".....", ".....", ".OOO.", ".....", "....."].join("\n"));
    const vertical = fromString([".....", "..O..", "..O..", "..O..", "....."].join("\n"));

    const gen1 = step(horizontal);
    expect(toString(gen1)).toBe(toString(vertical));

    const gen2 = step(gen1);
    expect(toString(gen2)).toBe(toString(horizontal));
  });
});
