type CommentNotification = {
  version: 1;
  type: "comment.created";
  eventId: string;
  commentId: number;
  postId: number;
  postSlug: string;
  authorName: string;
  contentPreview: string;
};

interface Env {
  EMAIL: SendEmail;
  COMMENT_NOTIFICATION_STATE: KVNamespace;
  ALERT_FROM_EMAIL: string;
  ALERT_TO_EMAIL: string;
}

export default {
  async fetch(): Promise<Response> {
    return Response.json({ status: "ok", service: "comment-notifications" });
  },

  async queue(batch: MessageBatch<CommentNotification>, env: Env): Promise<void> {
    if (!env.ALERT_TO_EMAIL) {
      throw new Error("ALERT_TO_EMAIL is not configured");
    }

    for (const message of batch.messages) {
      const event = validateMessage(message.body);
      const processedKey = `processed:${event.eventId}`;
      if (await env.COMMENT_NOTIFICATION_STATE.get(processedKey)) {
        console.log(JSON.stringify({ event: "comment_notification_duplicate", eventId: event.eventId }));
        continue;
      }

      await sendNotification(env, event);
      await env.COMMENT_NOTIFICATION_STATE.put(processedKey, new Date().toISOString(), {
        expirationTtl: 90 * 24 * 60 * 60,
      });
      console.log(JSON.stringify({ event: "comment_notification_sent", eventId: event.eventId }));
    }
  },
};

function validateMessage(value: CommentNotification): CommentNotification {
  if (
    value?.version !== 1 ||
    value.type !== "comment.created" ||
    typeof value.eventId !== "string" ||
    !Number.isInteger(value.commentId) ||
    !Number.isInteger(value.postId) ||
    typeof value.postSlug !== "string" ||
    typeof value.authorName !== "string" ||
    typeof value.contentPreview !== "string"
  ) {
    throw new Error("Invalid comment notification message");
  }
  return value;
}

async function sendNotification(env: Env, event: CommentNotification): Promise<void> {
  const postUrl = `https://blog.scaryspiderseo.com/${encodeURIComponent(event.postSlug)}`;
  await env.EMAIL.send({
    to: env.ALERT_TO_EMAIL,
    from: { email: env.ALERT_FROM_EMAIL, name: "Scary Spider SEO" },
    subject: `New comment on ${event.postSlug}`,
    text: [
      "A new comment was submitted to Scary Spider SEO Blog.",
      "",
      `Author: ${event.authorName}`,
      `Post: ${event.postSlug}`,
      `Comment ID: ${event.commentId}`,
      `Preview: ${event.contentPreview}`,
      "",
      `Open post: ${postUrl}`,
    ].join("\n"),
    html: buildHtml(event, postUrl),
  });
}

function buildHtml(event: CommentNotification, postUrl: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f1fb;color:#171326;font-family:Arial,Helvetica,sans-serif;"><div style="padding:32px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #ded8ec;border-radius:18px;overflow:hidden;"><tr><td style="padding:24px 28px 18px;text-align:center;"><img src="https://blog.scaryspiderseo.com/mascot.png" width="88" height="88" alt="Scary Spider SEO mascot" style="display:block;width:88px;height:88px;margin:0 auto;border:0;"></td></tr><tr><td style="height:8px;background:#7028d9;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td style="padding:32px 32px 12px;"><p style="margin:0 0 12px;color:#7028d9;font-size:12px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Comment moderation</p><h1 style="margin:0;color:#171326;font-size:28px;line-height:1.2;">New comment submitted</h1><p style="margin:14px 0 0;color:#5d566d;font-size:16px;line-height:1.6;">A reader left a new comment on your blog.</p></td></tr><tr><td style="padding:12px 32px 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf8ff;border:1px solid #e6def5;border-radius:12px;"><tr><td style="padding:18px 20px 4px;color:#7a718b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Author</td></tr><tr><td style="padding:0 20px 14px;color:#241d35;font-size:14px;">${escapeHtml(event.authorName)}</td></tr><tr><td style="padding:0 20px 4px;color:#7a718b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Post</td></tr><tr><td style="padding:0 20px 14px;color:#241d35;font-size:14px;">${escapeHtml(event.postSlug)}</td></tr><tr><td style="padding:0 20px 4px;color:#7a718b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Preview</td></tr><tr><td style="padding:0 20px 20px;color:#241d35;font-size:14px;line-height:1.6;">${escapeHtml(event.contentPreview)}</td></tr></table></td></tr><tr><td style="padding:0 32px 32px;text-align:center;"><a href="${escapeHtml(postUrl)}" style="display:inline-block;padding:13px 20px;background:#7028d9;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">Open post</a></td></tr><tr><td style="padding:18px 32px;background:#171326;color:#c9bfd8;text-align:center;font-size:12px;line-height:1.5;">Scary Spider SEO &middot; Crawl. Index. Rank.</td></tr></table></div></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
