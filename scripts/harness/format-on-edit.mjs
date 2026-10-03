#!/usr/bin/env node
// PostToolUse hook: formats the file an agent just wrote, so the gate never fails on formatting.
// Reads the hook JSON on stdin and uses tool_input.file_path. Best effort: a missing or failing
// formatter is ignored, and the hook always exits 0 so it never blocks the agent.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const win = process.platform === "win32";

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(input || "{}");
    const file = payload?.tool_input?.file_path;
    if (file && existsSync(file)) format(resolve(file));
  } catch {
    /* never block the agent */
  }
  process.exit(0);
});

function quiet(cmd, args, cwd) {
  spawnSync(cmd, args, { cwd, stdio: "ignore", shell: win, timeout: 60_000 });
}

function format(file) {
  const rel = relative(root, file);
  if (rel.startsWith("..")) return;
  const ext = extname(file).toLowerCase();
  const under = (dir) => rel.startsWith(`${dir}${sep}`) || rel.startsWith(`${dir}/`);

  if (ext === ".rs" && under("src-tauri")) {
    quiet("rustfmt", ["--edition", "2021", file], join(root, "src-tauri"));
    return;
  }
  const eslint = join(root, "node_modules", ".bin", win ? "eslint.cmd" : "eslint");
  if (under("src") && [".ts", ".tsx"].includes(ext) && existsSync(eslint)) {
    quiet(eslint, ["--fix", "--no-warn-ignored", file], root);
  }
}
