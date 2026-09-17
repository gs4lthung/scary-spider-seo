// Parsing helpers for the structured post sections stored as JSON text in
// `posts.keyTakeaways` (string[]) and `posts.faqs` ({question, answer}[]).
// Both columns are nullable text and tolerate legacy/garbage values.

export function parseTakeaways(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export type PostFaq = { question: string; answer: string };

export function parseFaqs(value: string | null): PostFaq[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.question === "string" &&
          typeof item.answer === "string" &&
          item.question.trim() &&
          item.answer.trim(),
      )
      .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }));
  } catch {
    return [];
  }
}

// Serializes form fields back to the JSON shapes stored in the DB.
export function serializeTakeaways(text: string): string | null {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.length ? JSON.stringify(lines) : null;
}

export function serializeFaqs(faqs: PostFaq[]): string | null {
  const clean = faqs
    .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
    .filter((f) => f.question && f.answer);
  return clean.length ? JSON.stringify(clean) : null;
}