#!/usr/bin/env node
// Outer runner for fully unattended runs. Starts headless Claude Code on /gseo-run and restarts
// it while the milestone still has runnable tasks and the previous session made progress (a
// session can end early from turn limits, crashes or context pressure).
//
//   node scripts/harness/run.mjs M1                  run milestone M1
//   node scripts/harness/run.mjs                     run the first milestone with runnable tasks
//   node scripts/harness/run.mjs all                 run every milestone in order, one after another
//   node scripts/harness/run.mjs M1 --max-sessions 8
//
// Logs go to docs/harness/logs/<milestone>-<timestamp>-<n>.log (git-ignored).

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const all = args.includes("all");
const maxSessions = Number(args[args.indexOf("--max-sessions") + 1]) || 6;
const logDir = join(root, "docs", "harness", "logs");
mkdirSync(logDir, { recursive: true });

function state(...rest) {
  const r = spawnSync(process.execPath, [join(root, "scripts", "harness", "state.mjs"), ...rest], {
    cwd: root,
    encoding: "utf8",
  });
  return (r.stdout ?? "").trim();
}

function snapshot() {
  const p = join(root, "docs", "harness", "state.json");
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

// Returns true when the milestone ended with no runnable tasks left.
function runMilestone(milestone) {
  state("init", milestone);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (let n = 1; n <= maxSessions; n += 1) {
    const remaining = Number(state("remaining", milestone));
    if (remaining === 0) return true;

    const before = snapshot();
    const logPath = join(logDir, `${milestone}-${stamp}-${n}.log`);
    console.log(`[run] ${milestone} session ${n}/${maxSessions} (${remaining} runnable tasks), log: ${logPath}`);

    const prompt =
      n === 1 ? `/gseo-run ${milestone}` : `/gseo-run ${milestone} (resume: continue from docs/harness/state.json)`;
    // `claude` is a .cmd shim on Windows, which spawnSync only resolves through a shell, and
    // the shell then needs the multi-word prompt quoted.
    const win = process.platform === "win32";
    const r = spawnSync("claude", ["-p", win ? JSON.stringify(prompt) : prompt, "--permission-mode", "auto", "--output-format", "text"], {
      cwd: root,
      encoding: "utf8",
      shell: win,
      maxBuffer: 256 * 1024 * 1024,
    });
    writeFileSync(logPath, `${r.stdout ?? ""}${r.stderr ?? ""}`);

    if (r.status !== 0) console.log(`[run] session ${n} exited with code ${r.status}`);
    if (snapshot() === before) {
      console.log("[run] no progress in the last session; stopping so a human can look");
      return false;
    }
  }
  return Number(state("remaining", milestone)) === 0;
}

if (all) {
  for (;;) {
    const milestone = state("first-open");
    if (milestone === "none") break;
    const finished = runMilestone(milestone);
    console.log(state("summary", milestone));
    if (!finished) break;
  }
} else {
  const milestone = args.find((a) => /^M\d+$/i.test(a))?.toUpperCase() ?? state("first-open");
  if (milestone !== "none") runMilestone(milestone);
}

console.log(state("summary"));
