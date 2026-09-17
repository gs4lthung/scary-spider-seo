"use client";

import { useEffect } from "react";

const CONFIRM_MESSAGE = "You have unsaved changes. Leave without saving?";

// Warns before the user leaves a page with unsaved changes, covering all three
// exit paths:
//   - Tab close / reload / full-page navigation  -> beforeunload (native dialog)
//   - Client-side navigation via links            -> capture-phase click
//     interception with window.confirm (Next App Router's client router does
//     not fire beforeunload, so the browser dialog never appears)
//   - Browser back/forward                        -> popstate, re-pushing the
//     current URL when the user cancels
//
// External links and target="_blank" links are left alone: opening a new tab
// does not lose the current form state, and external navigation unloads the
// page, which beforeunload already guards.
export function useUnsavedChangesWarning(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }

    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (!anchor.href || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = new URL(anchor.href, window.location.origin);
      if (href.href === window.location.href) return;
      if (href.origin !== window.location.origin) return;

      if (!window.confirm(CONFIRM_MESSAGE)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }

    function handlePopState() {
      if (window.confirm(CONFIRM_MESSAGE)) return;
      window.history.pushState(null, "", window.location.href);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [enabled]);
}