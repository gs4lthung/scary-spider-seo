const SITES = [
  { name: "Marketing website", url: "https://www.scaryspiderseo.com/healthz" },
  { name: "Blog", url: "https://blog.scaryspiderseo.com/healthz" },
] as const;

type SiteStatus = "up" | "down";

type StoredState = {
  status: SiteStatus;
  checkedAt: string;
  error?: string;
};

interface Env {
  EMAIL: SendEmail;
  MONITOR_STATE: KVNamespace;
  ALERT_FROM_EMAIL: string;
  ALERT_TO_EMAIL?: string;
}

export default {
  async fetch(): Promise<Response> {
    return Response.json({ status: "ok", service: "site-monitor" });
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await Promise.all(SITES.map((site) => checkSite(site, env)));
  },
};

async function checkSite(site: (typeof SITES)[number], env: Env): Promise<void> {
  const checkedAt = new Date().toISOString();
  const previous = await env.MONITOR_STATE.get<StoredState>(stateKey(site.name), "json");
  const current = await getSiteStatus(site);

  if (current.status !== previous?.status) {
    await sendStatusEmail(env, site, current, checkedAt);
  }

  await env.MONITOR_STATE.put(
    stateKey(site.name),
    JSON.stringify({ ...current, checkedAt }),
  );

  console.log(JSON.stringify({
    event: "site_check",
    site: site.name,
    status: current.status,
    checkedAt,
    error: current.error,
  }));
}

async function getSiteStatus(site: (typeof SITES)[number]): Promise<Omit<StoredState, "checkedAt">> {
  try {
    const response = await fetch(site.url, {
      headers: { "User-Agent": "ScarySpiderSEO-Monitor/1.0" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { status: "down", error: `HTTP ${response.status}` };
    }

    const body: unknown = await response.json();
    if (!isHealthyResponse(body)) {
      return { status: "down", error: "Invalid health response" };
    }

    return { status: "up" };
  } catch (error) {
    return {
      status: "down",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function isHealthyResponse(value: unknown): value is { status: "ok" } {
  return typeof value === "object" && value !== null && "status" in value && value.status === "ok";
}

async function sendStatusEmail(
  env: Env,
  site: (typeof SITES)[number],
  current: Omit<StoredState, "checkedAt">,
  checkedAt: string,
): Promise<void> {
  if (!env.ALERT_TO_EMAIL) {
    console.error(JSON.stringify({ event: "monitor_alert_not_configured", site: site.name }));
    return;
  }

  const recovered = current.status === "up";
  const subject = recovered
    ? `Recovered: ${site.name} is back online`
    : `Alert: ${site.name} is unavailable`;
  const summary = recovered
    ? `${site.name} is responding normally again.`
    : `${site.name} failed its health check.`;
  const detail = current.error ? `Error: ${current.error}` : "The health check is passing.";

  await env.EMAIL.send({
    to: env.ALERT_TO_EMAIL,
    from: { email: env.ALERT_FROM_EMAIL, name: "Scary Spider SEO" },
    subject: `Scary Spider SEO: ${subject}`,
    text: [
      "Scary Spider SEO operations",
      "",
      summary,
      `Site: ${site.name}`,
      `URL: ${site.url}`,
      `Checked: ${checkedAt}`,
      detail,
    ].join("\n"),
    html: buildEmail({ site, subject, summary, detail, checkedAt, recovered }),
  });
}

function buildEmail({
  site,
  subject,
  summary,
  detail,
  checkedAt,
  recovered,
}: {
  site: (typeof SITES)[number];
  subject: string;
  summary: string;
  detail: string;
  checkedAt: string;
  recovered: boolean;
}): string {
  const accent = recovered ? "#16803c" : "#b42318";
  return `<!doctype html><html><body style="margin:0;background:#f4f1fb;color:#171326;font-family:Arial,Helvetica,sans-serif;"><div style="padding:32px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #ded8ec;border-radius:18px;overflow:hidden;"><tr><td style="padding:24px 28px 18px;text-align:center;"><img src="https://blog.scaryspiderseo.com/mascot.png" width="88" height="88" alt="Scary Spider SEO mascot" style="display:block;width:88px;height:88px;margin:0 auto;border:0;"></td></tr><tr><td style="height:8px;background:#7028d9;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td style="padding:32px 32px 12px;"><p style="margin:0 0 12px;color:${accent};font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">${recovered ? "Recovery" : "Operations alert"}</p><h1 style="margin:0;color:#171326;font-size:28px;line-height:1.2;">${escapeHtml(subject)}</h1><p style="margin:14px 0 0;color:#5d566d;font-size:16px;line-height:1.6;">${escapeHtml(summary)}</p></td></tr><tr><td style="padding:12px 32px 32px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf8ff;border:1px solid #e6def5;border-radius:12px;"><tr><td style="padding:18px 20px 4px;color:#7a718b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Site</td></tr><tr><td style="padding:0 20px 14px;color:#241d35;font-size:14px;">${escapeHtml(site.name)}</td></tr><tr><td style="padding:0 20px 4px;color:#7a718b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Checked</td></tr><tr><td style="padding:0 20px 14px;color:#241d35;font-family:monospace;font-size:14px;">${escapeHtml(checkedAt)}</td></tr><tr><td style="padding:0 20px 4px;color:#7a718b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Detail</td></tr><tr><td style="padding:0 20px 20px;color:${accent};font-family:monospace;font-size:13px;line-height:1.5;word-break:break-word;">${escapeHtml(detail)}</td></tr></table></td></tr><tr><td style="padding:18px 32px;background:#171326;color:#c9bfd8;text-align:center;font-size:12px;line-height:1.5;">Scary Spider SEO &middot; Crawl. Index. Rank.</td></tr></table></div></body></html>`;
}

function stateKey(siteName: string): string {
  return `site:${siteName.toLowerCase().replaceAll(" ", "-")}`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
