import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PageResult } from "../types";
import { getPageIssueKeys } from "../lib/filters";

interface SiteTreeProps {
  pages: PageResult[];
  duplicateTitles: Set<string>;
  duplicateContent: Set<string>;
  duplicateMeta: Set<string>;
  canonicalStatusMap: Map<string, number | null>;
  linkedUrls: Set<string>;
  /** Opens the same detail modal a Pages-table row click does. */
  onSelectPage: (page: PageResult) => void;
  /** Switches to the Pages tab with the search box set to this node's path (a substring
   * match against every page URL under it — reuses the existing search, no new filtering
   * logic needed). */
  onViewInPages: (query: string) => void;
}

export interface TreeNode {
  label: string;
  /** Full path prefix identifying this node (e.g. "https://example.com/blog/3pl") — doubles
   * as its React key and as the substring query passed to `onViewInPages`. */
  path: string;
  children: TreeNode[];
  /** Pages whose URL resolves to exactly this path (usually 0 or 1 — more than 1 only
   * happens when pages differ solely by query string). */
  pages: PageResult[];
  totalPages: number;
  totalIssues: number;
}

function getOrCreateChild(siblings: TreeNode[], label: string, path: string): TreeNode {
  let node = siblings.find((n) => n.label === label);
  if (!node) {
    node = { label, path, children: [], pages: [], totalPages: 0, totalIssues: 0 };
    siblings.push(node);
  }
  return node;
}

/** Groups crawled pages into a directory tree by URL path — one root per host (almost
 * always just one, unless the crawl followed a redirect to a different domain). Doesn't
 * reflect actual internal links, only URL structure. */
export function buildTree(pages: PageResult[], issueCountOf: (page: PageResult) => number): TreeNode[] {
  const roots: TreeNode[] = [];

  for (const page of pages) {
    let url: URL;
    try {
      url = new URL(page.url);
    } catch {
      continue;
    }
    let node = getOrCreateChild(roots, url.host, `${url.protocol}//${url.host}`);
    for (const segment of url.pathname.split("/").filter(Boolean)) {
      node = getOrCreateChild(node.children, segment, `${node.path}/${segment}`);
    }
    node.pages.push(page);
  }

  function finalize(node: TreeNode): void {
    let totalPages = node.pages.length;
    let totalIssues = node.pages.reduce((sum, p) => sum + issueCountOf(p), 0);
    for (const child of node.children) {
      finalize(child);
      totalPages += child.totalPages;
      totalIssues += child.totalIssues;
    }
    node.children.sort((a, b) => b.totalPages - a.totalPages || a.label.localeCompare(b.label));
    node.totalPages = totalPages;
    node.totalIssues = totalIssues;
  }
  roots.forEach(finalize);
  roots.sort((a, b) => b.totalPages - a.totalPages);
  return roots;
}

/** A node is expanded by default at the host root and its direct children (depth <= 1),
 * so the tree shows real structure on first render instead of one collapsed host row.
 * Anything the user has explicitly toggled overrides that default, so it survives the
 * tree being rebuilt as more pages stream in during a live crawl. */
function isExpanded(overrides: Map<string, boolean>, node: TreeNode, depth: number): boolean {
  return overrides.has(node.path) ? overrides.get(node.path)! : depth <= 1;
}

function TreeRow({
  node,
  depth,
  overrides,
  onToggle,
  onSelectPage,
  onViewInPages,
}: {
  node: TreeNode;
  depth: number;
  overrides: Map<string, boolean>;
  onToggle: (node: TreeNode, depth: number) => void;
  onSelectPage: (page: PageResult) => void;
  onViewInPages: (query: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const open = isExpanded(overrides, node, depth);
  const isSinglePage = node.pages.length === 1;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 rounded-md py-1 pr-1.5 hover:bg-muted/60"
        style={{ paddingLeft: depth * 18 + 6 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node, depth)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="inline-block size-3.5 shrink-0" />
        )}
        {isSinglePage ? (
          <button
            type="button"
            title={node.pages[0].url}
            onClick={() => onSelectPage(node.pages[0])}
            className="min-w-0 flex-1 truncate text-left underline decoration-dotted underline-offset-2 hover:text-primary hover:decoration-solid"
          >
            {node.label || "/"}
          </button>
        ) : (
          <span title={node.path} className="min-w-0 flex-1 truncate text-muted-foreground">
            {node.label}
          </span>
        )}
        {/* A lone leaf page's own count is always 1 — redundant noise next to the label
            itself already being the clickable page link, so skip the badge there. */}
        {node.totalPages > 0 && !(isSinglePage && node.children.length === 0) && (
          <button
            type="button"
            title={`Show ${node.totalPages} page${node.totalPages === 1 ? "" : "s"} under this path in the Pages tab`}
            onClick={() => onViewInPages(node.path)}
          >
            <Badge variant="secondary">{node.totalPages}</Badge>
          </button>
        )}
        {node.totalIssues > 0 && (
          <Badge variant="destructive" className="gap-1">
            <TriangleAlert className="size-3" />
            {node.totalIssues}
          </Badge>
        )}
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              overrides={overrides}
              onToggle={onToggle}
              onSelectPage={onSelectPage}
              onViewInPages={onViewInPages}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SiteTree({
  pages,
  duplicateTitles,
  duplicateContent,
  duplicateMeta,
  canonicalStatusMap,
  linkedUrls,
  onSelectPage,
  onViewInPages,
}: SiteTreeProps) {
  const tree = useMemo(() => {
    const issueCountOf = (page: PageResult) =>
      getPageIssueKeys(page, duplicateTitles, duplicateContent, duplicateMeta, canonicalStatusMap, linkedUrls).length;
    return buildTree(pages, issueCountOf);
  }, [pages, duplicateTitles, duplicateContent, duplicateMeta, canonicalStatusMap, linkedUrls]);

  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const handleToggle = (node: TreeNode, depth: number) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(node.path, !isExpanded(prev, node, depth));
      return next;
    });
  };

  if (pages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg ring-1 ring-foreground/10">
        <p className="text-sm text-muted-foreground">No pages crawled yet. Start a crawl above.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto rounded-lg p-2 ring-1 ring-foreground/10">
      {tree.map((root) => (
        <TreeRow
          key={root.path}
          node={root}
          depth={0}
          overrides={overrides}
          onToggle={handleToggle}
          onSelectPage={onSelectPage}
          onViewInPages={onViewInPages}
        />
      ))}
    </div>
  );
}
