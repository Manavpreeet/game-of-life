import { create, set, type Grid } from "../engine/grid.js";
import { parseRulestring, type RuleSet } from "../engine/rules.js";

export interface ParsedRLE {
  readonly grid: Grid;
  readonly rule?: RuleSet;
  readonly name?: string;
}

const HEADER_PATTERN = /x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)(?:\s*,\s*rule\s*=\s*(\S+))?/i;

/**
 * Parse the standard RLE pattern format: optional `#`-prefixed header/comment
 * lines, an `x = .., y = ..[, rule = ..]` dimensions line, then a run-length
 * body of `b` (dead), `o` (alive), `$` (end of row) tokens terminated by `!`.
 */
export function parseRLE(text: string): ParsedRLE {
  let width: number | undefined;
  let height: number | undefined;
  let rule: RuleSet | undefined;
  let name: string | undefined;
  const bodyLines: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0) continue;

    if (line.startsWith("#")) {
      if (line.startsWith("#N")) name = line.slice(2).trim();
      continue;
    }

    if (width === undefined && HEADER_PATTERN.test(line)) {
      const match = HEADER_PATTERN.exec(line);
      if (!match) continue;
      width = Number(match[1]);
      height = Number(match[2]);
      if (match[3]) rule = parseRulestring(match[3]);
      continue;
    }

    bodyLines.push(line);
  }

  if (width === undefined || height === undefined) {
    throw new Error("Invalid RLE: missing 'x = .., y = ..' header line");
  }

  const grid = create(width, height);
  let x = 0;
  let y = 0;
  let countStr = "";

  outer: for (const ch of bodyLines.join("")) {
    if (ch >= "0" && ch <= "9") {
      countStr += ch;
      continue;
    }
    const count = countStr === "" ? 1 : Number(countStr);
    countStr = "";

    switch (ch) {
      case "b":
        x += count;
        break;
      case "o":
        for (let i = 0; i < count; i++) set(grid, x++, y, 1);
        break;
      case "$":
        y += count;
        x = 0;
        break;
      case "!":
        break outer;
      default:
        throw new Error(`Unexpected RLE token "${ch}"`);
    }
  }

  let result: ParsedRLE = { grid };
  if (rule !== undefined) result = { ...result, rule };
  if (name !== undefined) result = { ...result, name };
  return result;
}
