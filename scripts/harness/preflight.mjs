#!/usr/bin/env node
// Checks the machine can run the harness before an unattended run starts.
//
//   node scripts/harness/preflight.mjs
//
// Verifies git/node/npm/cargo exist, installs npm dependencies when node_modules is missing,
// makes sure clippy and rustfmt are installed, and that the working tree has no stray changes
// on the base branch. Prints one line per check and a final JSON line {"ok":bool,"blockers":[]}.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const win = process.platform === "win32";
const blockers = [];

function sh(cmd, args, cwd = root, timeout = 600_000) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: win, timeout });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

function check(name, ok, fix) {
  console.log(`[preflight] ${name.padEnd(28)} ${ok ? "ok" : "MISSING"}`);
  if (!ok) blockers.push(fix ? `${name}: ${fix}` : name);
}

for (const [tool, args] of [["git", ["--version"]], ["node", ["--version"]], ["npm", ["--version"]], ["cargo", ["--version"]]]) {
  check(tool, sh(tool, args).code === 0, `install ${tool}`);
}

for (const component of ["clippy", "rustfmt"]) {
  const probe = component === "clippy" ? ["clippy", "--version"] : ["fmt", "--version"];
  if (sh("cargo", probe).code !== 0) sh("rustup", ["component", "add", component]);
  check(`cargo ${component}`, sh("cargo", probe).code === 0, `rustup component add ${component}`);
}

if (!existsSync(join(root, "node_modules"))) sh("npm", ["ci"], root, 1_200_000);
check("node_modules", existsSync(join(root, "node_modules")), "npm ci failed");

check("git repository", sh("git", ["rev-parse", "--is-inside-work-tree"]).code === 0, "not a git repo");

const ok = blockers.length === 0;
console.log(JSON.stringify({ ok, blockers }));
process.exit(ok ? 0 : 1);
