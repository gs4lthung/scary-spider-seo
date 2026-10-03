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
- **Requests are counted at the server (added in T4.6).** `out.resources` is keyed by URL, so it
  cannot show an image checked twice. The fixture server counts requests per method and path,
  the counts are reset before each timed attempt, and the attempt asserts exactly 2001 image
  requests (any method), exactly one for `/gen/img/shared.png`, and one `GET /gen/0`.
- **The time check is tolerant of a busy machine.**
  - An untimed 50-page warm-up crawl first pays one-off costs (lazy statics, client setup).
  - Up to 3 timed attempts; the test passes as soon as one finishes within 60 s. A single run
    slowed by a parallel build is retried; a crawler that is consistently too slow still fails,
    with every attempt's time in the panic message.
  - Each attempt is wrapped in a 150 s `tokio::time::timeout` (2.5 times the budget, lowered
    from 300 s in T4.6), so a hang fails the test instead of stalling `cargo test` until the
    gate's own timeout, and three hung attempts still finish well inside it.
  - The 60 s budget is about 40 times the measured time (1.54 s, 1298 pages/s, debug build on
    the development machine when T4.5 landed), so it only trips on a slowdown of roughly 40x
    at N = 2000. That is a tripwire for a crawl that has become dramatically slower, not a
    detector of complexity: an accidental O(n^2) step per page only fails it if its constant
    is large enough to cost about 40 times today's total at this size, and a smaller
    quadratic term passes unnoticed.
- **Connections are reused (added in T4.6).** Every `/gen/` response is sent with
  `Connection: keep-alive` and the server keeps serving requests on that connection, so an
  attempt reuses reqwest's pooled connections instead of opening a fresh TCP connection per
  request. Roughly 4000 fresh connects per attempt were slow on Windows and left thousands of
  sockets in TIME_WAIT, a flake risk when attempts run back to back. The static fixture keeps
  `Connection: close`.
- **Reporting.** Each attempt prints pages per second with `eprintln!`, visible with
  `cargo test large_site -- --nocapture`.

## Consequences

- `cargo test` does roughly 4000 extra local requests per attempt (pages plus image HEADs) over a
  handful of kept-alive connections, a few seconds in debug builds; the test runs in parallel
  with the other fixture tests.
- Small regressions (say 20 percent) are not caught; this test is a tripwire, not a benchmark.
  Finer measurements belong in a dedicated benchmark if one is ever needed.
- T4.6 can reuse the same server to count requests for the start page.
