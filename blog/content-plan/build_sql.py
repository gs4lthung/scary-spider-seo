"""Builds the D1 SQL files for the content plan from content-plan/posts/*.json and linkbacks.json.

Usage: python content-plan/build_sql.py

Outputs (content-plan/sql/):
  00-categories.sql        new categories (idempotent)
  02-drafts.sql            every planned post inserted as a draft (skips slugs that already exist)
  wave-<n>-linkbacks.sql   links from older posts to the posts of wave n; run AFTER publishing wave n
"""
import glob
import json
import os
import re
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SQL_DIR = os.path.join(HERE, "sql")
PLAN = json.load(open(os.path.join(HERE, "plan.json"), encoding="utf-8"))
AUTHOR_USERNAME = "lthung_0412"


def q(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def cat_slug(name):
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))


def load_posts():
    posts = [json.load(open(p, encoding="utf-8")) for p in sorted(glob.glob(os.path.join(HERE, "posts", "*.json")))]
    planned = {p["id"] for p in PLAN["posts"]}
    got = {p["id"] for p in posts}
    if planned - got:
        raise SystemExit(f"missing post files for ids {sorted(planned - got)}")
    return sorted(posts, key=lambda p: p["id"])


def write(name, statements):
    with open(os.path.join(SQL_DIR, name), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(statements) + "\n")
    print(f"wrote sql/{name} ({len(statements)} statements)")


def build_categories():
    names = sorted({p["category"] for p in PLAN["posts"]})
    write("00-categories.sql", [
        f"INSERT OR IGNORE INTO categories (slug, name) VALUES ({q(cat_slug(n))}, {q(n)});" for n in names
    ])


def build_drafts(posts):
    now = int(time.time())
    stmts = []
    for p in posts:
        values = {
            "slug": q(p["slug"]),
            "title": q(p["title"]),
            "excerpt": q(p["excerpt"]),
            "content": q(p["content_html"]),
            "key_takeaways": q(json.dumps(p["key_takeaways"], ensure_ascii=False)),
            "faqs": q(json.dumps(p["faqs"], ensure_ascii=False)),
            "author_id": f"(SELECT id FROM users WHERE username = {q(AUTHOR_USERNAME)})",
            "category": q(p["category"]),
            "meta_title": q(p["meta_title"]),
            "meta_description": q(p["meta_description"]),
            "status": "'draft'",
            "created_at": str(now),
            "updated_at": str(now),
        }
        cols = ", ".join(values)
        vals = ", ".join(values.values())
        stmts.append(
            f"INSERT INTO posts ({cols}) SELECT {vals} WHERE NOT EXISTS (SELECT 1 FROM posts WHERE slug = {q(p['slug'])});"
        )
    write("02-drafts.sql", stmts)


def source_content(source, posts_by_id):
    """Current content of a link-back source: an existing post (E1-E4) after the existing-links update, or a planned post."""
    if isinstance(source, str) and source.startswith("E"):
        return open(os.path.join(HERE, "existing", f"post-{source[1:]}-new.html"), encoding="utf-8").read()
    return posts_by_id[source]["content_html"]


def source_slug(source):
    if isinstance(source, str) and source.startswith("E"):
        return next(e for e in PLAN["existing"] if e["id"] == source)["url"].rsplit("/", 1)[-1]
    return next(p for p in PLAN["posts"] if p["id"] == source)["slug"]


def build_linkbacks(posts):
    path = os.path.join(HERE, "linkbacks.json")
    if not os.path.exists(path):
        print("no linkbacks.json yet, skipping wave link-back files")
        return
    posts_by_id = {p["id"]: p for p in posts}
    wave_of = {p["id"]: p["wave"] for p in PLAN["posts"]}
    target_urls = {p["id"]: f"{PLAN['site']}/{cat_slug(p['category'])}/{p['slug']}" for p in PLAN["posts"]}
    by_wave = {}
    for lb in json.load(open(path, encoding="utf-8")):
        target_wave = wave_of[lb["target"]]
        src = lb["source"]
        src_wave = 0 if isinstance(src, str) else wave_of[src]
        if src_wave >= target_wave:
            raise SystemExit(f"link-back source {src} is not older than target {lb['target']}")
        content = source_content(src, posts_by_id)
        label = f"link-back {src}->{lb['target']}"
        if content.count(lb["find"]) != 1:
            raise SystemExit(f"{label}: find text occurs {content.count(lb['find'])} times")
        if "<a " in lb["find"] or "—" in lb["replace"]:
            raise SystemExit(f"{label}: find must not contain a link, replace must not contain an em dash")
        before = content[: content.index(lb["find"])]
        if before.count("<a ") != before.count("</a>"):
            raise SystemExit(f"{label}: find text sits inside an existing link")
        target_url = target_urls[lb["target"]]
        if target_url in content:
            raise SystemExit(f"{label}: source already links to the target")
        added = lb["replace"].count("<a ") - lb["find"].count("<a ")
        if added != 1 or f'href="{target_url}"' not in lb["replace"]:
            raise SystemExit(f"{label}: replace must add exactly one link to {target_url}")
        target_href = f'href="{target_url}"'
        # Guarded so re-running is a no-op (the source already links the target) and a post whose
        # sentence was edited by hand is left alone (the find text is gone).
        by_wave.setdefault(target_wave, []).append(
            f"UPDATE posts SET content = replace(content, {q(lb['find'])}, {q(lb['replace'])}), updated_at = CAST(strftime('%s','now') AS INTEGER) "
            f"WHERE slug = {q(source_slug(src))} AND instr(content, {q(lb['find'])}) > 0 "
            f"AND instr(content, {q(target_href)}) = 0;"
        )
    for wave, stmts in sorted(by_wave.items()):
        write(f"wave-{wave}-linkbacks.sql", stmts)


def main():
    os.makedirs(SQL_DIR, exist_ok=True)
    posts = load_posts()
    build_categories()
    build_drafts(posts)
    build_linkbacks(posts)


if __name__ == "__main__":
    main()
