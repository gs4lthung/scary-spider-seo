import * as cheerio from "cheerio";
import type { FetchedPage } from "./fetch";

export type CheckStatus = "pass" | "warn" | "fail" | "info";

export interface AuditCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface AuditResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  timeMs: number;
  redirectCount: number;
  checks: AuditCheck[];
}

function textLength(value: string | undefined | null): number {
  return value?.trim().length ?? 0;
}

export function analyzePage(page: FetchedPage): AuditResult {
  const $ = cheerio.load(page.html);
  const checks: AuditCheck[] = [];
  const isHttps = new URL(page.finalUrl).protocol === "https:";

  // Title
  const title = $("title").first().text().trim();
  const titleLen = textLength(title);
  if (!titleLen) {
    checks.push({ id: "title", label: "Page title", status: "fail", detail: "No <title> element found." });
  } else if (titleLen < 30) {
    checks.push({ id: "title", label: "Page title", status: "warn", detail: `Title is only ${titleLen} characters: "${title}". Consider expanding it.` });
  } else if (titleLen > 60) {
    checks.push({ id: "title", label: "Page title", status: "warn", detail: `Title is ${titleLen} characters and may be truncated in search results: "${title}".` });
  } else {
    checks.push({ id: "title", label: "Page title", status: "pass", detail: `"${title}" (${titleLen} characters).` });
  }

  // Meta description
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? "";
  if (!metaDescription) {
    checks.push({ id: "meta-description", label: "Meta description", status: "warn", detail: "No meta description found; Google will auto-generate a snippet instead." });
  } else {
    checks.push({ id: "meta-description", label: "Meta description", status: "pass", detail: `${metaDescription.length} characters.` });
  }

  // H1
  const h1s = $("h1");
  if (h1s.length === 0) {
    checks.push({ id: "h1", label: "H1 heading", status: "info", detail: "No H1 found. Not a ranking factor, but a single H1 helps document structure and screen readers." });
  } else if (h1s.length > 1) {
    checks.push({ id: "h1", label: "H1 heading", status: "info", detail: `${h1s.length} H1 elements found. Google tolerates this, but one clear H1 is better for accessibility.` });
  } else {
    checks.push({ id: "h1", label: "H1 heading", status: "pass", detail: `"${h1s.first().text().trim()}"` });
  }

  // Images missing alt
  const images = $("img");
  const missingAlt = images.filter((_, el) => $(el).attr("alt") === undefined).length;
  if (images.length === 0) {
    checks.push({ id: "img-alt", label: "Image alt text", status: "info", detail: "No <img> tags found on this page." });
  } else if (missingAlt > 0) {
    checks.push({ id: "img-alt", label: "Image alt text", status: "fail", detail: `${missingAlt} of ${images.length} images have no alt attribute.` });
  } else {
    checks.push({ id: "img-alt", label: "Image alt text", status: "pass", detail: `All ${images.length} images have an alt attribute.` });
  }

  // Viewport
  const hasViewport = $('meta[name="viewport"]').length > 0;
  checks.push({
    id: "viewport",
    label: "Mobile viewport tag",
    status: hasViewport ? "pass" : "fail",
    detail: hasViewport ? "Viewport meta tag present." : "No viewport meta tag; mobile browsers will render a shrunk desktop layout.",
  });

  // Lang attribute
  const lang = $("html").attr("lang")?.trim();
  checks.push({
    id: "lang",
    label: "HTML lang attribute",
    status: lang ? "pass" : "fail",
    detail: lang ? `lang="${lang}"` : "No lang attribute on <html>; screen readers can't pick the right pronunciation.",
  });

  // Canonical
  const canonicalTags = $('link[rel="canonical"]');
  if (canonicalTags.length === 0) {
    checks.push({ id: "canonical", label: "Canonical tag", status: "warn", detail: "No canonical tag found." });
  } else if (canonicalTags.length > 1) {
    checks.push({ id: "canonical", label: "Canonical tag", status: "fail", detail: `${canonicalTags.length} canonical tags found; Google may ignore all of them.` });
  } else {
    checks.push({ id: "canonical", label: "Canonical tag", status: "pass", detail: canonicalTags.attr("href") ?? "" });
  }

  // Open Graph / Twitter
  const hasOg = $('meta[property^="og:"]').length > 0;
  const hasTwitter = $('meta[name^="twitter:"]').length > 0;
  checks.push({
    id: "social-tags",
    label: "Open Graph / Twitter tags",
    status: hasOg || hasTwitter ? "pass" : "warn",
    detail: hasOg || hasTwitter ? "Social preview tags found." : "No Open Graph or Twitter Card tags; shared links will show a generic preview.",
  });

  // Structured data
  const hasJsonLd = $('script[type="application/ld+json"]').length > 0;
  checks.push({
    id: "structured-data",
    label: "Structured data (JSON-LD)",
    status: hasJsonLd ? "pass" : "info",
    detail: hasJsonLd ? "JSON-LD script found." : "No JSON-LD structured data found.",
  });

  // Mixed content (http:// resources on an https page)
  if (isHttps) {
    const insecureCount = $('img[src^="http://"], script[src^="http://"], link[href^="http://"]').length;
    checks.push({
      id: "mixed-content",
      label: "Mixed content",
      status: insecureCount > 0 ? "fail" : "pass",
      detail: insecureCount > 0 ? `${insecureCount} insecure (http://) resource references on this https page.` : "No insecure resource references found.",
    });
  }

  // HSTS
  if (isHttps) {
    const hasHsts = Boolean(page.headers["strict-transport-security"]);
    checks.push({
      id: "hsts",
      label: "Strict-Transport-Security header",
      status: hasHsts ? "pass" : "warn",
      detail: hasHsts ? "HSTS header present." : "No Strict-Transport-Security header on the response.",
    });
  }

  // Response time
  checks.push({
    id: "response-time",
    label: "Server response time",
    status: page.timeMs < 800 ? "pass" : "warn",
    detail: `${page.timeMs}ms${page.redirectCount ? ` across ${page.redirectCount} redirect(s)` : ""}.`,
  });

  return {
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    status: page.status,
    timeMs: page.timeMs,
    redirectCount: page.redirectCount,
    checks,
  };
}
