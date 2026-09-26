# ADR-0021: Synthetic large-site fixture and a flake-resistant throughput budget

## Context

T4.5 adds a repeatable 2000-page crawl (`/gen/<n>` in the fixture server) and a test that fails
on large throughput regressions, with a 60 s wall-time budget. Wall-clock assertions have flaked
on the development machine during earlier milestones: the gate runs `cargo test` while other
agents build in parallel, and debug builds on shared CI runners vary a lot. The plan leaves open
where the pages come from, what the images look like, and how the time check copes with a
loaded machine.

## Decision

- **Generated in memory.** `respond_generated` in `fixture_tests.rs` builds each `/gen/<n>`
  page (unique title, meta description, h1, 10 links to `(n * 7 + k) % 2000` for k in 1..=10,
  and two images) as a string, so the test measures the crawler and not disk reads. The images
  are `/gen/img/<n>.png` (unique per page) and `/gen/img/shared.png` (on every page), which
  exercises both new-resource checks and resource de-duplication. Unknown `/gen/` paths are 404.
  The generated site lives on the same `FixtureServer` as the static fixture, but it only links
  within `/gen/`, `useSitemap` stays off, and `robots.txt` only disallows `/private/`, so a crawl
  from `/gen/0` never leaves it.
- **Reachability is proven, not assumed.** `gen_links_reach_every_page` runs a BFS over the
  link pattern and asserts every page is reachable from 0 and the deepest page is below the
  crawl's `maxDepth` (100), so neither the depth limit nor the link graph decides the page count.
- **Deterministic counters carry the correctness weight.** Every timed attempt asserts exactly
  2000 pages, the exact URL set, status 200 everywhere, 2000 distinct titles, exactly 2001 image
  resources all answering 200, and 2000 linked internal URLs. These never depend on timing, so a
  lost page, a duplicate fetch or a broken resource check fails on the first attempt.
- **The time check is tolerant of a busy machine.**
  - An untimed 50-page warm-up crawl first pays one-off costs (lazy statics, client setup).
  - Up to 3 timed attempts; the test passes as soon as one finishes within 60 s. A single run
    slowed by a parallel build is retried; a crawler that is consistently too slow still fails,
    with every attempt's time in the panic message.
  - Each attempt is wrapped in a 300 s `tokio::time::timeout`, so a hang fails the test instead
    of stalling `cargo test` until the gate's own timeout.
  - The 60 s budget is several times the measured time (see the T4.5 report), so it only trips on
    order-of-magnitude regressions such as an accidental O(n^2) step per page.
- **Reporting.** Each attempt prints pages per second with `eprintln!`, visible with
  `cargo test large_site -- --nocapture`.

## Consequences

- `cargo test` does roughly 4000 extra local requests per attempt (pages plus image HEADs), a few
  seconds in debug builds; the test runs in parallel with the other fixture tests.
- Small regressions (say 20 percent) are not caught; this test is a tripwire, not a benchmark.
  Finer measurements belong in a dedicated benchmark if one is ever needed.
- T4.6 can reuse the same server to count requests for the start page.
