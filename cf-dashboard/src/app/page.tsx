"use client";

import { useEffect, useState } from "react";
import { ResourceCounts } from "@/lib/cloudflare-api";

interface Resources {
  d1: { id: string; name: string; file_size: number; num_tables: number; version: string }[];
  r2: { id: string; name: string; location: string }[];
  kv: { id: string; title: string }[];
  workers: { id: string; name: string; modified_on: string }[];
  dns: { id: string; type: string; name: string; content: string; proxied: boolean }[];
  queues: { id: string; queue_name: string }[];
  rulesets: { id: string; name: string; phase: string; kind: string }[];
  counts: ResourceCounts;
}

const RESOURCE_ICONS: Record<string, string> = {
  d1: "D1",
  r2: "R2",
  kv: "KV",
  workers: "Workers",
  dns: "DNS",
  queues: "Queues",
  rulesets: "Rules",
};

const RESOURCE_COLORS: Record<string, string> = {
  d1: "#f6821f",
  r2: "#fbad41",
  kv: "#f38020",
  workers: "#f6821f",
  dns: "#4040c0",
  queues: "#d946ef",
  rulesets: "#0051c3",
};

export default function Dashboard() {
  const [resources, setResources] = useState<Resources | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");

  useEffect(() => {
    fetch("/api/resources")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setResources(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (!resources) return null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              CF
            </div>
            <h1 className="text-xl font-semibold">CF Dashboard</h1>
          </div>
          <div className="text-sm text-gray-500">
            scaryspiderseo.com
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          {Object.entries(resources.counts).map(([key, count]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`p-4 rounded-lg border transition-colors ${
                activeTab === key
                  ? "border-orange-500 bg-orange-500/10"
                  : "border-gray-800 bg-gray-900/50 hover:border-gray-700"
              }`}
            >
              <div
                className="text-2xl font-bold"
                style={{ color: RESOURCE_COLORS[key] }}
              >
                {count}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {RESOURCE_ICONS[key]}
              </div>
            </button>
          ))}
        </div>

        <div className="border border-gray-800 rounded-lg overflow-hidden">
          {activeTab === "overview" && (
            <OverviewTab resources={resources} />
          )}
          {activeTab === "d1" && <D1Tab databases={resources.d1} />}
          {activeTab === "r2" && <R2Tab buckets={resources.r2} />}
          {activeTab === "kv" && <KVTab namespaces={resources.kv} />}
          {activeTab === "workers" && <WorkersTab scripts={resources.workers} />}
          {activeTab === "dns" && <DNSTab records={resources.dns} />}
          {activeTab === "queues" && <QueuesTab queues={resources.queues} />}
          {activeTab === "rulesets" && <RulesetsTab rulesets={resources.rulesets} />}
        </div>
      </main>
    </div>
  );
}

function OverviewTab({ resources }: { resources: Resources }) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(RESOURCE_ICONS).map(([key, label]) => (
          <div key={key} className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">{label}</span>
              <span className="text-2xl font-bold" style={{ color: RESOURCE_COLORS[key] }}>
                {resources.counts[key as keyof ResourceCounts]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function D1Tab({ databases }: { databases: Resources["d1"] }) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/30">
        <h2 className="font-semibold">D1 Databases</h2>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b border-gray-800">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Tables</th>
            <th className="px-4 py-3">Size</th>
            <th className="px-4 py-3">Version</th>
          </tr>
        </thead>
        <tbody>
          {databases.map((db) => (
            <tr key={db.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
              <td className="px-4 py-3 font-mono text-sm">{db.name}</td>
              <td className="px-4 py-3 text-gray-400">{db.num_tables}</td>
              <td className="px-4 py-3 text-gray-400">{(db.file_size / 1024).toFixed(1)} KB</td>
              <td className="px-4 py-3 text-gray-400">{db.version}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function R2Tab({ buckets }: { buckets: Resources["r2"] }) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/30">
        <h2 className="font-semibold">R2 Buckets</h2>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b border-gray-800">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Location</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
              <td className="px-4 py-3 font-mono text-sm">{bucket.name}</td>
              <td className="px-4 py-3 text-gray-400">{bucket.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KVTab({ namespaces }: { namespaces: Resources["kv"] }) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/30">
        <h2 className="font-semibold">KV Namespaces</h2>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b border-gray-800">
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">ID</th>
          </tr>
        </thead>
        <tbody>
          {namespaces.map((ns) => (
            <tr key={ns.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
              <td className="px-4 py-3 font-mono text-sm">{ns.title}</td>
              <td className="px-4 py-3 text-gray-400 font-mono text-xs">{ns.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkersTab({ scripts }: { scripts: Resources["workers"] }) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/30">
        <h2 className="font-semibold">Workers</h2>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b border-gray-800">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Last Modified</th>
          </tr>
        </thead>
        <tbody>
          {scripts.map((script) => (
            <tr key={script.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
              <td className="px-4 py-3 font-mono text-sm">{script.name}</td>
              <td className="px-4 py-3 text-gray-400">
                {new Date(script.modified_on).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DNSTab({ records }: { records: Resources["dns"] }) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/30">
        <h2 className="font-semibold">DNS Records</h2>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b border-gray-800">
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Content</th>
            <th className="px-4 py-3">Proxied</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-gray-800 text-orange-400">
                  {record.type}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-sm">{record.name}</td>
              <td className="px-4 py-3 text-gray-400 font-mono text-sm truncate max-w-xs">{record.content}</td>
              <td className="px-4 py-3">
                {record.proxied ? (
                  <span className="text-green-400 text-sm">On</span>
                ) : (
                  <span className="text-gray-500 text-sm">Off</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueuesTab({ queues }: { queues: Resources["queues"] }) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/30">
        <h2 className="font-semibold">Queues</h2>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b border-gray-800">
            <th className="px-4 py-3">Name</th>
          </tr>
        </thead>
        <tbody>
          {queues.map((queue) => (
            <tr key={queue.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
              <td className="px-4 py-3 font-mono text-sm">{queue.queue_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RulesetsTab({ rulesets }: { rulesets: Resources["rulesets"] }) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/30">
        <h2 className="font-semibold">Rulesets</h2>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b border-gray-800">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Phase</th>
            <th className="px-4 py-3">Kind</th>
          </tr>
        </thead>
        <tbody>
          {rulesets.map((rs) => (
            <tr key={rs.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
              <td className="px-4 py-3 font-mono text-sm">{rs.name}</td>
              <td className="px-4 py-3 text-gray-400">{rs.phase}</td>
              <td className="px-4 py-3 text-gray-400">{rs.kind}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
