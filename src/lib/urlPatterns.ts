/** Splits a textarea's contents into URL patterns: one per line, trimmed, blank lines
 * dropped. Patterns are regular expressions compiled by the Rust backend
 * (`crawler/scope.rs`), which reports a bad one by its position in this list. */
export function parsePatternLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Textarea contents for a pattern list (inverse of `parsePatternLines`). */
export function formatPatternLines(patterns: readonly string[] | undefined): string {
  return (patterns ?? []).join("\n");
}
