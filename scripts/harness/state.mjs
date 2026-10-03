#!/usr/bin/env node
// Progress tracker for the gseo harness. State lives in docs/harness/state.json (committed, so
// progress follows the repository). Tasks come from the `## T<m>.<n>: title` headings in
// docs/plan/M<m>-*.md; dependencies from the mermaid graph in docs/plan/00-overview.md.
//
//   node scripts/harness/state.mjs init M1          add the milestone's tasks (keeps existing status)
//   node scripts/harness/state.mjs run-start M1     mark a run active
//   node scripts/harness/state.mjs run-stop         mark the run finished
//   node scripts/harness/state.mjs next             print the next runnable task id, or "none"
//   node scripts/harness/state.mjs set T1.3 in_progress|done|blocked|pending ["note"]
//   node scripts/harness/state.mjs summary [M1]     print a table of the active (or given) milestone
//   node scripts/harness/state.mjs remaining [M1]   print how many runnable tasks are left
//   node scripts/harness/state.mjs milestones       print every milestone that has a plan file
//   node scripts/harness/state.mjs first-open       print the lowest milestone with runnable tasks, or "none"

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const planDir = join(root, "docs", "plan");
const statePath = join(root, "docs", "harness", "state.json");
const STATUSES = new Set(["pending", "in_progress", "done", "blocked"]);
const TASK_HEADING = /^## (T\d+\.\d+): (.+)$/gm;

export function loadState() {
  if (!existsSync(statePath)) return { run: { active: false }, tasks: {} };
  return JSON.parse(readFileSync(statePath, "utf8"));
}

function saveState(state) {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function now() {
  return new Date().toISOString();
}

function milestoneNumber(arg) {
  const n = Number.parseInt(String(arg ?? "").replace(/\D/g, ""), 10);
  if (!n) throw new Error(`expected a milestone like M1, got "${arg}"`);
  return n;
}

function milestoneNumbers() {
  if (!existsSync(planDir)) return [];
  return readdirSync(planDir)
    .map((f) => /^M(\d+)-.*\.md$/.exec(f)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b);
}

function parseTasks(m) {
  const file = readdirSync(planDir).find((f) => f.startsWith(`M${m}-`) && f.endsWith(".md"));
  if (!file) throw new Error(`no plan file docs/plan/M${m}-*.md`);
  const text = readFileSync(join(planDir, file), "utf8");
  return [...text.matchAll(TASK_HEADING)].map((match) => ({
    id: match[1],
    title: match[2].replaceAll("`", "").trim(),
    plan: `docs/plan/${file}`,
  }));
}

function parseDeps() {
  const text = readFileSync(join(planDir, "00-overview.md"), "utf8");
  const block = text.match(/```mermaid\s*\n([\s\S]*?)```/)?.[1] ?? "";
  const deps = {};
  for (const line of block.split("\n")) {
    // Accepts `T1.1 --> T1.2` as well as labelled nodes like `T1.1[Title] --> T1.2`.
    const nodes = line
      .split("-->")
      .map((s) => s.trim().replace(/[[(].*$/, "").trim())
      .filter((s) => /^T\d+\.\d+$/.test(s));
    for (let i = 1; i < nodes.length; i += 1) {
      (deps[nodes[i]] ??= new Set()).add(nodes[i - 1]);
    }
  }
  return Object.fromEntries(Object.entries(deps).map(([k, v]) => [k, [...v].sort()]));
}

function taskOrder(a, b) {
  const [am, an] = a.slice(1).split(".").map(Number);
  const [bm, bn] = b.slice(1).split(".").map(Number);
  return am - bm || an - bn;
}

// A task is runnable when it is pending or in_progress and every dependency is done.
// It is stuck when a dependency is blocked (directly or transitively).
export function classify(state, milestone = state.run.milestone) {
  const status = (id) => state.tasks[id]?.status;
  const stuck = new Set();
  const isStuck = (id, seen = new Set()) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return (state.tasks[id]?.deps ?? []).some((d) => status(d) === "blocked" || isStuck(d, seen));
  };
  const runnable = [];
  for (const id of Object.keys(state.tasks).sort(taskOrder)) {
    const t = state.tasks[id];
    if (t.milestone !== milestone) continue;
    if (t.status === "done" || t.status === "blocked") continue;
    if (isStuck(id)) {
      stuck.add(id);
      continue;
    }
    if (t.deps.every((d) => status(d) === "done")) runnable.push(id);
  }
  return { runnable, stuck: [...stuck] };
}

function init(state, m) {
  const deps = parseDeps();
  const tasks = parseTasks(m);
  for (const t of tasks) {
    const prev = state.tasks[t.id];
    state.tasks[t.id] = {
      title: t.title,
      milestone: m,
      plan: t.plan,
      deps: deps[t.id] ?? [],
      status: prev?.status ?? "pending",
      attempts: prev?.attempts ?? 0,
      note: prev?.note ?? "",
      updatedAt: prev?.updatedAt ?? now(),
    };
  }
  return tasks;
}

function main() {
  const [cmd, a, b, ...rest] = process.argv.slice(2);
  const state = loadState();
  switch (cmd) {
    case "init": {
      const m = milestoneNumber(a);
      const tasks = init(state, m);
      saveState(state);
      console.log(`initialised M${m}: ${tasks.map((t) => t.id).join(", ")}`);
      break;
    }
    case "run-start": {
      const m = milestoneNumber(a);
      state.run = { active: true, milestone: m, startedAt: now(), lastProgressAt: now() };
      saveState(state);
      console.log(`run started for M${m}`);
      break;
    }
    case "run-stop": {
      state.run = { ...state.run, active: false, finishedAt: now() };
      saveState(state);
      console.log("run stopped");
      break;
    }
    case "next": {
      console.log(classify(state).runnable[0] ?? "none");
      break;
    }
    case "remaining": {
      const m = a ? milestoneNumber(a) : state.run.milestone;
      console.log(String(classify(state, m).runnable.length));
      break;
    }
    case "milestones": {
      console.log(milestoneNumbers().map((m) => `M${m}`).join(" "));
      break;
    }
    case "first-open": {
      // Initialises every milestone so tasks added to a plan since the last run are counted.
      const open = milestoneNumbers().find((m) => {
        init(state, m);
        return classify(state, m).runnable.length > 0;
      });
      saveState(state);
      console.log(open ? `M${open}` : "none");
      break;
    }
    case "set": {
      if (!state.tasks[a]) throw new Error(`unknown task ${a}; run init first`);
      if (!STATUSES.has(b)) throw new Error(`status must be one of ${[...STATUSES].join(", ")}`);
      const t = state.tasks[a];
      if (b === "in_progress" && t.status !== "in_progress") t.attempts += 1;
      t.status = b;
      if (rest.length) t.note = rest.join(" ");
      t.updatedAt = now();
      state.run.lastProgressAt = now();
      saveState(state);
      console.log(`${a} -> ${b}`);
      break;
    }
    case "summary": {
      const m = a ? milestoneNumber(a) : state.run.milestone;
      const { stuck } = classify(state, m);
      for (const id of Object.keys(state.tasks).sort(taskOrder)) {
        const t = state.tasks[id];
        if (m && t.milestone !== m) continue;
        const shown = stuck.includes(id) ? "stuck (dependency blocked)" : t.status;
        console.log(`${id.padEnd(6)} ${shown.padEnd(28)} ${t.title}${t.note ? `  (${t.note})` : ""}`);
      }
      break;
    }
    default:
      console.log("usage: state.mjs init|run-start|run-stop|next|remaining|milestones|first-open|set|summary (see header)");
      process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
