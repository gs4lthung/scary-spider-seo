# ADR-0016: List mode

Status: accepted (T3.2)

## Context

T3.2 adds Screaming Frog style List mode: crawl exactly a pasted list of URLs without following
links, while still checking images and external links. The plan fixes the config field
(`list_urls`, list mode when non-empty), seeding at depth 0, per-host robots.txt, skipping the
sitemap, never storing or consuming resume state, and a 50,000 URL cap. It leaves open:

- Whether `max_pages`, `max_depth` and T3.1's include/exclude patterns apply to listed URLs.
- What "valid" means for a pasted line, and how duplicates are compared.
- What happens to a spider crawl's leftover resume state when a list crawl starts.
- How a per-host robots.txt interacts with `Crawl-delay`.
- Where the cap is enforced.

## Decision

**Scope of the list.** Every listed URL is crawled: the list is an explicit choice, like the
spider start URL, which T3.1 also exempts from the patterns. `max_pages` does not apply (the
list, capped at 50,000, is the limit) and `max_depth` has nothing to limit because no link is
followed. Discovered internal links are still inserted into `linked_urls`, which is harmless
because no sitemap is read in list mode, so no page can be flagged as an orphan.

**Valid lines.** `parseUrlList` (frontend) trims each line, skips blank ones, and accepts only
absolute `http://` or `https://` URLs with a host. A schemeless line such as `example.com/page` is
reported as invalid rather than guessed, because a pasted list normally carries schemes and a
wrong guess would crawl a different URL. Duplicates are compared on the URL without its fragment,
the same key the crawler dedups by, and the first occurrence wins. Rust repeats the same parse,
filter and dedup (`list_mode_seeds`) defensively and ignores whatever does not parse.

**Resume.** `start_crawl` takes the resume slot as before but never hands it to a list crawl, so a
spider crawl's leftover frontier is discarded along with the cleared results. `run_crawl` ignores
any resume state passed in list mode and never stores one when a list crawl is stopped. The
frontend never treats a list start as "continuing", and restores the spider start URL it replaced
if the backend rejects a list start.

**robots.txt.** Rules are cached per origin (scheme, host, port) in a `HashMap<String,
RobotsRules>`. A spider crawl only ever looks up the start URL's origin, exactly as before. List
mode fetches an origin's robots.txt lazily the first time one of its URLs is dispatched (raced
against cancellation). The politeness delay is the larger of the configured delay and the
`Crawl-delay` of the URL's own origin, applied across the whole crawl.

**Internal images.** In list mode an image is internal when it is on the listed page's own host,
since the list can span hosts; spider mode still compares with the start URL's host.

**Cap.** The frontend refuses to start with more than 50,000 valid URLs and says so in the dialog;
`start_crawl` rejects a longer `listUrls` before touching any state (`check_list_size`); and
`list_mode_seeds` truncates as a last line of defence.

## Consequences

- `CrawlConfig` gains `listUrls` (`#[serde(default)]`, empty in `DEFAULT_CONFIG`). `CrawlConfig` is
  not part of saved snapshots; a list crawl is saved with the first listed URL as `startUrl`, so
  saved crawls load unchanged.
- The header gains a Spider/List toggle. In List mode the URL box is replaced by a button that
  opens a dialog with the URL textarea, the valid count and up to 100 invalid lines.
- Include/exclude patterns have no effect in list mode.
