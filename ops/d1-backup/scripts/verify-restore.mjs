import { readFile } from "node:fs/promises";

const args = parseArgs(process.argv.slice(2));
const expected = JSON.parse(await readFile(args.expected, "utf8"));
const actual = JSON.parse(await readFile(args.actual, "utf8"));
const rows = findCountRows(actual);

for (const [table, count] of Object.entries(expected)) {
  if (rows.get(table) !== count) {
    throw new Error(`Restore count mismatch for ${table}: expected ${count}, got ${rows.get(table) ?? "missing"}`);
  }
}

console.log(`Restore verified for ${Object.keys(expected).length} tables.`);

function findCountRows(value, rows = new Map()) {
  if (Array.isArray(value)) {
    for (const item of value) {
      findCountRows(item, rows);
    }
  } else if (value && typeof value === "object") {
    if (typeof value.table_name === "string" && value.row_count !== undefined) {
      rows.set(value.table_name, Number(value.row_count));
    }
    for (const child of Object.values(value)) {
      findCountRows(child, rows);
    }
  }
  return rows;
}

function parseArgs(argumentsList) {
  const values = {};
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!name.startsWith("--") || !value) {
      throw new Error("Usage: verify-restore.mjs --expected counts.json --actual result.json");
    }
    values[name.slice(2)] = value;
  }
  if (!values.expected || !values.actual) {
    throw new Error("Both --expected and --actual are required");
  }
  return values;
}
