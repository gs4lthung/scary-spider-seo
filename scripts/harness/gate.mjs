#!/usr/bin/env node
// Quality gate for the desktop app, shared by the implementer, the verifier and CI parity.
//
//   node scripts/harness/gate.mjs            rustfmt, clippy, cargo test, typecheck, lint, vitest
//   node scripts/harness/gate.mjs --full     the above plus `npm run build`
//
// `cargo test` includes the fixture-site crawl tests (src-tauri/src/crawler/fixture_tests.rs).
// Steps whose tool/script doesn't exist yet are reported as "skipped", not failed. Prints each
// step, the tail of any failing output, and a final JSON line: {"ok":bool,"steps":[{name,result}]}.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tauriDir = join(root, "src-tauri");
const full = process.argv.includes("--full");
const win = process.platform === "win32";
const npmScripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts ?? {};
const steps = [];

function sh(cmd, args, cwd, timeoutMs) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: win, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function step(name, cmd, args, cwd, timeoutMs) {
  const started = Date.now();
  const r = sh(cmd, args, cwd, timeoutMs);
  const secs = Math.round((Date.now() - started) / 1000);
  if (r.code === 0) {
    steps.push({ name, result: `pass (${secs}s)` });
    return;
  }
  steps.push({ name, result: `FAIL (exit ${r.code}, ${secs}s)` });
  const tail = r.out.trimEnd().split("\n").slice(-80).join("\n");
  process.stdout.write(`\n----- ${name} output (last 80 lines) -----\n${tail}\n----- end ${name} -----\n`);
}

function npmStep(name, script, timeoutMs) {
  if (!npmScripts[script]) {
    steps.push({ name, result: `skipped (no npm script "${script}")` });
    return;
  }
  step(name, "npm", ["run", "--silent", script], root, timeoutMs);
}

step("rustfmt", "cargo", ["fmt", "--check"], tauriDir, 300_000);
step("clippy", "cargo", ["clippy", "--all-targets", "--", "-D", "warnings"], tauriDir, 1_800_000);
step("cargo-test", "cargo", ["test"], tauriDir, 1_800_000);
if (npmScripts.typecheck) npmStep("typecheck", "typecheck", 600_000);
else step("typecheck", "npx", ["tsc", "--noEmit"], root, 600_000);
npmStep("lint", "lint", 600_000);
npmStep("vitest", "test", 600_000);
if (full) npmStep("build", "build", 900_000);

for (const s of steps) process.stdout.write(`[gate] ${s.name.padEnd(12)} ${s.result}\n`);
const ok = steps.every((s) => !s.result.startsWith("FAIL"));
process.stdout.write(`${JSON.stringify({ ok, steps })}\n`);
process.exit(ok ? 0 : 1);
