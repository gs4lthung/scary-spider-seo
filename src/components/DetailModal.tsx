import { ChevronDownIcon } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { LinkCell } from "@/components/link-cell";
import { cn } from "@/lib/utils";
import type { IssueSolution } from "../lib/issueSolutions";
import type { Inlink } from "../lib/linkGraph";
import type { LinkRef } from "../types";
import { MAX_LINK_ROWS } from "../lib/linkGraph";

interface LinkRow {
  url: string;
  anchor: string;
  nofollow: boolean;
  isImageLink: boolean;
}

interface DetailModalProps {
  title: string;
  fields: Array<{ label: string; value: string | number | boolean | null | undefined; isError?: boolean }>;
  issues?: IssueSolution[];
  /** A page's internal inlinks and outlinks with anchor text. Each list holds at most
   * `MAX_LINK_ROWS` rows; the totals give the full counts. */
  links?: { inlinks: Inlink[]; inlinkTotal: number; outlinks: LinkRef[] };
  onClose: () => void;
}

function isLinkValue(value: string | number | boolean | null | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

interface LinkListProps {
  title: string;
  urlLabel: string;
  rows: LinkRow[];
  /** Number of links in the full list (`rows` may be the first part of it). */
  total: number;
}

/** A collapsible list of links with their anchor text, showing at most `MAX_LINK_ROWS` rows. */
function LinkList({ title, urlLabel, rows, total }: LinkListProps) {
  const shown = rows.slice(0, MAX_LINK_ROWS);
  return (
    <Collapsible className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
      <CollapsibleTrigger asChild>
        <button className="group flex items-center justify-between text-xs font-medium text-muted-foreground uppercase">
          {title} ({total})
          <ChevronDownIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2">
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">None found in this crawl.</p>
        ) : (
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="w-1/2 pb-1 font-medium">
                  {urlLabel}
                </th>
                <th scope="col" className="pb-1 font-medium">
                  Anchor text
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row, i) => (
                <tr key={`${row.url}-${i}`} className="border-t align-top">
                  <td className="truncate py-1 pr-3">
                    <LinkCell value={row.url} className="block w-full truncate" />
                  </td>
                  <td className="py-1 break-words">
                    {row.anchor ? row.anchor : <span className="text-destructive">(empty)</span>}
                    {row.isImageLink && <span className="ml-1.5 text-xs text-muted-foreground">image</span>}
                    {row.nofollow && <span className="ml-1.5 text-xs text-muted-foreground">nofollow</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > shown.length && (
          <p className="text-xs text-muted-foreground">
            Showing the first {shown.length} of {total}. Use Export all internal links for the full list.
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DetailModal({ title, fields, issues, links, onClose }: DetailModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex w-full max-w-2xl! flex-col gap-3 overflow-hidden sm:max-w-2xl!"
        style={{ maxHeight: "85vh" }}
        onOpenAutoFocus={(e) => {
          // Radix's default autofocus lands on the first focusable field (often a link),
          // which opens its tooltip immediately — focus the dialog itself instead.
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="truncate pr-6" title={title}>
            {title}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea type="always" className="-mx-4 min-h-0 flex-1 px-4">
          <div className="flex flex-col gap-4 pb-1">
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {fields.map((f) => {
                const isEmpty = f.value === null || f.value === undefined || f.value === "";
                const isLink = !isEmpty && isLinkValue(f.value);
                return (
                  <div key={f.label} className="flex flex-col gap-0.5 border-b py-1">
                    <div className="text-xs text-muted-foreground">{f.label}</div>
                    <div
                      className={cn(
                        "text-sm break-words",
                        f.isError && !isEmpty && "font-medium text-destructive",
                      )}
                    >
                      {isEmpty ? (
                        <span className="text-muted-foreground">—</span>
                      ) : isLink ? (
                        <LinkCell value={f.value as string} className="break-words" />
                      ) : (
                        String(f.value)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {links && (
              <>
                <LinkList
                  title="Inlinks"
                  urlLabel="From"
                  rows={links.inlinks.map((l) => ({ ...l, url: l.source }))}
                  total={links.inlinkTotal}
                />
                <LinkList title="Outlinks" urlLabel="To" rows={links.outlinks} total={links.outlinks.length} />
              </>
            )}
            {issues && issues.length > 0 && (
              <Collapsible className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
                <CollapsibleTrigger asChild>
                  <button className="group flex items-center justify-between text-xs font-medium text-muted-foreground uppercase">
                    Recommendations ({issues.length})
                    <ChevronDownIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-3">
                  {issues.map((issue) => (
                    <div key={issue.title} className="comic-panel-sm flex flex-col gap-1 rounded-md border-2! border-(--comic-ink)! bg-card p-3">
                      <div className="text-sm font-medium">{issue.title}</div>
                      <p className="text-sm text-muted-foreground">{issue.problem}</p>
                      <p className="text-sm">{issue.fix}</p>
                      <Button
                        variant="link"
                        className="h-auto justify-start self-start p-0 text-xs"
                        onClick={() => openUrl(issue.source.url)}
                      >
                        {issue.source.label} ↗
                      </Button>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
