import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_RULE, parseRulestring } from "../engine/rules.js";
import { PATTERN_NAMES, type PatternName } from "../io/patterns.js";
import { streamGenerations, type StreamOptions } from "./stream.js";

const moduleDir = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = resolve(moduleDir, "..", "..", "public");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function parseStreamOptions(url: URL): StreamOptions {
  const patternParam = url.searchParams.get("pattern") ?? "glider";
  if (!(PATTERN_NAMES as readonly string[]).includes(patternParam)) {
    throw new Error(`Unknown pattern "${patternParam}". Available: ${PATTERN_NAMES.join(", ")}`);
  }
  const ruleParam = url.searchParams.get("rule");
  const engineParam = url.searchParams.get("engine");
  const speedParam = url.searchParams.get("speed");

  return {
    pattern: patternParam as PatternName,
    rule: ruleParam ? parseRulestring(ruleParam) : DEFAULT_RULE,
    engine: engineParam === "sparse" ? "sparse" : "dense",
    speed: speedParam ? Number(speedParam) : 8,
    width: 60,
    height: 36,
  };
}

async function serveStatic(pathname: string, res: ServerResponse): Promise<boolean> {
  const relative = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(join(PUBLIC_DIR, relative));
  if (!filePath.startsWith(PUBLIC_DIR)) return false; // path traversal guard
  try {
    const data = await readFile(filePath);
    const mime = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

export function createApp(): ReturnType<typeof createServer> {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/events") {
      try {
        streamGenerations(res, parseStreamOptions(url));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end(err instanceof Error ? err.message : "Bad Request");
      }
      return;
    }

    void serveStatic(url.pathname, res).then((served) => {
      if (!served) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    });
  });
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  createApp().listen(port, () => {
    console.log(`Game of Life server running at http://localhost:${port}`);
  });
}
