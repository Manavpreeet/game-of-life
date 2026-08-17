import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

interface RunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number | null;
}

function runCli(args: readonly string[], timeoutMs = 20000): Promise<RunResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("npx", ["tsx", "src/cli.ts", ...args], { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`CLI did not exit within ${timeoutMs}ms. stdout so far:\n${stdout}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ stdout, stderr, code });
    });
  });
}

describe("census CLI: --workers", () => {
  it("produces the same report as a single-threaded run over the same options", async () => {
    const commonArgs = ["census", "--soups", "30", "--size", "12", "--seed-start", "0", "--json"];
    const [sequential, parallel] = await Promise.all([
      runCli(commonArgs),
      runCli([...commonArgs, "--workers", "4"]),
    ]);

    expect(sequential.code).toBe(0);
    expect(parallel.code).toBe(0);

    const sequentialReport = JSON.parse(sequential.stdout) as { entries: unknown[] };
    const parallelReport = JSON.parse(parallel.stdout) as { entries: unknown[] };
    expect(parallelReport.entries).toEqual(sequentialReport.entries);
  }, 30000);

  it("prints a worker-count notice to stderr when --workers > 1", async () => {
    const { stderr, code } = await runCli([
      "census",
      "--soups",
      "10",
      "--size",
      "10",
      "--workers",
      "3",
    ]);
    expect(code).toBe(0);
    expect(stderr).toContain("running across 3 workers");
  }, 20000);

  it("--workers 1 behaves like the default (no worker-count notice)", async () => {
    const { stderr, code } = await runCli([
      "census",
      "--soups",
      "10",
      "--size",
      "10",
      "--workers",
      "1",
    ]);
    expect(code).toBe(0);
    expect(stderr).not.toContain("running across");
  }, 20000);
});
