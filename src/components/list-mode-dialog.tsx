import { useId } from "react";
import { List, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MAX_LIST_URLS, type ParsedUrlList } from "@/lib/url";
import { cn } from "@/lib/utils";

export type CrawlMode = "spider" | "list";

/** Invalid lines shown in the dialog; the rest are summarized as a count. */
const MAX_INVALID_SHOWN = 100;

interface CrawlModeToggleProps {
  mode: CrawlMode;
  disabled?: boolean;
  onChange: (mode: CrawlMode) => void;
}

/** Spider (follow links from a start URL) or List (crawl exactly a pasted list). */
export function CrawlModeToggle({ mode, disabled, onChange }: CrawlModeToggleProps) {
  const options: { value: CrawlMode; label: string; icon: typeof List; hint: string }[] = [
    { value: "spider", label: "Spider", icon: Network, hint: "Follow links from a start URL" },
    { value: "list", label: "List", icon: List, hint: "Crawl only a pasted list of URLs" },
  ];
  return (
    <div role="group" aria-label="Crawl mode" className="flex shrink-0 items-center gap-0.5 rounded-lg border p-0.5">
      {options.map(({ value, label, icon: Icon, hint }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={mode === value ? "secondary" : "ghost"}
          aria-pressed={mode === value}
          title={hint}
          disabled={disabled}
          onClick={() => onChange(value)}
        >
          <Icon />
          {label}
        </Button>
      ))}
    </div>
  );
}

interface ListModeDialogProps {
  text: string;
  parsed: ParsedUrlList;
  disabled?: boolean;
  onTextChange: (text: string) => void;
}

function urlCountLabel(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "URL" : "URLs"}`;
}

/** The list-mode URL list: a trigger showing how many URLs will be crawled, and a dialog
 * with a one-URL-per-line textarea that reports the valid count and the invalid lines. */
export function ListModeDialog({ text, parsed, disabled, onTextChange }: ListModeDialogProps) {
  const id = useId();
  const summaryId = `${id}-summary`;
  const validCount = parsed.valid.length;
  const overCap = validCount > MAX_LIST_URLS;
  const invalidShown = parsed.invalid.slice(0, MAX_INVALID_SHOWN);
  const invalidHidden = parsed.invalid.length - invalidShown.length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled} className="w-full max-w-md justify-start font-normal">
          <List />
          {validCount > 0 ? `${urlCountLabel(validCount)} to crawl` : "Paste URLs to crawl"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>List mode</DialogTitle>
          <DialogDescription>
            Crawls exactly these URLs without following their links. Images and external links on each page
            are still checked. One URL per line, starting with http:// or https://.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={id}>URLs</Label>
          <Textarea
            id={id}
            aria-describedby={summaryId}
            aria-invalid={overCap || undefined}
            className="max-h-72 min-h-40 overflow-y-auto font-mono text-xs [field-sizing:fixed]"
            placeholder={"https://example.com/\nhttps://example.com/about"}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
          />
          <p id={summaryId} aria-live="polite" className={cn("text-xs", overCap ? "text-destructive" : "text-muted-foreground")}>
            {overCap
              ? `${urlCountLabel(validCount)}: list mode accepts at most ${MAX_LIST_URLS.toLocaleString()}. Remove some to start.`
              : `${urlCountLabel(validCount)} to crawl (duplicates removed).`}
          </p>
        </div>
        {parsed.invalid.length > 0 && (
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-medium text-destructive">
              {parsed.invalid.length.toLocaleString()} invalid {parsed.invalid.length === 1 ? "line" : "lines"}{" "}
              will be skipped:
            </p>
            <ul className="max-h-32 overflow-y-auto rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs">
              {invalidShown.map((line, i) => (
                <li key={i} className="truncate" title={line}>
                  {line}
                </li>
              ))}
              {invalidHidden > 0 && (
                <li className="text-muted-foreground">and {invalidHidden.toLocaleString()} more</li>
              )}
            </ul>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
