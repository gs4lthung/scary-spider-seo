// Runs `compareCrawls` off the UI thread: two large saved crawls mean several full passes
// (issue classification, near-duplicate clustering) that would otherwise freeze the window.
import { type CompareOptions, type ComparableCrawl, type CrawlComparison, compareCrawls } from "./compareCrawls";

export interface CompareRequest {
  before: ComparableCrawl;
  after: ComparableCrawl;
  options: CompareOptions;
}

export type CompareResponse = { ok: true; result: CrawlComparison } | { ok: false; error: string };

self.onmessage = (event: MessageEvent<CompareRequest>) => {
  const { before, after, options } = event.data;
  let response: CompareResponse;
  try {
    response = { ok: true, result: compareCrawls(before, after, options) };
  } catch (err) {
    response = { ok: false, error: String(err) };
  }
  self.postMessage(response);
};
