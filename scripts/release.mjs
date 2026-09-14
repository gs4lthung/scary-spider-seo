#!/usr/bin/env node
// Bumps the app version everywhere it's duplicated (package.json,
// src-tauri/tauri.conf.json, src-tauri/Cargo.toml), commits, tags `vX.Y.Z`,
// and pushes — which triggers .github/workflows/release.yml.
//
// Usage:
//   node scripts/release.mjs [major|minor|patch|X.Y.Z] [--push] [--dry-run]
//
//   (no arg)   bump patch, commit + tag locally, then ask before pushing
//   --push     bump, commit, tag, and push without asking
//   --dry-run  print what would happen, touch nothing

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_BRANCH = "main";

const PKG_PATH = path.join(ROOT, "package.json");
const TAURI_CONF_PATH = path.join(ROOT, "src-tauri", "tauri.conf.json");
const CARGO_TOML_PATH = path.join(ROOT, "src-tauri", "Cargo.toml");

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function gitInherit(args) {
  execFileSync("git", args, { cwd: ROOT, stdio: "inherit" });
}

function fail(message) {
  console.error(`\nrelease: ${message}`);
  process.exit(1);
}

function nextVersion(current, bump) {
  const parts = current.split(".").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    fail(`current version "${current}" isn't a plain X.Y.Z semver — fix it manually first.`);
  }
  const [major, minor, patch] = parts;
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function bumpCargoToml(filePath, version) {
  const text = readFileSync(filePath, "utf8");
  const pattern = /^(version\s*=\s*")[^"]+(")/m;
  if (!pattern.test(text)) {
    fail(`couldn't find a top-level "version = ..." line in ${filePath}`);
  }
  writeFileSync(filePath, text.replace(pattern, `$1${version}$2`));
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} (y/N) `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const autoPush = args.includes("--push");
  const posArg = args.find((a) => !a.startsWith("--"));

  const bumpTypes = ["major", "minor", "patch"];
  let bump = "patch";
  let explicitVersion = null;
  if (posArg) {
    if (bumpTypes.includes(posArg)) {
      bump = posArg;
    } else if (/^\d+\.\d+\.\d+$/.test(posArg)) {
      explicitVersion = posArg;
    } else {
      fail(`unrecognized argument "${posArg}" — expected major, minor, patch, or an X.Y.Z version.`);
    }
  }

  const status = git(["status", "--porcelain"]);
  if (status) {
    fail(`working tree isn't clean — commit or stash first:\n${status}`);
  }

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== RELEASE_BRANCH) {
    fail(`releases are tagged from "${RELEASE_BRANCH}", but you're on "${branch}".`);
  }

  git(["fetch", "origin", RELEASE_BRANCH]);
  const local = git(["rev-parse", "HEAD"]);
  const remote = git(["rev-parse", `origin/${RELEASE_BRANCH}`]);
  if (local !== remote) {
    fail(`local ${RELEASE_BRANCH} is out of sync with origin/${RELEASE_BRANCH} — pull or push first.`);
  }

  const pkg = readJson(PKG_PATH);
  const current = pkg.version;
  const version = explicitVersion ?? nextVersion(current, bump);
  const tag = `v${version}`;

  if (version === current) {
    fail(`version is already ${current} — pass an explicit version to re-release it.`);
  }

  const localTags = git(["tag", "-l"]).split("\n").filter(Boolean);
  if (localTags.includes(tag)) {
    fail(`tag ${tag} already exists locally.`);
  }
  const remoteTag = git(["ls-remote", "--tags", "origin", tag]);
  if (remoteTag) {
    fail(`tag ${tag} already exists on origin.`);
  }

  console.log(`release: ${current} -> ${version} (tag ${tag})`);

  if (dryRun) {
    console.log("release: --dry-run, nothing written.");
    return;
  }

  pkg.version = version;
  writeJson(PKG_PATH, pkg);

  const tauriConf = readJson(TAURI_CONF_PATH);
  tauriConf.version = version;
  writeJson(TAURI_CONF_PATH, tauriConf);

  bumpCargoToml(CARGO_TOML_PATH, version);

  git(["add", PKG_PATH, TAURI_CONF_PATH, CARGO_TOML_PATH]);
  git(["commit", "-m", `Release ${tag}`]);
  git(["tag", "-a", tag, "-m", `Release ${tag}`]);

  console.log(`release: committed and tagged ${tag} locally.`);

  const shouldPush = autoPush || (await confirm(`Push ${RELEASE_BRANCH} and tag ${tag} to origin now?`));
  if (!shouldPush) {
    console.log(`release: not pushed. Run "git push origin ${RELEASE_BRANCH} && git push origin ${tag}" when ready.`);
    return;
  }

  gitInherit(["push", "origin", RELEASE_BRANCH]);
  gitInherit(["push", "origin", tag]);

  console.log(`\nrelease: pushed ${tag} — this triggers the release workflow.`);
  console.log("release: the resulting GitHub release is a DRAFT — review it and mark it as \"Latest\" once builds finish.");
}

main().catch((err) => fail(err.stack ?? String(err)));
