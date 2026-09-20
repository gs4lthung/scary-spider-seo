const required = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "ALERT_TO_EMAIL",
  "GITHUB_REPOSITORY",
  "GITHUB_RUN_ID",
  "GITHUB_WORKFLOW",
  "GITHUB_REF_NAME",
  "GITHUB_SHA",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing ${name}`);
  }
}

const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const shortSha = process.env.GITHUB_SHA.slice(0, 7);
const subject = `Scary Spider SEO workflow failed: ${process.env.GITHUB_WORKFLOW}`;
const text = [
  "Scary Spider SEO operational alert",
  "",
  `Workflow: ${process.env.GITHUB_WORKFLOW}`,
  `Branch: ${process.env.GITHUB_REF_NAME}`,
  `Commit: ${shortSha}`,
  `Run: ${runUrl}`,
  "",
  "Open the workflow run to inspect the failed job and logs.",
].join("\n");

const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: process.env.ALERT_TO_EMAIL,
      from: {
        address: "alerts@blog.scaryspiderseo.com",
        name: "Scary Spider SEO",
      },
      subject,
      text,
      html: buildHtml({
        subject,
        workflow: process.env.GITHUB_WORKFLOW,
        branch: process.env.GITHUB_REF_NAME,
        commit: shortSha,
        runUrl,
      }),
    }),
  },
);

const result = await response.json();
if (!response.ok || result.success !== true) {
  throw new Error(`Cloudflare Email Sending failed: ${JSON.stringify(result)}`);
}

console.log(`Sent workflow failure alert for ${process.env.GITHUB_WORKFLOW}`);

function buildHtml({ subject, workflow, branch, commit, runUrl }) {
  return `<!doctype html>
<html><body style="margin:0;background:#f4f1fb;color:#171326;font-family:Arial,Helvetica,sans-serif;">
  <div style="padding:32px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #ded8ec;border-radius:18px;overflow:hidden;">
      <tr><td style="padding:24px 28px 18px;text-align:center;"><img src="https://blog.scaryspiderseo.com/mascot.png" width="88" height="88" alt="Scary Spider SEO mascot" style="display:block;width:88px;height:88px;margin:0 auto;border:0;"></td></tr>
      <tr><td style="height:8px;background:#7028d9;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:32px 32px 12px;"><p style="margin:0 0 12px;color:#b42318;font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Operations alert</p><h1 style="margin:0;color:#171326;font-size:28px;line-height:1.2;">Workflow failed</h1><p style="margin:14px 0 0;color:#5d566d;font-size:16px;line-height:1.6;">${escapeHtml(subject)}</p></td></tr>
      <tr><td style="padding:12px 32px 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf8ff;border:1px solid #e6def5;border-radius:12px;"><tr><td style="padding:18px 20px 4px;color:#7a718b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Workflow</td></tr><tr><td style="padding:0 20px 14px;color:#241d35;font-family:monospace;font-size:14px;">${escapeHtml(workflow)}</td></tr><tr><td style="padding:0 20px 4px;color:#7a718b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Branch and commit</td></tr><tr><td style="padding:0 20px 20px;color:#241d35;font-family:monospace;font-size:14px;">${escapeHtml(branch)} / ${escapeHtml(commit)}</td></tr></table></td></tr>
      <tr><td style="padding:0 32px 32px;text-align:center;"><a href="${escapeAttribute(runUrl)}" style="display:inline-block;padding:13px 20px;background:#7028d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">Open workflow run</a></td></tr>
      <tr><td style="padding:18px 32px;background:#171326;color:#c9bfd8;text-align:center;font-size:12px;line-height:1.5;">Scary Spider SEO &middot; Crawl. Index. Rank.</td></tr>
    </table>
  </div>
</body></html>`;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
