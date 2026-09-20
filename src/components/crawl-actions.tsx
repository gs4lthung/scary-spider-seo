import { Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CrawlActionsProps {
  running: boolean;
  paused: boolean;
  canStart: boolean;
  /** True when a previous crawl was stopped with URLs still queued for the current start
   * URL — the backend kept that frontier, so this click continues it instead of starting
   * over (see AppState.resume_state). */
  continuing: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

export function CrawlActions({
  running,
  paused,
  canStart,
  continuing,
  onStart,
  onStop,
  onPause,
  onResume,
}: CrawlActionsProps) {
  if (!running) {
    return (
      <Button onClick={onStart} disabled={!canStart}>
        <Play className="fill-current" />
        {continuing ? "Continue Crawl" : "Start Crawl"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {paused ? (
        <Button variant="outline" onClick={onResume}>
          <Play className="fill-current" />
          Resume
        </Button>
      ) : (
        <Button variant="outline" onClick={onPause}>
          <Pause className="fill-current" />
          Pause
        </Button>
      )}
      <Button variant="destructive" onClick={onStop}>
        <Square className="fill-current" />
        Stop
      </Button>
    </div>
  );
}
