# ADR-0014: Near-duplicate content via simhash

Status: accepted (T2.8)

## Context

T2.8 adds a near-duplicate check: a 64-bit simhash over lowercase word 3-shingles of the body
text (FNV-1a, hex string, empty under 20 words), and `findNearDuplicates(pages, maxDistance = 3)`
with 4 bands of 16 bits. The plan leaves open:

- How words are tokenised before shingling.
- What "excludes exact duplicates already flagged" means for a page that is both an exact copy
  of one page and a near copy of another.
- Which pages take part (redirects, errors, non-HTML, canonicalised or noindex copies).
- How clusters stay cheap while the Overview recounts every ~150 ms flush.
- How the plan's "about 90% similar" goal relates to a Hamming distance of 3.

## Decision

**Tokens.** Body text is split on whitespace, each word lowercased and stripped of leading and
trailing non-alphanumeric characters; empty tokens are dropped. Punctuation-only tokens do not
count toward the 20-word minimum. Each 3-word shingle is hashed with FNV-1a 64 and every shingle
weighs 1. `DefaultHasher` is not used because its output may change between Rust releases, and
the fingerprints are persisted in saved crawls.

**Exact copies are excluded per pair.** Two pages are near duplicates when their fingerprints
differ in at most 3 bits and their `contentHash` differs. Pairs with the same content hash are
the `duplicateContent` issue and never form a near-duplicate pair on their own. A page that is
an exact copy of one page and a near copy of another gets both issues, since both are true and
actionable. Pairs chain into clusters (union-find), and the cluster size counts every page in
it, exact copies included; the detail modal shows it as "Near-Duplicate Cluster Size".

**Participants.** Only pages with a well-formed 16-hex fingerprint that are HTML, answered 200,
did not redirect and are `Indexable`. Canonicalised and noindex copies drop out, so pointing a
copy's canonical at the preferred URL (the documented fix) clears the issue, as in Screaming
Frog's default of checking indexable pages only.

**Incremental clusters.** `NearDuplicateTracker` keeps one node per distinct fingerprint, buckets
nodes by (band index, 16-bit band value), and on each new page compares only nodes in its four
buckets. Pages with an already-seen fingerprint join its node in O(1); distinct fingerprints
always come from different texts, so their content hashes differ too. `App.tsx` feeds only new
pages each flush and takes an O(pages) snapshot (`getNearDuplicateClusters`), with no pairwise
rescan. `maxDistance` above 3 is rejected with a `RangeError`, because 4 bands only guarantee a
shared band (pigeonhole) up to distance 3.

**Distance 3 is stricter than 90%.** For unweighted simhash the expected fraction of differing
bits is about `angle / pi` for the cosine angle between the shingle sets, so 3 bits of 64
corresponds to a shingle-set cosine similarity of roughly 0.99. On a 60-word page, changing one
word in the middle (3 of 58 shingles) typically moves 3 to 7 bits; on longer pages the same edit
moves fewer. The check therefore finds pages that are nearly identical (templated pages, copies
with a changed name or date), not every page that is 90% similar. The plan fixes the distance at
3 and the 4x16 banding, so this ADR records the trade-off rather than changing it; a looser
threshold would need more, narrower bands (and more candidate comparisons) or a MinHash-style
Jaccard estimate. The fixture pair (`near-dup-a.html`, `near-dup-b.html`) differs in its last
word, which changes one shingle, and lands at distance 1.

## Consequences

- `PageResult.content_simhash` is `#[serde(default)]`; crawls saved before it load with an empty
  fingerprint, never take part, and so produce no false near-duplicate issues.
- The CSV export gains a "Content Simhash" column.
- The fingerprint value for a given text is fixed by the unit test
  `simhash_is_stable_across_runs`; changing tokenisation or hashing changes stored values and
  would need a migration note.
