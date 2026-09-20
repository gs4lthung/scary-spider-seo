import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "@/lib/utils";

interface LinkCellProps {
  value: string;
  className?: string;
}

/**
 * Renders a URL value as a clickable link (opens in the system browser), with the full
 * URL shown via a native `title` tooltip on hover. Deliberately not a Radix Tooltip:
 * this cell mounts for every visible row across several columns (URL, canonical,
 * resource URL/source page) in a virtualized table, and a JS-positioned tooltip per row
 * measurably added up during fast scrolling — rows would render blank until React
 * caught up mounting them all.
 */
export function LinkCell({ value, className }: LinkCellProps) {
  return (
    <button
      type="button"
      title={value}
      onClick={(e) => {
        e.stopPropagation();
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
  );
}
