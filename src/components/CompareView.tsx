import { useCallback, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ArrowRightLeft, FileJson, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/DataTable";
import { LinkCell } from "@/components/link-cell";
import { cn } from "@/lib/utils";
import {
  type ChangedFieldRow,
  type CompareOptions,
  type CompareUrlRow,
  type ComparedValue,
  type CrawlComparison,
  type IssueDelta,
  changedFieldRows,
  compareCrawls,
} from "@/lib/compareCrawls";
import type { CompareRequest, CompareResponse } from "@/lib/compareCrawls.worker";
import { getIssueDef } from "@/lib/filters";
import type { CrawlSnapshot } from "../types";

type Side = "before" | "after";
type View = "added" | "removed" | "changed" | "issues";

interface LoadedCrawl {
  path: string;
  snapshot: CrawlSnapshot;
}

interface IssueDeltaRow extends IssueDelta {
  label: string;
  change: number;
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function valueText(value: ComparedValue): string {
  return value === null ? "(none)" : String(value);
}

function urlCell(value: string) {
  return <LinkCell value={value} className="block w-full truncate" />;
}

const URL_ROW_COLUMNS: ColumnDef<CompareUrlRow, string | number | null>[] = [
  { accessorKey: "url", header: "URL", size: 480, cell: (c) => urlCell(c.getValue() as string) },
  { accessorKey: "status", header: "Status", size: 80 },
  { accessorKey: "indexability", header: "Indexability", size: 170 },
  { accessorKey: "title", header: "Title", size: 360 },
];

const CHANGED_COLUMNS: ColumnDef<ChangedFieldRow, ComparedValue>[] = [
  { accessorKey: "url", header: "URL", size: 420, cell: (c) => urlCell(c.getValue() as string) },
  { accessorKey: "field", header: "Field", size: 140 },
  {
    accessorKey: "before",
    header: "Before",
    size: 300,
    cell: (c) => <span className="block truncate">{valueText(c.getValue())}</span>,
  },
  {
    accessorKey: "after",
    header: "After",
    size: 300,
    cell: (c) => <span className="block truncate">{valueText(c.getValue())}</span>,
  },
];

const ISSUE_COLUMNS: ColumnDef<IssueDeltaRow, string | number>[] = [
  { accessorKey: "label", header: "Issue", size: 320 },
  { accessorKey: "before", header: "Before", size: 100 },
  { accessorKey: "after", header: "After", size: 100 },
  {
    accessorKey: "change",
    header: "Change",
    size: 100,
    cell: (c) => {
      const change = c.getValue() as number;
      return (
        <span className={cn(change > 0 && "text-destructive", change < 0 && "text-emerald-600 dark:text-emerald-400")}>
          {change > 0 ? `+${change}` : change}
        </span>
      );
    },
  },
];

/** Runs the comparison in a worker so large crawls never freeze the window; falls back to the
 * UI thread where workers are unavailable. */
function runComparison(request: CompareRequest): Promise<CrawlComparison> {
  let worker: Worker;
  try {
    worker = new Worker(new URL("../lib/compareCrawls.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return new Promise((resolve) =>
      setTimeout(() => resolve(compareCrawls(request.before, request.after, request.options)), 0),
    );
  }
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<CompareResponse>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "Comparison failed"));
    };
    worker.postMessage(request);
  });
}

interface CrawlPickerProps {
  side: Side;
  crawl: LoadedCrawl | null;
  loading: boolean;
  onPick: (side: Side) => void;
}

function CrawlPicker({ side, crawl, loading, onPick }: CrawlPickerProps) {
  const title = side === "before" ? "Earlier crawl" : "Later crawl";
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase">{title}</span>
        <Button variant="outline" size="sm" onClick={() => onPick(side)} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <FileJson />}
          {crawl ? "Change…" : "Choose file…"}
        </Button>
      </div>
      {crawl ? (
        <div className="min-w-0 text-sm">
          <div className="truncate font-medium" title={crawl.path}>
            {fileName(crawl.path)}
          </div>
          <div className="truncate text-xs text-muted-foreground" title={crawl.snapshot.startUrl}>
            {crawl.snapshot.startUrl}
          </div>
          <div className="text-xs text-muted-foreground">
            {crawl.snapshot.pages.length.toLocaleString()} pages
            {crawl.snapshot.savedAtUnixMs > 0 && `, saved ${new Date(crawl.snapshot.savedAtUnixMs).toLocaleString()}`}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No crawl chosen.</p>
      )}
    </div>
  );
}

interface SummaryButtonProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function SummaryButton({ label, count, active, onClick }: SummaryButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-w-32 flex-col items-start rounded-lg border bg-card px-3 py-2 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active && "border-primary bg-accent",
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{count.toLocaleString()}</span>
    </button>
  );
}

/**
 * Compare mode: reads two saved crawl files (without touching the crawl on screen) and lists
 * added, removed and changed URLs plus the change in every issue count.
 */
