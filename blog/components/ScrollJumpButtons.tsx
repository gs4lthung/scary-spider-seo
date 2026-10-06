"use client";

import { useEffect, useState } from "react";
import { ArrowLineDown, ArrowLineUp } from "@phosphor-icons/react";

// Floating "jump to top" / "jump to end" buttons for long admin pages (the
// post editor in particular, where Save sits at the bottom). Each button only
// shows when there is somewhere to jump to. Mounted in the admin dashboard
// layout; the page scrolls the window (only the sidebar has its own scroll).
const EDGE_PX = 200;

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function ScrollJumpButtons() {
  const [canGoUp, setCanGoUp] = useState(false);
  const [canGoDown, setCanGoDown] = useState(false);

  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setCanGoUp(window.scrollY > EDGE_PX);
      setCanGoDown(max - window.scrollY > EDGE_PX);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // Page height changes without scrolling (editor content, loaded images,
    // "Load more" in the media library), so watch the document size too.
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  if (!canGoUp && !canGoDown) return null;

  const buttonClass =
    "flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md hover:bg-secondary hover:text-foreground";

  return (
    <div className="fixed right-6 bottom-6 z-40 flex flex-col gap-2">
      {canGoUp ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}
          className={buttonClass}
          aria-label="Jump to top"
          title="Jump to top"
        >
          <ArrowLineUp className="h-5 w-5" />
        </button>
      ) : null}
      {canGoDown ? (
        <button
          type="button"
          onClick={() =>
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: scrollBehavior() })
          }
          className={buttonClass}
          aria-label="Jump to end"
          title="Jump to end"
        >
          <ArrowLineDown className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}
