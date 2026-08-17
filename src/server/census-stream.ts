import type { ServerResponse } from "node:http";
import { runCensusStream, type CensusOptions } from "../census/census.js";
import { DEFAULT_RULE, parseRulestring, type RuleSet } from "../engine/rules.js";

export type CensusStreamOptions = Partial<CensusOptions>;

const MAX_SOUPS = 5000;

export function parseCensusStreamOptions(url: URL): CensusStreamOptions {
  const size = Number(url.searchParams.get("size") ?? "16");
  const ruleParam = url.searchParams.get("rule");
  const soups = Math.min(Number(url.searchParams.get("soups") ?? "200"), MAX_SOUPS);
  const rule: RuleSet = ruleParam ? parseRulestring(ruleParam) : DEFAULT_RULE;

  return {
    soups,
    width: size,
    height: size,
    density: Number(url.searchParams.get("density") ?? "0.4"),
    rule,
    maxGenerations: Number(url.searchParams.get("maxGens") ?? "5000"),
    seedStart: Number(url.searchParams.get("seedStart") ?? "0"),
  };
}

/**
 * Run a census and stream progress to the client over SSE. `runCensusStream`
 * yields control back to the event loop between soups (see census.ts), so
 * `progress` events actually reach the client incrementally instead of all
 * arriving at once when the run finishes.
 */
export async function streamCensus(
  res: ServerResponse,
  options: CensusStreamOptions,
): Promise<void> {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const generator = runCensusStream(options);
  let aborted = false;
  res.on("close", () => {
    aborted = true;
  });

  let next = await generator.next();
  while (!next.done) {
    if (aborted) return;
    res.write(`event: progress\ndata: ${JSON.stringify(next.value)}\n\n`);
    next = await generator.next();
  }

  if (!aborted) {
    res.write(`event: done\ndata: ${JSON.stringify(next.value)}\n\n`);
    res.end();
  }
}
