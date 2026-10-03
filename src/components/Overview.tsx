import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import type { CrawlProgress, PageResult } from "../types";
import {
  type CustomSearchStat,
  type FilterKey,
  type IssueKey,
  type OverviewSection,
  ISSUE_DEFS,
  customSearchFilterKey,
  parseCustomSearchFilter,
} from "../lib/filters";

interface OverviewProps {
  pages: PageResult[];
  /** Affected pages or resources per issue, from App's `IssueCounter` (updated per flush in
   * proportion to the new pages, never recounted here). */
  issueCounts: Record<IssueKey, number>;
  progress: CrawlProgress | null;
  running: boolean;
  paused: boolean;
  activeFilter: FilterKey;
  onSelectFilter: (filter: FilterKey) => void;
  /** Custom search rules of the results on screen with their page counts, from App's
   * incremental tracker (no per-render rescan of every page). */
  customSearches?: CustomSearchStat[];
}

const CUSTOM_SEARCH_GROUP = "Custom search";

interface StatDef {
  key: IssueKey;
  label: string;
  tone?: "ok" | "warn" | "bad";
}

/** Overview accordion sections, derived from the issue registry: every issue with a
 * `section`, grouped in the order sections first appear in `ISSUE_DEFS`. */
const SECTIONS: Array<{ title: OverviewSection; items: StatDef[] }> = (() => {
  const byTitle = new Map<OverviewSection, StatDef[]>();
  for (const def of ISSUE_DEFS) {
    if (!def.section) continue;
    const items = byTitle.get(def.section) ?? [];
    items.push({ key: def.key, label: def.label, tone: def.tone });
    byTitle.set(def.section, items);
  }
  return [...byTitle].map(([title, items]) => ({ title, items }));
})();

const TONE_TEXT: Record<"ok" | "warn" | "bad", string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
};

function StatTile({
  active,
  value,
  label,
  tone,
  onClick,
}: {
  active: boolean;
  value: number;
  label: string;
  tone?: "ok" | "warn" | "bad";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // min-w keeps the tile a stable size as its value's digit count changes during a
        // live crawl (e.g. 0 -> 158 -> 1580) instead of visibly growing/shrinking every update.
        "comic-panel-sm comic-wobble flex min-w-16 flex-col items-start gap-0 rounded-lg border-2! border-(--comic-ink)! px-3 py-1.5 text-left transition-colors hover:bg-muted/60",
        active && "bg-muted",
      )}
    >
      <span className={cn("text-lg leading-tight font-semibold tabular-nums", tone && TONE_TEXT[tone])}>{value}</span>
      <span className="text-xs whitespace-nowrap text-muted-foreground">{label}</span>
    </button>
  );
}

export function Overview({
  pages,
  issueCounts,
  progress,
  running,
  paused,
  activeFilter,
  onSelectFilter,
  customSearches = [],
}: OverviewProps) {
  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of pages) {
      const bucket = p.status ? `${Math.floor(p.status / 100)}xx` : "error";
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    return counts;
  }, [pages]);

  const totalIssues = SECTIONS.flatMap((g) => g.items).reduce((sum, i) => sum + issueCounts[i.key], 0);

  const activeGroupTitle = useMemo(
    () =>
      parseCustomSearchFilter(activeFilter)
        ? CUSTOM_SEARCH_GROUP
        : SECTIONS.find((g) => g.items.some((i) => i.key === activeFilter))?.title,
    [activeFilter],
  );

  const [openGroups, setOpenGroups] = useState<string[]>([]);
  useEffect(() => {
    if (activeGroupTitle) {
      setOpenGroups((prev) => (prev.includes(activeGroupTitle) ? prev : [...prev, activeGroupTitle]));
    }
  }, [activeGroupTitle]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatTile active={false} value={pages.length} label="Pages crawled" onClick={() => {}} />
        <StatTile active={false} value={progress?.queued ?? 0} label="Queued" onClick={() => {}} />
        <StatTile
          active={activeFilter === "2xx"}
          value={byStatus["2xx"] ?? 0}
          label="2xx"
          tone="ok"
          onClick={() => onSelectFilter("2xx")}
        />
        <StatTile
          active={activeFilter === "3xx"}
          value={byStatus["3xx"] ?? 0}
          label="3xx"
          tone="warn"
          onClick={() => onSelectFilter("3xx")}
        />
        <StatTile
          active={activeFilter === "4xx5xx"}
          value={issueCounts["4xx5xx"]}
          label="4xx/5xx/Error"
          tone="bad"
          onClick={() => onSelectFilter("4xx5xx")}
        />
        <div className="flex-1" />
        <Badge variant={totalIssues > 0 ? "destructive" : "secondary"} className="h-auto py-1">
          {totalIssues > 0 ? `${totalIssues} issue${totalIssues === 1 ? "" : "s"}` : "No issues found"}
        </Badge>
        <Badge variant="outline" className="h-auto gap-1.5 py-1">
          <span className={cn("size-1.5 rounded-full", running && !paused ? "bg-emerald-500" : "bg-muted-foreground")} />
          {running ? (paused ? "Paused" : "Crawling…") : "Idle"}
        </Badge>
      </div>

      <Accordion type="multiple" value={openGroups} onValueChange={setOpenGroups}>
        {SECTIONS.map((group) => {
          const groupTotal = group.items.reduce((sum, i) => sum + issueCounts[i.key], 0);
          return (
            <AccordionItem key={group.title} value={group.title}>
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  {group.title}
                  <Badge
                    variant={groupTotal > 0 ? "secondary" : "outline"}
                    className="h-auto min-w-9 justify-center py-0 tabular-nums"
                  >
                    {groupTotal}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <StatTile
                      key={item.key}
                      active={activeFilter === item.key}
                      value={issueCounts[item.key]}
                      label={item.label}
                      tone={item.tone}
                      onClick={() => onSelectFilter(item.key)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
        {customSearches.length > 0 && (
          // Informational, not issues: these counts are not added to the issue total.
          <AccordionItem value={CUSTOM_SEARCH_GROUP}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                {CUSTOM_SEARCH_GROUP}
                <Badge variant="outline" className="h-auto min-w-9 justify-center py-0 tabular-nums">
                  {customSearches.length}
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap gap-2">
                {customSearches.flatMap((rule) =>
                  (["contains", "missing"] as const).map((mode) => {
                    const key = customSearchFilterKey(rule.id, mode);
                    return (
                      <StatTile
                        key={key}
                        active={activeFilter === key}
                        value={mode === "contains" ? rule.contains : rule.missing}
                        label={`${rule.label}: ${mode === "contains" ? "contains" : "does not contain"}`}
                        onClick={() => onSelectFilter(key)}
                      />
                    );
                  }),
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
