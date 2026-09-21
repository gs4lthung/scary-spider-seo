"use client";

import { useEffect, useState, useCallback } from "react";
import { ResourceCounts } from "@/lib/cloudflare-api";

interface Resources {
  d1: { id: string; name: string; file_size: number; num_tables: number; version: string }[];
  r2: { name: string; location: string; created_on: string }[];
  kv: { id: string; title: string }[];
  workers: { id: string; name: string; modified_on: string; created_on?: string }[];
  dns: { id: string; type: string; name: string; content: string; proxied: boolean }[];
  queues: { id: string; queue_name: string }[];
  rulesets: { id: string; name: string; phase: string; kind: string; version: string }[];
  counts: ResourceCounts;
}

type TabKey = "overview" | "d1" | "r2" | "kv" | "workers" | "dns" | "queues" | "rulesets";

interface TabDef {
  key: TabKey;
  label: string;
  icon: string;
  color: string;
  bg: string;
}

const TABS: TabDef[] = [
  { key: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", color: "text-white", bg: "bg-white/10" },
  { key: "d1", label: "D1", icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4", color: "text-orange-400", bg: "bg-orange-500/10" },
  { key: "r2", label: "R2", icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  { key: "kv", label: "KV", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", color: "text-amber-400", bg: "bg-amber-500/10" },
  { key: "workers", label: "Workers", icon: "M13 10V3L4 14h7v7l9-11h-7z", color: "text-orange-300", bg: "bg-orange-400/10" },
  { key: "dns", label: "DNS", icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9", color: "text-blue-400", bg: "bg-blue-500/10" },
  { key: "queues", label: "Queues", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10", color: "text-purple-400", bg: "bg-purple-500/10" },
  { key: "rulesets", label: "Rules", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", color: "text-cyan-400", bg: "bg-cyan-500/10" },
];

export default function Dashboard() {
  const [resources, setResources] = useState<Resources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [search, setSearch] = useState("");
  const [selectedResource, setSelectedResource] = useState<{ type: string; data: unknown } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchResources = useCallback(() => {
    setLoading(true);
    fetch("/api/resources")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setResources(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  const totalResources = resources ? Object.values(resources.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 ${sidebarOpen ? "w-64" : "w-16"} bg-[#111113] border-r border-white/5 transition-all duration-200 flex flex-col`}>
        <div className="h-16 flex items-center gap-3 px-4 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
            CF
          </div>
          {sidebarOpen && <span className="font-semibold text-sm">CF Dashboard</span>}
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group ${
                activeTab === tab.key
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              <svg className={`w-5 h-5 shrink-0 ${activeTab === tab.key ? tab.color : "text-gray-600 group-hover:text-gray-400"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left">{tab.label}</span>
                  {tab.key !== "overview" && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? tab.bg : "bg-white/5"} ${tab.color}`}>
                      {resources?.counts[tab.key as keyof ResourceCounts] ?? 0}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 text-sm transition-colors"
          >
            <svg className={`w-5 h-5 transition-transform ${sidebarOpen ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
            {sidebarOpen && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={`${sidebarOpen ? "ml-64" : "ml-16"} transition-all duration-200`}>
        {/* Top bar */}
        <header className="h-16 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-40 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">{TABS.find(t => t.key === activeTab)?.label}</h1>
            {activeTab !== "overview" && (
              <span className="text-xs text-gray-500 bg-white/5 px-2.5 py-1 rounded-full">
                {resources?.counts[activeTab as keyof ResourceCounts] ?? 0} resources
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeTab !== "overview" && (
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/25 w-64 transition-colors"
                />
              </div>
            )}
            <button
              onClick={fetchResources}
              className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              title="Refresh"
            >
              <svg className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            </button>
            <div className="h-6 w-px bg-white/10" />
            <div className="text-xs text-gray-500">
              scaryspiderseo.com
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          )}

          {loading && !resources ? (
            <LoadingSkeleton />
          ) : resources ? (
            <>
              {activeTab === "overview" && <OverviewTab resources={resources} onSelect={setActiveTab} />}
              {activeTab === "d1" && <D1Tab databases={resources.d1} search={search} onSelect={(d) => setSelectedResource({ type: "d1", data: d })} />}
              {activeTab === "r2" && <R2Tab buckets={resources.r2} search={search} onSelect={(b) => setSelectedResource({ type: "r2", data: b })} />}
              {activeTab === "kv" && <KVTab namespaces={resources.kv} search={search} onSelect={(k) => setSelectedResource({ type: "kv", data: k })} />}
              {activeTab === "workers" && <WorkersTab scripts={resources.workers} search={search} onSelect={(w) => setSelectedResource({ type: "workers", data: w })} />}
              {activeTab === "dns" && <DNSTab records={resources.dns} search={search} onSelect={(d) => setSelectedResource({ type: "dns", data: d })} />}
              {activeTab === "queues" && <QueuesTab queues={resources.queues} search={search} onSelect={(q) => setSelectedResource({ type: "queues", data: q })} />}
              {activeTab === "rulesets" && <RulesetsTab rulesets={resources.rulesets} search={search} onSelect={(r) => setSelectedResource({ type: "rulesets", data: r })} />}
            </>
          ) : null}
        </main>
      </div>

      {/* Detail modal */}
      {selectedResource && (
        <DetailModal
          type={selectedResource.type}
          data={selectedResource.data}
          onClose={() => setSelectedResource(null)}
        />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="h-96 rounded-xl bg-white/5 animate-pulse" />
    </div>
  );
}

function OverviewTab({ resources, onSelect }: { resources: Resources; onSelect: (tab: TabKey) => void }) {
  const items = TABS.filter(t => t.key !== "overview");

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Resources" value={Object.values(resources.counts).reduce((a, b) => a + b, 0)} icon="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" color="text-white" />
        <StatCard label="Databases" value={resources.counts.d1} icon="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" color="text-orange-400" />
        <StatCard label="Workers" value={resources.counts.workers} icon="M13 10V3L4 14h7v7l9-11h-7z" color="text-orange-300" />
        <StatCard label="DNS Records" value={resources.counts.dns} icon="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" color="text-blue-400" />
      </div>

      {/* Resource grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className="group p-5 rounded-xl border border-white/5 bg-[#111113] hover:bg-[#18181b] hover:border-white/10 transition-all duration-200 text-left"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-lg ${tab.bg} flex items-center justify-center`}>
                <svg className={`w-5 h-5 ${tab.color}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
              </div>
              <span className="text-3xl font-bold text-white/20 group-hover:text-white/40 transition-colors">
                {resources.counts[tab.key as keyof ResourceCounts]}
              </span>
            </div>
            <h3 className="font-medium text-white mb-1">{tab.label}</h3>
            <p className="text-sm text-gray-500">
              {tab.key === "d1" && `${resources.d1.reduce((a, b) => a + b.num_tables, 0)} tables`}
              {tab.key === "r2" && `${resources.r2.length} buckets`}
              {tab.key === "kv" && `${resources.kv.length} namespaces`}
              {tab.key === "workers" && `${resources.workers.length} scripts`}
              {tab.key === "dns" && `${resources.dns.filter(r => r.proxied).length} proxied`}
              {tab.key === "queues" && `${resources.queues.length} queues`}
              {tab.key === "rulesets" && `${resources.rulesets.length} rulesets`}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="p-4 rounded-xl border border-white/5 bg-[#111113]">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center`}>
          <svg className={`w-4 h-4 ${color}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ResourceTable<T extends Record<string, unknown>>({
  columns,
  data,
  search,
  searchKey,
  renderRow,
  onSelect,
}: {
  columns: { key: string; label: string; className?: string }[];
  data: T[];
  search: string;
  searchKey: keyof T;
  renderRow: (item: T) => React.ReactNode;
  onSelect?: (item: T) => void;
}) {
  const filtered = search
    ? data.filter((item) => String(item[searchKey] ?? "").toLowerCase().includes(search.toLowerCase()))
    : data;

  return (
    <div className="rounded-xl border border-white/5 bg-[#111113] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map((col) => (
                <th key={col.key} className={`text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3 ${col.className ?? ""}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center text-gray-500 text-sm">
                  {search ? "No results found" : "No resources"}
                </td>
              </tr>
            ) : (
              filtered.map((item, i) => (
                <tr
                  key={i}
                  onClick={() => onSelect?.(item)}
                  className={`hover:bg-white/[0.02] transition-colors ${onSelect ? "cursor-pointer" : ""}`}
                >
                  {renderRow(item)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function D1Tab({ databases, search, onSelect }: { databases: Resources["d1"]; search: string; onSelect: (d: Resources["d1"][0]) => void }) {
  return (
    <ResourceTable
      search={search}
      searchKey="name"
      data={databases}
      columns={[
        { key: "name", label: "Name" },
        { key: "num_tables", label: "Tables", className: "text-right" },
        { key: "file_size", label: "Size", className: "text-right" },
        { key: "version", label: "Version" },
        { key: "id", label: "ID", className: "w-48" },
      ]}
      onSelect={onSelect}
      renderRow={(db) => (
        <>
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <span className="font-mono text-sm text-white">{db.name}</span>
            </div>
          </td>
          <td className="px-5 py-3.5 text-right text-sm text-gray-400">{db.num_tables}</td>
          <td className="px-5 py-3.5 text-right text-sm text-gray-400">{formatBytes(db.file_size)}</td>
          <td className="px-5 py-3.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-gray-400">
              {db.version}
            </span>
          </td>
          <td className="px-5 py-3.5 font-mono text-xs text-gray-600 truncate max-w-[12rem]">{db.id}</td>
        </>
      )}
    />
  );
}

function R2Tab({ buckets, search, onSelect }: { buckets: Resources["r2"]; search: string; onSelect: (b: Resources["r2"][0]) => void }) {
  return (
    <ResourceTable
      search={search}
      searchKey="name"
      data={buckets}
      columns={[
        { key: "name", label: "Name" },
        { key: "location", label: "Location" },
        { key: "created_on", label: "Created" },
      ]}
      onSelect={onSelect}
      renderRow={(bucket) => (
        <>
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <span className="font-mono text-sm text-white">{bucket.name}</span>
            </div>
          </td>
          <td className="px-5 py-3.5 text-sm text-gray-400">{bucket.location || "auto"}</td>
          <td className="px-5 py-3.5 text-sm text-gray-500">{bucket.created_on ? new Date(bucket.created_on).toLocaleDateString() : "-"}</td>
        </>
      )}
    />
  );
}

function KVTab({ namespaces, search, onSelect }: { namespaces: Resources["kv"]; search: string; onSelect: (k: Resources["kv"][0]) => void }) {
  return (
    <ResourceTable
      search={search}
      searchKey="title"
      data={namespaces}
      columns={[
        { key: "title", label: "Title" },
        { key: "id", label: "ID", className: "w-64" },
      ]}
      onSelect={onSelect}
      renderRow={(ns) => (
        <>
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <span className="font-mono text-sm text-white">{ns.title}</span>
            </div>
          </td>
          <td className="px-5 py-3.5 font-mono text-xs text-gray-600 truncate max-w-[24rem]">{ns.id}</td>
        </>
      )}
    />
  );
}

function WorkersTab({ scripts, search, onSelect }: { scripts: Resources["workers"]; search: string; onSelect: (w: Resources["workers"][0]) => void }) {
  return (
    <ResourceTable
      search={search}
      searchKey="name"
      data={scripts}
      columns={[
        { key: "name", label: "Name" },
        { key: "modified_on", label: "Last Modified" },
        { key: "created_on", label: "Created" },
      ]}
      onSelect={onSelect}
      renderRow={(script) => (
        <>
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-400/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-mono text-sm text-white">{script.name}</span>
            </div>
          </td>
          <td className="px-5 py-3.5 text-sm text-gray-400">{new Date(script.modified_on).toLocaleString()}</td>
          <td className="px-5 py-3.5 text-sm text-gray-500">{script.created_on ? new Date(script.created_on).toLocaleDateString() : "-"}</td>
        </>
      )}
    />
  );
}

function DNSTab({ records, search, onSelect }: { records: Resources["dns"]; search: string; onSelect: (d: Resources["dns"][0]) => void }) {
  const typeColors: Record<string, string> = {
    A: "bg-blue-500/10 text-blue-400",
    AAAA: "bg-blue-500/10 text-blue-400",
    CNAME: "bg-purple-500/10 text-purple-400",
    MX: "bg-green-500/10 text-green-400",
    TXT: "bg-gray-500/10 text-gray-400",
    SRV: "bg-pink-500/10 text-pink-400",
  };

  return (
    <ResourceTable
      search={search}
      searchKey="name"
      data={records}
      columns={[
        { key: "type", label: "Type", className: "w-24" },
        { key: "name", label: "Name" },
        { key: "content", label: "Content" },
        { key: "proxied", label: "Proxied", className: "w-20" },
      ]}
      onSelect={onSelect}
      renderRow={(record) => (
        <>
          <td className="px-5 py-3.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium ${typeColors[record.type] ?? "bg-white/5 text-gray-400"}`}>
              {record.type}
            </span>
          </td>
          <td className="px-5 py-3.5 font-mono text-sm text-white">{record.name}</td>
          <td className="px-5 py-3.5 font-mono text-sm text-gray-400 truncate max-w-[24rem]">{record.content}</td>
          <td className="px-5 py-3.5">
            {record.proxied ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                On
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                Off
              </span>
            )}
          </td>
        </>
      )}
    />
  );
}

function QueuesTab({ queues, search, onSelect }: { queues: Resources["queues"]; search: string; onSelect: (q: Resources["queues"][0]) => void }) {
  return (
    <ResourceTable
      search={search}
      searchKey="queue_name"
      data={queues}
      columns={[
        { key: "queue_name", label: "Name" },
        { key: "id", label: "ID", className: "w-64" },
      ]}
      onSelect={onSelect}
      renderRow={(queue) => (
        <>
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <span className="font-mono text-sm text-white">{queue.queue_name}</span>
            </div>
          </td>
          <td className="px-5 py-3.5 font-mono text-xs text-gray-600 truncate max-w-[24rem]">{queue.id}</td>
        </>
      )}
    />
  );
}

function RulesetsTab({ rulesets, search, onSelect }: { rulesets: Resources["rulesets"]; search: string; onSelect: (r: Resources["rulesets"][0]) => void }) {
  const phaseLabels: Record<string, string> = {
    http_request_dynamic_redirect: "Dynamic Redirect",
    http_request_firewall_managed: "WAF Managed",
    http_request_firewall_custom: "WAF Custom",
    http_ratelimit: "Rate Limit",
    http_request_sanitize: "Sanitize",
    ddos_l7: "DDoS L7",
  };

  return (
    <ResourceTable
      search={search}
      searchKey="name"
      data={rulesets}
      columns={[
        { key: "name", label: "Name" },
        { key: "phase", label: "Phase" },
        { key: "kind", label: "Kind" },
        { key: "version", label: "Version" },
      ]}
      onSelect={onSelect}
      renderRow={(rs) => (
        <>
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="font-mono text-sm text-white">{rs.name}</span>
            </div>
          </td>
          <td className="px-5 py-3.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-gray-400">
              {phaseLabels[rs.phase] ?? rs.phase}
            </span>
          </td>
          <td className="px-5 py-3.5 text-sm text-gray-400">{rs.kind}</td>
          <td className="px-5 py-3.5 text-sm text-gray-500">v{rs.version}</td>
        </>
      )}
    />
  );
}

function DetailModal({ type, data, onClose }: { type: string; data: unknown; onClose: () => void }) {
  const item = data as Record<string, unknown>;

  const typeLabels: Record<string, string> = {
    d1: "D1 Database",
    r2: "R2 Bucket",
    kv: "KV Namespace",
    workers: "Worker Script",
    dns: "DNS Record",
    queues: "Queue",
    rulesets: "Ruleset",
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="font-semibold">{typeLabels[type] ?? type}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-3 max-h-96 overflow-y-auto">
          {Object.entries(item).map(([key, value]) => (
            <div key={key} className="flex items-start gap-3">
              <span className="text-xs text-gray-500 uppercase tracking-wider w-32 shrink-0 pt-0.5">{key}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-white break-all">
                    {typeof value === "object" ? JSON.stringify(value) : String(value ?? "-")}
                  </span>
                  {typeof value === "string" && value.length > 8 && (
                    <button
                      onClick={() => copyToClipboard(String(value))}
                      className="p-1 rounded text-gray-600 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                      title="Copy"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-white/5 bg-black/20">
          <button onClick={onClose} className="w-full py-2 rounded-lg bg-white/5 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
