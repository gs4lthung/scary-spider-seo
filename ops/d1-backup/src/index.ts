const TABLES = [
  {
    name: "posts",
    columns: [
      "id", "slug", "title", "excerpt", "content", "key_takeaways", "faqs",
      "cover_image_key", "cover_image_alt", "author_id", "category", "meta_title",
      "meta_description", "reading_time", "view_count", "featured", "status",
      "published_at", "created_at", "updated_at",
    ],
  },
  { name: "categories", columns: ["id", "slug", "name"] },
  { name: "settings", columns: ["key", "value"] },
  {
    name: "users",
    columns: [
      "id", "username", "password_hash", "role", "display_name", "avatar_key",
      "job_title", "bio", "website", "email", "github", "twitter", "linkedin",
      "facebook", "created_at",
    ],
  },
  {
    name: "comments",
    columns: [
      "id", "post_id", "parent_id", "user_id", "author_name", "content", "ip_hash",
      "status", "created_at",
    ],
  },
  {
    name: "comment_votes",
    columns: ["id", "comment_id", "voter_key", "value", "created_at"],
  },
  { name: "login_attempts", columns: ["id", "ip_hash", "attempted_at"] },
] as const;

type BackupTable = {
  name: string;
  columns: readonly string[];
  rows: unknown[][];
  rowCount: number;
};

type BackupDocument = {
  formatVersion: 1;
  source: "cloudflare-d1";
  database: string;
  createdAt: string;
  tables: BackupTable[];
};

interface Env {
  DB: D1Database;
  BACKUPS: R2Bucket;
  EMAIL: SendEmail;
  BACKUP_RETENTION_DAYS: string;
  BACKUP_PREFIX: string;
  ALERT_FROM_EMAIL: string;
  ALERT_TO_EMAIL?: string;
}

export default {
  async fetch(): Promise<Response> {
    return new Response("D1 backup Worker", { status: 200 });
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    try {
      const backup = await createBackup(env);
      await storeBackup(env, backup);
      await removeExpiredBackups(env, controller.scheduledTime);
      console.log(JSON.stringify({
        event: "backup_succeeded",
        database: backup.database,
        createdAt: backup.createdAt,
        tables: backup.tables.map((table) => ({ name: table.name, rows: table.rowCount })),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ event: "backup_failed", message }));
      await notifyFailure(env, message);
      throw error;
    }
  },
};

async function createBackup(env: Env): Promise<BackupDocument> {
  const tables: BackupTable[] = [];

  for (const table of TABLES) {
    const columns = table.columns.join(", ");
    const result = await env.DB
      .prepare(`SELECT ${columns} FROM ${table.name}`)
      .all<Record<string, unknown>>();

    tables.push({
      name: table.name,
      columns: table.columns,
      rows: result.results.map((row) => table.columns.map((column) => row[column] ?? null)),
      rowCount: result.results.length,
    });
  }

  return {
    formatVersion: 1,
    source: "cloudflare-d1",
    database: "blog-db",
    createdAt: new Date().toISOString(),
    tables,
  };
}

