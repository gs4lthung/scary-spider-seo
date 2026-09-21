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
  icon: React.ReactNode;
}

function IconD1() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>;
}
function IconR2() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
}
function IconKV() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>;
}
function IconWorkers() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
}
function IconDNS() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
}
function IconQueues() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>;
}
function IconRules() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function IconOverview() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}

const TABS: TabDef[] = [
  { key: "overview", label: "Overview", icon: <IconOverview /> },
  { key: "d1", label: "D1 Databases", icon: <IconD1 /> },
  { key: "r2", label: "R2 Buckets", icon: <IconR2 /> },
  { key: "kv", label: "KV Namespaces", icon: <IconKV /> },
  { key: "workers", label: "Workers", icon: <IconWorkers /> },
  { key: "dns", label: "DNS Records", icon: <IconDNS /> },
  { key: "queues", label: "Queues", icon: <IconQueues /> },
  { key: "rulesets", label: "Rulesets", icon: <IconRules /> },
];

export default function Dashboard() {
  const [resources, setResources] = useState<Resources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ type: string; data: unknown } | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/resources")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setResources(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="min-h-screen bg-[#f3f4f5] flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-[#e0e0e0] flex flex-col shrink-0 fixed inset-y-0 left-0 z-30">
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-[#e0e0e0]">
          <svg width="28" height="28" viewBox="0 0 128 128" fill="none">
            <path d="M96.4 47.2c-2.4-16.4-16.4-29-33.2-29-14.8 0-27.6 10.4-31.2 24.4C14 44.2 4 55.6 4 69.2 4 84 16 96 30.8 96h61.6c11.2 0 20.4-9.2 20.4-20.4 0-9.6-6.8-17.6-16.4-18.4z" fill="#F6821F"/>
            <path d="M96.4 47.2c-2.4-16.4-16.4-29-33.2-29-14.8 0-27.6 10.4-31.2 24.4C14 44.2 4 55.6 4 69.2 4 84 16 96 30.8 96h30.8V47.2h34.8z" fill="#FBAD41"/>
          </svg>
          <span className="font-semibold text-[15px] text-[#1d1f20]">CF Dashboard</span>
        </div>

        <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(""); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-[13px] font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-[#f6821f]/10 text-[#f6821f]"
                  : "text-[#6b6f70] hover:bg-[#f3f4f5] hover:text-[#1d1f20]"
              }`}
            >
              <span className={activeTab === tab.key ? "text-[#f6821f]" : "text-[#a0a4a6]"}>{tab.icon}</span>
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.key !== "overview" && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? "bg-[#f6821f]/15 text-[#f6821f]" : "bg-[#f3f4f5] text-[#a0a4a6]"
                }`}>
                  {resources?.counts[tab.key as keyof ResourceCounts] ?? 0}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-[#e0e0e0]">
          <div className="text-[11px] text-[#a0a4a6] text-center">scaryspiderseo.com</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-60">
        {/* Header */}
        <header className="h-14 bg-white border-b border-[#e0e0e0] sticky top-0 z-20 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-semibold text-[#1d1f20]">{TABS.find(t => t.key === activeTab)?.label}</h1>
          </div>
          <div className="flex items-center gap-3">
            {activeTab !== "overview" && (
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a0a4a6]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-[#f3f4f5] border border-[#e0e0e0] rounded pl-9 pr-3 py-1.5 text-[13px] text-[#1d1f20] placeholder-[#a0a4a6] focus:outline-none focus:border-[#f6821f] focus:ring-1 focus:ring-[#f6821f]/30 w-56 transition-colors"
                />
              </div>
            )}
            <button onClick={fetchData} className="p-1.5 rounded text-[#6b6f70] hover:bg-[#f3f4f5] hover:text-[#1d1f20] transition-colors" title="Refresh">
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-[13px]">{error}</div>
          )}

          {loading && !resources ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <div key={i} className="h-20 rounded bg-white border border-[#e0e0e0] animate-pulse" />)}
            </div>
          ) : resources ? (
            <>
              {activeTab === "overview" && <OverviewTab resources={resources} onSelect={setActiveTab} />}
              {activeTab === "d1" && <D1Tab databases={resources.d1} search={search} onSelect={(d) => setSelected({ type: "d1", data: d })} />}
              {activeTab === "r2" && <R2Tab buckets={resources.r2} search={search} onSelect={(b) => setSelected({ type: "r2", data: b })} />}
              {activeTab === "kv" && <KVTab namespaces={resources.kv} search={search} onSelect={(k) => setSelected({ type: "kv", data: k })} />}
              {activeTab === "workers" && <WorkersTab scripts={resources.workers} search={search} onSelect={(w) => setSelected({ type: "workers", data: w })} />}
              {activeTab === "dns" && <DNSTab records={resources.dns} search={search} onSelect={(d) => setSelected({ type: "dns", data: d })} />}
              {activeTab === "queues" && <QueuesTab queues={resources.queues} search={search} onSelect={(q) => setSelected({ type: "queues", data: q })} />}
              {activeTab === "rulesets" && <RulesetsTab rulesets={resources.rulesets} search={search} onSelect={(r) => setSelected({ type: "rulesets", data: r })} />}
            </>
          ) : null}
        </main>
      </div>

      {selected && <DetailModal type={selected.type} data={selected.data} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ─── Overview ─── */
function OverviewTab({ resources, onSelect }: { resources: Resources; onSelect: (t: TabKey) => void }) {
  const items = TABS.filter(t => t.key !== "overview");
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: Object.values(resources.counts).reduce((a, b) => a + b, 0), color: "text-[#1d1f20]" },
          { label: "Databases", value: resources.counts.d1, color: "text-[#f6821f]" },
          { label: "Workers", value: resources.counts.workers, color: "text-[#f6821f]" },
          { label: "DNS Records", value: resources.counts.dns, color: "text-[#f6821f]" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-[#e0e0e0] p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[13px] text-[#6b6f70] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className="bg-white rounded-lg border border-[#e0e0e0] p-5 text-left hover:border-[#f6821f]/50 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[#f6821f]">{tab.icon}</div>
              <span className="text-2xl font-bold text-[#1d1f20]">
                {resources.counts[tab.key as keyof ResourceCounts]}
              </span>
            </div>
            <div className="font-medium text-[14px] text-[#1d1f20] group-hover:text-[#f6821f] transition-colors">{tab.label}</div>
            <div className="text-[13px] text-[#a0a4a6] mt-1">
              {tab.key === "d1" && `${resources.d1.reduce((a, b) => a + b.num_tables, 0)} tables total`}
              {tab.key === "r2" && `${resources.r2.length} storage buckets`}
              {tab.key === "kv" && `${resources.kv.length} namespaces`}
              {tab.key === "workers" && `${resources.workers.length} scripts deployed`}
              {tab.key === "dns" && `${resources.dns.filter(r => r.proxied).length} proxied records`}
              {tab.key === "queues" && `${resources.queues.length} message queues`}
              {tab.key === "rulesets" && `${resources.rulesets.length} rulesets active`}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Table component ─── */
function CfTable<T extends Record<string, unknown>>({
  columns, data, search, searchKey, renderRow, onSelect,
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
    <div className="bg-white rounded-lg border border-[#e0e0e0] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#e0e0e0] bg-[#fafafa]">
            {columns.map((col) => (
              <th key={col.key} className={`text-left text-[11px] font-semibold text-[#6b6f70] uppercase tracking-wider px-4 py-2.5 ${col.className ?? ""}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e0e0e0]">
          {filtered.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-[13px] text-[#a0a4a6]">
              {search ? "No results found" : "No resources"}
            </td></tr>
          ) : filtered.map((item, i) => (
            <tr
              key={i}
              onClick={() => onSelect?.(item)}
              className={`hover:bg-[#fafafa] transition-colors ${onSelect ? "cursor-pointer" : ""}`}
            >
              {renderRow(item)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── D1 ─── */
function D1Tab({ databases, search, onSelect }: { databases: Resources["d1"]; search: string; onSelect: (d: Resources["d1"][0]) => void }) {
  return (
    <CfTable search={search} searchKey="name" data={databases} onSelect={onSelect}
      columns={[
        { key: "name", label: "Name" },
        { key: "num_tables", label: "Tables", className: "text-right" },
        { key: "file_size", label: "Size", className: "text-right" },
        { key: "version", label: "Version" },
        { key: "id", label: "ID" },
      ]}
      renderRow={(db) => (
        <>
          <td className="px-4 py-3 text-[13px] font-medium text-[#1d1f20]">{db.name}</td>
          <td className="px-4 py-3 text-[13px] text-[#6b6f70] text-right">{db.num_tables}</td>
          <td className="px-4 py-3 text-[13px] text-[#6b6f70] text-right">{formatBytes(db.file_size)}</td>
          <td className="px-4 py-3">
            <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-[#f3f4f5] text-[#6b6f70] border border-[#e0e0e0]">{db.version}</span>
          </td>
          <td className="px-4 py-3 font-mono text-[11px] text-[#a0a4a6] truncate max-w-[10rem]">{db.id}</td>
        </>
      )}
    />
  );
}

/* ─── R2 ─── */
function R2Tab({ buckets, search, onSelect }: { buckets: Resources["r2"]; search: string; onSelect: (b: Resources["r2"][0]) => void }) {
  return (
    <CfTable search={search} searchKey="name" data={buckets} onSelect={onSelect}
      columns={[
        { key: "name", label: "Name" },
        { key: "location", label: "Location" },
        { key: "created_on", label: "Created" },
      ]}
      renderRow={(b) => (
        <>
          <td className="px-4 py-3 text-[13px] font-medium text-[#1d1f20]">{b.name}</td>
          <td className="px-4 py-3 text-[13px] text-[#6b6f70]">{b.location || "auto"}</td>
          <td className="px-4 py-3 text-[13px] text-[#a0a4a6]">{b.created_on ? new Date(b.created_on).toLocaleDateString() : "-"}</td>
        </>
      )}
    />
  );
}

/* ─── KV ─── */
function KVTab({ namespaces, search, onSelect }: { namespaces: Resources["kv"]; search: string; onSelect: (k: Resources["kv"][0]) => void }) {
  return (
    <CfTable search={search} searchKey="title" data={namespaces} onSelect={onSelect}
      columns={[
        { key: "title", label: "Title" },
        { key: "id", label: "ID" },
      ]}
      renderRow={(ns) => (
        <>
          <td className="px-4 py-3 text-[13px] font-medium text-[#1d1f20]">{ns.title}</td>
          <td className="px-4 py-3 font-mono text-[11px] text-[#a0a4a6] truncate max-w-[20rem]">{ns.id}</td>
        </>
      )}
    />
  );
}

/* ─── Workers ─── */
function WorkersTab({ scripts, search, onSelect }: { scripts: Resources["workers"]; search: string; onSelect: (w: Resources["workers"][0]) => void }) {
  return (
    <CfTable search={search} searchKey="name" data={scripts} onSelect={onSelect}
      columns={[
        { key: "name", label: "Name" },
        { key: "modified_on", label: "Last Modified" },
      ]}
      renderRow={(s) => (
        <>
          <td className="px-4 py-3 text-[13px] font-medium text-[#1d1f20]">{s.name}</td>
          <td className="px-4 py-3 text-[13px] text-[#6b6f70]">{new Date(s.modified_on).toLocaleString()}</td>
        </>
      )}
    />
  );
}

/* ─── DNS ─── */
function DNSTab({ records, search, onSelect }: { records: Resources["dns"]; search: string; onSelect: (d: Resources["dns"][0]) => void }) {
  const typeColor: Record<string, string> = {
    A: "bg-blue-50 text-blue-700 border-blue-200",
    AAAA: "bg-blue-50 text-blue-700 border-blue-200",
    CNAME: "bg-purple-50 text-purple-700 border-purple-200",
    MX: "bg-green-50 text-green-700 border-green-200",
    TXT: "bg-gray-50 text-gray-600 border-gray-200",
  };

  return (
    <CfTable search={search} searchKey="name" data={records} onSelect={onSelect}
      columns={[
        { key: "type", label: "Type", className: "w-20" },
        { key: "name", label: "Name" },
        { key: "content", label: "Content" },
        { key: "proxied", label: "Proxied", className: "w-20" },
      ]}
      renderRow={(r) => (
        <>
          <td className="px-4 py-3">
            <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${typeColor[r.type] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
              {r.type}
            </span>
          </td>
          <td className="px-4 py-3 text-[13px] font-medium text-[#1d1f20]">{r.name}</td>
          <td className="px-4 py-3 font-mono text-[12px] text-[#6b6f70] truncate max-w-[20rem]">{r.content}</td>
          <td className="px-4 py-3">
            {r.proxied ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-green-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />On
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[12px] text-[#a0a4a6]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d0d0d0]" />Off
              </span>
            )}
          </td>
        </>
      )}
    />
  );
}

/* ─── Queues ─── */
function QueuesTab({ queues, search, onSelect }: { queues: Resources["queues"]; search: string; onSelect: (q: Resources["queues"][0]) => void }) {
  return (
    <CfTable search={search} searchKey="queue_name" data={queues} onSelect={onSelect}
      columns={[
        { key: "queue_name", label: "Name" },
        { key: "id", label: "ID" },
      ]}
      renderRow={(q) => (
        <>
          <td className="px-4 py-3 text-[13px] font-medium text-[#1d1f20]">{q.queue_name}</td>
          <td className="px-4 py-3 font-mono text-[11px] text-[#a0a4a6] truncate max-w-[20rem]">{q.id}</td>
        </>
      )}
    />
  );
}

/* ─── Rulesets ─── */
function RulesetsTab({ rulesets, search, onSelect }: { rulesets: Resources["rulesets"]; search: string; onSelect: (r: Resources["rulesets"][0]) => void }) {
  const phaseLabel: Record<string, string> = {
    http_request_dynamic_redirect: "Dynamic Redirect",
    http_request_firewall_managed: "WAF Managed",
    http_request_firewall_custom: "WAF Custom",
    http_ratelimit: "Rate Limit",
    http_request_sanitize: "Sanitize",
    ddos_l7: "DDoS L7",
  };

  return (
    <CfTable search={search} searchKey="name" data={rulesets} onSelect={onSelect}
      columns={[
        { key: "name", label: "Name" },
        { key: "phase", label: "Phase" },
        { key: "kind", label: "Kind" },
        { key: "version", label: "Version" },
      ]}
      renderRow={(rs) => (
        <>
          <td className="px-4 py-3 text-[13px] font-medium text-[#1d1f20]">{rs.name}</td>
          <td className="px-4 py-3">
            <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-[#f3f4f5] text-[#6b6f70] border border-[#e0e0e0]">
              {phaseLabel[rs.phase] ?? rs.phase}
            </span>
          </td>
          <td className="px-4 py-3 text-[13px] text-[#6b6f70]">{rs.kind}</td>
          <td className="px-4 py-3 text-[13px] text-[#a0a4a6]">v{rs.version}</td>
        </>
      )}
    />
  );
}

/* ─── Detail Modal ─── */
function DetailModal({ type, data, onClose }: { type: string; data: unknown; onClose: () => void }) {
  const item = data as Record<string, unknown>;
  const labels: Record<string, string> = {
    d1: "D1 Database", r2: "R2 Bucket", kv: "KV Namespace", workers: "Worker Script",
    dns: "DNS Record", queues: "Queue", rulesets: "Ruleset",
  };

  const copy = (text: string) => navigator.clipboard.writeText(text);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl border border-[#e0e0e0] w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e0e0e0]">
          <h2 className="text-[15px] font-semibold text-[#1d1f20]">{labels[type] ?? type}</h2>
          <button onClick={onClose} className="p-1 rounded text-[#a0a4a6] hover:text-[#1d1f20] hover:bg-[#f3f4f5]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-80 overflow-y-auto">
          {Object.entries(item).map(([key, value]) => (
            <div key={key} className="flex items-start gap-3">
              <span className="text-[11px] text-[#a0a4a6] uppercase tracking-wider w-28 shrink-0 pt-0.5">{key}</span>
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <span className="font-mono text-[12px] text-[#1d1f20] break-all">
                  {typeof value === "object" ? JSON.stringify(value) : String(value ?? "-")}
                </span>
                {typeof value === "string" && value.length > 8 && (
                  <button onClick={() => copy(String(value))} className="p-0.5 rounded text-[#a0a4a6] hover:text-[#1d1f20] hover:bg-[#f3f4f5] shrink-0" title="Copy">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-[#e0e0e0]">
          <button onClick={onClose} className="w-full py-2 rounded border border-[#e0e0e0] text-[13px] font-medium text-[#6b6f70] hover:bg-[#f3f4f5] transition-colors">
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