export function CompareView() {
  const [crawls, setCrawls] = useState<Record<Side, LoadedCrawl | null>>({ before: null, after: null });
  const [loadingSide, setLoadingSide] = useState<Side | null>(null);
  const [mapHostFrom, setMapHostFrom] = useState("");
  const [mapHostTo, setMapHostTo] = useState("");
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<CrawlComparison | null>(null);
  const [view, setView] = useState<View>("changed");
  const [onlyChangedIssues, setOnlyChangedIssues] = useState(true);
  // Ignores a slow comparison's answer once a newer one has started.
  const runIdRef = useRef(0);

  const pick = useCallback(async (side: Side) => {
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "Scary Spider SEO Crawl", extensions: ["json"] }],
      });
      if (!path || typeof path !== "string") return;
      setLoadingSide(side);
      const snapshot = await invoke<CrawlSnapshot>("read_crawl_snapshot", { path });
      setCrawls((prev) => ({ ...prev, [side]: { path, snapshot } }));
      setResult(null);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoadingSide(null);
    }
  }, []);

  const swap = useCallback(() => {
    setCrawls((prev) => ({ before: prev.after, after: prev.before }));
    setResult(null);
  }, []);

  const compare = useCallback(async () => {
    const { before, after } = crawls;
    if (!before || !after) return;
    const runId = ++runIdRef.current;
    const options: CompareOptions = { mapHostFrom, mapHostTo };
    setComparing(true);
    try {
      const comparison = await runComparison({
        before: { pages: before.snapshot.pages, resources: before.snapshot.resources },
        after: { pages: after.snapshot.pages, resources: after.snapshot.resources },
        options,
      });
      if (runId === runIdRef.current) setResult(comparison);
    } catch (err) {
      if (runId === runIdRef.current) toast.error(String(err));
    } finally {
      if (runId === runIdRef.current) setComparing(false);
    }
  }, [crawls, mapHostFrom, mapHostTo]);

  const changedRows = useMemo(() => (result ? changedFieldRows(result.changed) : []), [result]);
  const issueRows = useMemo<IssueDeltaRow[]>(() => {
    if (!result) return [];
    return result.issueDeltas
      .filter((d) => !onlyChangedIssues || d.before !== d.after)
      .map((d) => ({ ...d, label: getIssueDef(d.key)?.label ?? d.key, change: d.after - d.before }));
  }, [result, onlyChangedIssues]);
  const changedIssueCount = useMemo(
    () => (result ? result.issueDeltas.filter((d) => d.before !== d.after).length : 0),
    [result],
  );

  const bothChosen = crawls.before !== null && crawls.after !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-stretch gap-2">
        <CrawlPicker side="before" crawl={crawls.before} loading={loadingSide === "before"} onPick={pick} />
        <Button
          variant="ghost"
          size="icon"
          className="self-center"
          onClick={swap}
          disabled={!bothChosen || comparing}
          aria-label="Swap earlier and later crawl"
          title="Swap earlier and later crawl"
        >
          <ArrowRightLeft />
        </Button>
        <CrawlPicker side="after" crawl={crawls.after} loading={loadingSide === "after"} onPick={pick} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="compare-map-from" className="text-xs text-muted-foreground">
            Map host
          </Label>
          <Input
            id="compare-map-from"
            className="h-8 w-56"
            placeholder="staging.example.com"
            value={mapHostFrom}
            onChange={(e) => setMapHostFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="compare-map-to" className="text-xs text-muted-foreground">
            To host
          </Label>
          <Input
            id="compare-map-to"
            className="h-8 w-56"
            placeholder="www.example.com"
            value={mapHostTo}
            onChange={(e) => setMapHostTo(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={compare} disabled={!bothChosen || comparing}>
          {comparing && <Loader2 className="animate-spin" />}
          Compare
        </Button>
        <p className="text-xs text-muted-foreground">
          Optional: map a host in both crawls before matching URLs, for example staging against production.
        </p>
      </div>

      {result ? (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Comparison results">
            <SummaryButton
              label="Added URLs"
              count={result.added.length}
              active={view === "added"}
              onClick={() => setView("added")}
            />
            <SummaryButton
              label="Removed URLs"
              count={result.removed.length}
              active={view === "removed"}
              onClick={() => setView("removed")}
            />
            <SummaryButton
              label="Changed URLs"
              count={result.changed.length}
              active={view === "changed"}
              onClick={() => setView("changed")}
            />
            <SummaryButton
              label="Issue counts changed"
              count={changedIssueCount}
              active={view === "issues"}
              onClick={() => setView("issues")}
            />
            {view === "issues" && (
              <div className="flex items-center gap-2 self-center pl-2">
                <Checkbox
                  id="compare-only-changed"
                  checked={onlyChangedIssues}
                  onCheckedChange={(checked) => setOnlyChangedIssues(checked === true)}
                />
                <Label htmlFor="compare-only-changed" className="text-sm">
                  Only changed issues
                </Label>
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1">
            {view === "added" && (
              <DataTable
                data={result.added}
                columns={URL_ROW_COLUMNS}
                emptyLabel="No URLs were added."
                storageKey="compare-urls"
              />
            )}
            {view === "removed" && (
              <DataTable
                data={result.removed}
                columns={URL_ROW_COLUMNS}
                emptyLabel="No URLs were removed."
                storageKey="compare-urls"
              />
            )}
            {view === "changed" && (
              <DataTable
                data={changedRows}
                columns={CHANGED_COLUMNS}
                emptyLabel="No URL changed status, indexability, title, meta description, H1, canonical or word count."
                storageKey="compare-changed"
              />
            )}
            {view === "issues" && (
              <DataTable
                data={issueRows}
                columns={ISSUE_COLUMNS}
                pinnedColumns={["label"]}
                emptyLabel="No issue count changed."
                storageKey="compare-issues"
              />
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {bothChosen
            ? "Press Compare to see what changed between the two crawls."
            : "Choose two saved crawl files to compare. The crawl on screen is not changed."}
        </p>
      )}
    </div>
  );
}
