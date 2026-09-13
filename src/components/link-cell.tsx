import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLinkIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface LinkCellProps {
  value: string;
  className?: string;
}

/** Renders a URL value as a clickable link with a custom tooltip; opens in the system browser. */
export function LinkCell({ value, className }: LinkCellProps) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
            e.currentTarget.blur();
            openUrl(value);
          }}
          className={cn(
            "cursor-pointer text-left underline decoration-dotted underline-offset-2 hover:text-primary hover:decoration-solid",
            className,
          )}
        >
          {value}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-sm items-start gap-2 break-all">
        <ExternalLinkIcon className="mt-0.5 size-4 shrink-0" />
        <span className="flex flex-col gap-0.5">
          <span className="font-bold">Open in browser</span>
          <span className="font-normal text-primary-foreground/80">{value}</span>
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
