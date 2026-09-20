"use client";

import { useEffect } from "react";

export function TrackPostView({ postId }: { postId: number }) {
  useEffect(() => {
    void fetch("/api/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
      keepalive: true,
    });
  }, [postId]);

  return null;
}
