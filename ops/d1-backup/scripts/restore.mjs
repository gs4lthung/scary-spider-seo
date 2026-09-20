import { gunzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";

const args = parseArgs(process.argv.slice(2));
const input = await readFile(args.input);
const isGzip = input[0] === 0x1f && input[1] === 0x8b;
const document = JSON.parse(isGzip ? gunzipSync(input) : input);

if (document.formatVersion !== 1 || document.source !== "cloudflare-d1") {
  throw new Error("Unsupported backup document");
}

const expectedTables = [
  "posts",
  "categories",
  "settings",
  "users",
  "comments",
  "comment_votes",
  "login_attempts",
];

const actualTables = document.tables.map((table) => table.name);
if (actualTables.join(",") !== expectedTables.join(",")) {
  throw new Error(`Unexpected table order or set: ${actualTables.join(", ")}`);
}

const deleteOrder = ["login_attempts", "comment_votes", "comments", "posts", "categories", "settings", "users"];
const insertOrder = ["categories", "settings", "users", "posts", "comments", "comment_votes", "login_attempts"];
const tables = new Map(document.tables.map((table) => [table.name, table]));
const statements = ["PRAGMA foreign_keys = OFF"];

for (const table of deleteOrder) {
  statements.push(`DELETE FROM ${quoteIdentifier(table)}`);
}

for (const tableName of insertOrder) {
  const table = tables.get(tableName);
  for (const row of table.rows) {
    if (row.length !== table.columns.length) {
      throw new Error(`Invalid ${tableName} row length`);
    }

    const columns = table.columns.map(quoteIdentifier).join(", ");
    const values = row.map(toSqlLiteral).join(", ");
    statements.push(`INSERT INTO ${quoteIdentifier(tableName)} (${columns}) VALUES (${values})`);
  }
}

statements.push("DELETE FROM sqlite_sequence");
statements.push("PRAGMA foreign_keys = ON");
await writeFile(args.output, `${statements.map((statement) => `${statement};`).join("\n")}\n`);

if (args.counts) {
  const counts = Object.fromEntries(document.tables.map((table) => [table.name, table.rows.length]));
  await writeFile(args.counts, `${JSON.stringify(counts, null, 2)}\n`);
}

function parseArgs(argumentsList) {
  const values = {};
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!name.startsWith("--") || !value) {
      throw new Error("Usage: restore.mjs --input backup.json.gz --output restore.sql --counts counts.json");
    }
    values[name.slice(2)] = value;
  }

  if (!values.input || !values.output) {
    throw new Error("Both --input and --output are required");
  }
  return values;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function toSqlLiteral(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  if (typeof value === "string") {
    return `'${value.replaceAll("'", "''")}'`;
  }
  throw new Error(`Unsupported SQLite value type: ${typeof value}`);
}