async function storeBackup(env: Env, backup: BackupDocument): Promise<void> {
  const date = new Date(backup.createdAt);
  const timestamp = date.toISOString().replace(/[:.]/g, "-");
  const key = `${env.BACKUP_PREFIX}blog-db-${timestamp}.json.gz`;
  const body = new Response(JSON.stringify(backup)).body;

  if (!body) {
    throw new Error("Unable to create a backup stream");
  }

  // R2 requires a known content length for compressed request bodies. D1
  // backups are bounded by the site's operational data size, so buffering the
  // compressed payload gives R2 the length it needs.
  const compressedBody = await new Response(
    body.pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();

  await env.BACKUPS.put(key, compressedBody, {
    httpMetadata: {
      contentType: "application/json",
      contentEncoding: "gzip",
      cacheControl: "no-store",
    },
    customMetadata: {
      database: backup.database,
      createdAt: backup.createdAt,
      formatVersion: String(backup.formatVersion),
    },
  });
}

async function removeExpiredBackups(env: Env, scheduledTime: number): Promise<void> {
  const retentionDays = Number.parseInt(env.BACKUP_RETENTION_DAYS, 10);
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new Error("BACKUP_RETENTION_DAYS must be a positive integer");
  }

  const cutoff = scheduledTime - retentionDays * 24 * 60 * 60 * 1000;
  let cursor: string | undefined;

  do {
    const page = await env.BACKUPS.list({ prefix: env.BACKUP_PREFIX, cursor });
    const expired = page.objects
      .filter((object) => object.uploaded.getTime() < cutoff)
      .map((object) => object.key);

    if (expired.length > 0) {
      await env.BACKUPS.delete(expired);
    }

    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

async function notifyFailure(env: Env, message: string): Promise<void> {
  if (!env.ALERT_TO_EMAIL) {
    console.error(JSON.stringify({ event: "backup_alert_not_configured" }));
    return;
  }

  try {
    const occurredAt = new Date().toISOString();
    const safeMessage = escapeHtml(message);
    await env.EMAIL.send({
      to: env.ALERT_TO_EMAIL,
      from: env.ALERT_FROM_EMAIL,
      subject: "Scary Spider SEO D1 backup failed",
      text: [
        "Scary Spider SEO",
        "D1 BACKUP ALERT",
        "",
        "The scheduled production D1 backup failed and needs attention.",
        "",
        `Worker: scary-spider-seo-d1-backup`,
        `Occurred: ${occurredAt}`,
        `Error: ${message}`,
        "",
        "Open Cloudflare Workers to inspect the backup Worker logs.",
      ].join("\n"),
      html: [
        '<!doctype html><html><body style="margin:0;background:#f4f1fb;color:#171326;font-family:Arial,Helvetica,sans-serif;">',
        '<div style="padding:32px 16px;">',
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #ded8ec;border-radius:18px;overflow:hidden;">',
        '<tr><td style="padding:24px 28px 18px;text-align:center;background:#ffffff;">',
        '<img src="https://www.scaryspiderseo.com/logo-wordmark.png" width="220" alt="Scary Spider SEO" style="display:block;width:220px;height:auto;margin:0 auto;border:0;">',
        '</td></tr>',
        '<tr><td style="height:8px;background:#7028d9;font-size:0;line-height:0;">&nbsp;</td></tr>',
        '<tr><td style="padding:32px 32px 12px;">',
        '<p style="margin:0 0 12px;color:#7028d9;font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">D1 backup alert</p>',
        '<h1 style="margin:0;color:#171326;font-size:28px;line-height:1.2;">Backup needs attention</h1>',
        '<p style="margin:14px 0 0;color:#5d566d;font-size:16px;line-height:1.6;">The scheduled production database backup failed. Review the Worker logs and rerun the recovery check when the issue is resolved.</p>',
        '</td></tr>',
        '<tr><td style="padding:12px 32px 24px;">',
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf8ff;border:1px solid #e6def5;border-radius:12px;">',
        '<tr><td style="padding:18px 20px 4px;color:#7a718b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Worker</td></tr>',
        '<tr><td style="padding:0 20px 14px;color:#241d35;font-family:monospace;font-size:14px;">scary-spider-seo-d1-backup</td></tr>',
        '<tr><td style="padding:0 20px 4px;color:#7a718b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Occurred</td></tr>',
        `<tr><td style="padding:0 20px 14px;color:#241d35;font-family:monospace;font-size:14px;">${occurredAt}</td></tr>`,
        '<tr><td style="padding:0 20px 4px;color:#7a718b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Error</td></tr>',
        `<tr><td style="padding:0 20px 20px;color:#b42318;font-family:monospace;font-size:13px;line-height:1.5;word-break:break-word;">${safeMessage}</td></tr>`,
        '</table>',
        '</td></tr>',
        '<tr><td style="padding:0 32px 32px;text-align:center;">',
        '<a href="https://dash.cloudflare.com/" style="display:inline-block;padding:13px 20px;background:#7028d9;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">Open Cloudflare Dashboard</a>',
        '</td></tr>',
        '<tr><td style="padding:18px 32px;background:#171326;color:#c9bfd8;text-align:center;font-size:12px;line-height:1.5;">Scary Spider SEO &middot; Crawl. Index. Rank.</td></tr>',
        '</table>',
        '<p style="max-width:620px;margin:16px auto 0;color:#8a8196;text-align:center;font-size:12px;line-height:1.5;">This is an automated operational alert from the Scary Spider SEO backup service.</p>',
        '</div></body></html>',
      ].join(""),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "backup_alert_failed",
      message: error instanceof Error ? error.message : String(error),
    }));
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
