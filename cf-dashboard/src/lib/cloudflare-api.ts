const CF_API_BASE = "https://api.cloudflare.com/client/v4";

function getToken(): string {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN not set");
  return token;
}

function getAccountId(): string {
  const id = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!id) throw new Error("CLOUDFLARE_ACCOUNT_ID not set");
  return id;
}

function getZoneId(): string {
  const id = process.env.CLOUDFLARE_ZONE_ID;
  if (!id) throw new Error("CLOUDFLARE_ZONE_ID not set");
  return id;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cfFetch<T>(path: string): Promise<any> {
  const res = await fetch(`${CF_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
  });
  const json = (await res.json()) as {
    success: boolean;
    errors: { code: number; message: string }[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any;
  };
  if (!json.success) {
    throw new Error(json.errors.map((e) => e.message).join(", "));
  }
  return json.result;
}

export interface D1Database {
  id: string;
  name: string;
  created_on: string;
  file_size: number;
  num_tables: number;
  version: string;
}

export interface R2Bucket {
  id: string;
  name: string;
  location: string;
  created_on: string;
}

export interface KVNamespace {
  id: string;
  title: string;
  supports_url_encoding: boolean;
}

export interface WorkerScript {
  id: string;
  name: string;
  modified_on: string;
  created_on: string;
}

export interface DNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
}

export interface Queue {
  id: string;
  queue_name: string;
  created_on: string;
}

export interface Ruleset {
  id: string;
  name: string;
  description: string;
  kind: string;
  phase: string;
  version: string;
}

export interface ResourceCounts {
  d1: number;
  r2: number;
  kv: number;
  workers: number;
  dns: number;
  queues: number;
  rulesets: number;
}

export async function getD1Databases(): Promise<D1Database[]> {
  const accountId = getAccountId();
  const result = await cfFetch(`/accounts/${accountId}/d1/database`);
  return Array.isArray(result) ? result : [];
}

export async function getR2Buckets(): Promise<R2Bucket[]> {
  const accountId = getAccountId();
  const result = await cfFetch(`/accounts/${accountId}/r2/buckets`);
  if (result?.buckets) return result.buckets;
  return Array.isArray(result) ? result : [];
}

export async function getKVNamespaces(): Promise<KVNamespace[]> {
  const accountId = getAccountId();
  const result = await cfFetch(`/accounts/${accountId}/storage/kv/namespaces`);
  return Array.isArray(result) ? result : [];
}

export async function getWorkerScripts(): Promise<WorkerScript[]> {
  const accountId = getAccountId();
  const result = await cfFetch(`/accounts/${accountId}/workers/scripts`);
  return Array.isArray(result) ? result : [];
}

export async function getDNSRecords(): Promise<DNSRecord[]> {
  const zoneId = getZoneId();
  const result = await cfFetch(`/zones/${zoneId}/dns_records`);
  return Array.isArray(result) ? result : [];
}

export async function getQueues(): Promise<Queue[]> {
  const accountId = getAccountId();
  const result = await cfFetch(`/accounts/${accountId}/queues/v2`);
  return Array.isArray(result) ? result : [];
}

export async function getRulesets(): Promise<Ruleset[]> {
  const zoneId = getZoneId();
  const result = await cfFetch(`/zones/${zoneId}/rulesets`);
  return Array.isArray(result) ? result : [];
}

export async function getAllResources() {
  const [d1, r2, kv, workers, dns, queues, rulesets] = await Promise.all([
    getD1Databases().catch(() => [] as D1Database[]),
    getR2Buckets().catch(() => [] as R2Bucket[]),
    getKVNamespaces().catch(() => [] as KVNamespace[]),
    getWorkerScripts().catch(() => [] as WorkerScript[]),
    getDNSRecords().catch(() => [] as DNSRecord[]),
    getQueues().catch(() => [] as Queue[]),
    getRulesets().catch(() => [] as Ruleset[]),
  ]);

  return {
    d1: d1 ?? [],
    r2: r2 ?? [],
    kv: kv ?? [],
    workers: workers ?? [],
    dns: dns ?? [],
    queues: queues ?? [],
    rulesets: rulesets ?? [],
    counts: {
      d1: (d1 ?? []).length,
      r2: (r2 ?? []).length,
      kv: (kv ?? []).length,
      workers: (workers ?? []).length,
      dns: (dns ?? []).length,
      queues: (queues ?? []).length,
      rulesets: (rulesets ?? []).length,
    } as ResourceCounts,
  };
}
