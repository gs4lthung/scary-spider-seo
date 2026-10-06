"""Validates cluster post drafts in content-plan/posts against plan.json and WRITER_BRIEF.md.

Usage: python content-plan/validate.py [ids...]   (no ids = all posts)
"""
import glob
import json
import os
import re
import sys
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
PLAN = json.load(open(os.path.join(HERE, "plan.json"), encoding="utf-8"))
SITE = PLAN["site"]
PRODUCT = PLAN["product"]["url"]
ALLOWED_TAGS = {"h2", "h3", "p", "strong", "em", "ul", "ol", "li", "blockquote", "a", "code", "pre", "table", "thead", "tbody", "tr", "th", "td"}
BANNED = ["in today's digital landscape", "delve", "tapestry", "seamless", "game-changer", "game changer", "in conclusion",
          "ever-evolving", "unlock", "elevate", "harness", "navigate the complexities", "it's important to note", "let's dive in"]
BAD_ANCHORS = {"click here", "read more", "here", "this post", "this article", "learn more", "this guide"}
COMPETITORS = ["screamingfrog", "ahrefs.com", "semrush.com", "moz.com", "sitebulb"]


def cat_slug(name):
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))


def url_of(p):
    return f"{SITE}/{cat_slug(p['category'])}/{p['slug']}"


URLS = {e["id"]: (e["url"], 0) for e in PLAN["existing"]}
for p in PLAN["posts"]:
    URLS[p["id"]] = (url_of(p), p["wave"])
BY_URL = {u: (k, w) for k, (u, w) in URLS.items()}


class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.links, self.text, self._a, self.heading_links = set(), [], [], None, 0
        self._in_heading = False

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag)
        if tag in ("h2", "h3"):
            self._in_heading = True
        if tag == "a":
            self._a = {"attrs": dict(attrs), "text": ""}
            if self._in_heading:
                self.heading_links += 1

    def handle_endtag(self, tag):
        if tag in ("h2", "h3"):
            self._in_heading = False
        if tag == "a" and self._a:
            self.links.append(self._a)
            self._a = None

    def handle_data(self, data):
        self.text.append(data)
        if self._a is not None:
            self._a["text"] += data


def check(path):
    errs, warns = [], []
    d = json.load(open(path, encoding="utf-8"))
    plan = next((p for p in PLAN["posts"] if p["id"] == d.get("id")), None)
    if not plan:
        return [f"unknown id {d.get('id')}"], []
    for k in ["id", "title", "slug", "category", "excerpt", "meta_title", "meta_description", "key_takeaways", "content_html", "faqs",
              "internal_links", "external_links", "editor_notes", "image_idea"]:
        if k not in d:
            errs.append(f"missing field {k}")
    if errs:
        return errs, warns
    if d["slug"] != plan["slug"]:
        errs.append("slug differs from plan")
    if d["category"] != plan["category"]:
        errs.append("category differs from plan")
    for k, lo, hi in [("title", 40, 70), ("excerpt", 140, 180), ("meta_title", 30, 60), ("meta_description", 140, 155)]:
        n = len(d[k])
        if not lo <= n <= hi:
            errs.append(f"{k} length {n} not in {lo}-{hi}")
    if "|" in d["meta_title"] or "|" in d["title"]:
        errs.append("pipe in title")
    if len(d["key_takeaways"]) != 5:
        errs.append("need exactly 5 key_takeaways")
    if not 3 <= len(d["faqs"]) <= 5:
        errs.append("need 3-5 faqs")
    for f in d["faqs"]:
        if set(f) != {"question", "answer"} or "<" in f["question"] + f["answer"]:
            errs.append("faq must be {question, answer} plain text")

    everything = json.dumps(d, ensure_ascii=False)
    if "—" in everything or "–" in everything:
        errs.append("em/en dash found")
    low = re.sub(r"<[^>]+>", " ", everything.lower())
    for b in BANNED:
        if b in low:
            errs.append(f"banned phrase: {b}")
    if "[editor" in low or "[insert" in low:
        errs.append("placeholder text in content")

    c = Collector()
    c.feed(d["content_html"])
    bad_tags = c.tags - ALLOWED_TAGS
    if bad_tags:
        errs.append(f"disallowed tags {sorted(bad_tags)}")
    if c.heading_links:
        errs.append("link inside a heading")
    if re.search(r"<\w+[^>]*\s(class|style|id)=", d["content_html"]):
        errs.append("class/style/id attribute")
    words = len(" ".join(c.text).split())
    if not 1300 <= words <= 2400:
        errs.append(f"word count {words} outside 1300-2400")
    if "The bottom line" not in d["content_html"]:
        errs.append('missing "The bottom line" H2')

    internal, product, external = [], 0, []
    for a in c.links:
        href, text = a["attrs"].get("href", ""), a["text"].strip()
        if text.lower() in BAD_ANCHORS or text.startswith("http"):
            errs.append(f"bad anchor text: {text!r}")
        if href.startswith(SITE):
            if href not in BY_URL:
                errs.append(f"internal link to unknown URL {href}")
                continue
            key, wave = BY_URL[href]
            if wave > plan["wave"]:
                errs.append(f"links forward to later wave: {href}")
            if key == plan["id"]:
                errs.append("links to itself")
            if "target" in a["attrs"]:
                errs.append(f"internal link has target: {href}")
            internal.append(key)
        elif href.rstrip("/") == PRODUCT:
            product += 1
        elif href.startswith("http"):
            if a["attrs"].get("target") != "_blank" or a["attrs"].get("rel") != "noopener noreferrer":
                errs.append(f"external link missing target/rel: {href}")
            if any(x in href for x in COMPETITORS):
                errs.append(f"competitor link: {href}")
            external.append(href)
        else:
            errs.append(f"unexpected href {href!r}")
    dupes = {k for k in internal if internal.count(k) > 1}
    if dupes:
        errs.append(f"internal targets linked more than once: {sorted(map(str, dupes))}")
    missing = [m for m in plan["must_link"] if m not in internal]
    if missing:
        errs.append(f"missing must_link targets {missing}")
    if not 3 <= len(internal) <= 7:
        errs.append(f"{len(internal)} internal links (want 3-7)")
    if product > 1:
        errs.append("more than one product link")
    if not 2 <= len(external) <= 5:
        errs.append(f"{len(external)} external links (want 2-5)")
    listed = {x["url"] for x in d["external_links"]}
    if set(external) != listed:
        warns.append("external_links field does not match links in content")
    return errs, warns


def main():
    ids = {int(x) for x in sys.argv[1:]}
    paths = sorted(glob.glob(os.path.join(HERE, "posts", "*.json")))
    if ids:
        paths = [p for p in paths if int(os.path.basename(p)[:2]) in ids]
        found = {int(os.path.basename(p)[:2]) for p in paths}
        for m in sorted(ids - found):
            print(f"{m}: FILE NOT FOUND")
    failed = False
    for p in paths:
        errs, warns = check(p)
        name = os.path.basename(p)
        if errs:
            failed = True
            print(f"{name}: FAIL")
            for e in errs:
                print(f"  - {e}")
        else:
            print(f"{name}: OK")
        for w in warns:
            print(f"  (warn) {w}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
