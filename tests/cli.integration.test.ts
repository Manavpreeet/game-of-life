import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

interface RunResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number | null;
}

function runCli(args: readonly string[], timeoutMs = 5000): Promise<RunResult> {
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

describe("cli: end-to-end", () => {
  it("renders a dense-engine animation to completion", async () => {
    const { stdout, code } = await runCli([
      "--pattern",
      "block",
      "--engine",
      "dense",
      "--gens",
      "2",
      "--delay",
      "0",
      "--width",
      "8",
      "--height",
      "6",
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("engine=dense");
    expect(stdout).toContain("generation 0/2");
    expect(stdout).toContain("generation 2/2");
    expect(stdout).toContain("█"); // block pattern renders live cells
  }, 10000);

  it("renders a sparse-engine animation to completion", async () => {
    const { stdout, code } = await runCli([
      "--pattern",
      "glider",
      "--engine",
      "sparse",
      "--gens",
      "1",
      "--delay",
      "0",
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("engine=sparse");
    expect(stdout).toContain("generation 1/1");
  }, 10000);

  it("exits non-zero with a helpful message for an unknown pattern", async () => {
    const { stderr, code } = await runCli(["--pattern", "does-not-exist", "--gens", "0"]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('Unknown --pattern "does-not-exist"');
  }, 10000);

  it("exits non-zero for a malformed rulestring", async () => {
    const { stderr, code } = await runCli(["--rule", "garbage", "--gens", "0"]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("Invalid rulestring");
  }, 10000);
});
