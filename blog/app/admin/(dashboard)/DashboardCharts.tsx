"use client";

import { useState } from "react";
import { ChartBar, Eye, FileText, SquaresFour, Star } from "@phosphor-icons/react";

type DashboardPost = {
  id: number;
  title: string;
  category: string | null;
  status: "draft" | "published";
  viewCount: number;
  featured: boolean;
};

type ChartTab = "views" | "categories" | "status";

const TABS: { id: ChartTab; label: string }[] = [
  { id: "views", label: "Post views" },
  { id: "categories", label: "Topics" },
  { id: "status", label: "Content status" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function ChartBarRow({ label, value, max, color = "bg-primary" }: { label: string; value: number; max: number; color?: string }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 5 : 0) : 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate font-medium">{label}</span>
          <span className="shrink-0 font-mono text-muted-foreground">{formatNumber(value)}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${width}%` }} />
        </div>
      </div>
    </div>
  );
}

function ViewsChart({ posts }: { posts: DashboardPost[] }) {
  const ranked = [...posts].sort((a, b) => b.viewCount - a.viewCount).slice(0, 6);
  const max = ranked[0]?.viewCount ?? 0;

  return ranked.length > 0 ? (
    <div className="space-y-4">
      {ranked.map((post) => (
        <ChartBarRow key={post.id} label={post.title} value={post.viewCount} max={max} />
      ))}
    </div>
  ) : (
    <EmptyChart label="Create a post to start tracking views." />
  );
}

function CategoriesChart({ posts }: { posts: DashboardPost[] }) {
  const counts = new Map<string, number>();
  posts.filter((post) => post.status === "published").forEach((post) => {
    const category = post.category?.trim() || "Uncategorized";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  });
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = ranked[0]?.[1] ?? 0;

  return ranked.length > 0 ? (
    <div className="space-y-4">
      {ranked.map(([category, count], index) => (
        <ChartBarRow
          key={category}
          label={category}
          value={count}
          max={max}
          color={index % 2 === 0 ? "bg-primary" : "bg-violet-300 dark:bg-violet-400"}
        />
      ))}
    </div>
  ) : (
    <EmptyChart label="Publish a post to see topic distribution." />
  );
}

function StatusChart({ posts }: { posts: DashboardPost[] }) {
  const published = posts.filter((post) => post.status === "published").length;
  const drafts = posts.length - published;
  const total = posts.length || 1;
  const publishedWidth = `${(published / total) * 100}%`;

  return posts.length > 0 ? (
    <div>
      <div className="flex h-5 overflow-hidden rounded-full bg-secondary">
        <div className="bg-emerald-500 transition-all duration-500" style={{ width: publishedWidth }} />
        <div className="bg-violet-300 dark:bg-violet-400" style={{ width: `${(drafts / total) * 100}%` }} />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Published
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{published}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-violet-300 dark:bg-violet-400" /> Drafts
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{drafts}</p>
        </div>
      </div>
    </div>
  ) : (
    <EmptyChart label="Your publishing breakdown will appear here." />
  );
}

function EmptyChart({ label }: { label: string }) {
  return <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{label}</p>;
}

export function DashboardCharts({ posts }: { posts: DashboardPost[] }) {
  const [activeTab, setActiveTab] = useState<ChartTab>("views");
  const featured = posts.find((post) => post.featured);
  const chartTitle = activeTab === "views" ? "Most-read posts" : activeTab === "categories" ? "Published by topic" : "Publishing pipeline";
  const chartDescription = activeTab === "views" ? "The posts attracting the most tracked views." : activeTab === "categories" ? "How your published posts are distributed." : "A quick view of your editorial queue.";

  return (
    <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <ChartBar className="h-4 w-4" weight="bold" />
              <span className="font-mono text-[11px] font-bold tracking-widest uppercase">Analytics snapshot</span>
            </div>
            <h2 className="mt-2 text-lg font-bold">{chartTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{chartDescription}</p>
          </div>
          <div className="flex rounded-lg border border-border bg-background p-1" role="tablist" aria-label="Dashboard charts">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6" role="tabpanel">
          {activeTab === "views" ? <ViewsChart posts={posts} /> : null}
          {activeTab === "categories" ? <CategoriesChart posts={posts} /> : null}
          {activeTab === "status" ? <StatusChart posts={posts} /> : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 text-primary">
          <Star className="h-4 w-4" weight="fill" />
          <span className="font-mono text-[11px] font-bold tracking-widest uppercase">Homepage spotlight</span>
        </div>
        {featured ? (
          <>
            <h2 className="mt-3 text-lg font-bold leading-tight">{featured.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">This post is currently promoted in the featured slot.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Views</div>
                <p className="mt-1 text-xl font-bold tabular-nums">{formatNumber(featured.viewCount)}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><SquaresFour className="h-3.5 w-3.5" /> Topic</div>
                <p className="mt-1 truncate text-sm font-bold">{featured.category || "Uncategorized"}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-3 text-lg font-bold">No featured post yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">Choose a post and enable “Feature on homepage” to control this slot.</p>
          </>
        )}
        <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" /> Charts reflect the current D1 data.
        </div>
      </div>
    </section>
  );
}
