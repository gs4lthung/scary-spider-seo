import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { DemoAuditForm } from "@/components/DemoAuditForm";
import { DEMO_URL, LATEST_RELEASE_URL } from "@/lib/site";

const title = "Free SEO Audit Demo";
const description =
  "Paste any URL and get an instant single-page SEO check: title, meta description, headings, alt text, canonical tags, and more.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: DEMO_URL,
  },
  openGraph: {
    title,
    description,
    url: DEMO_URL,
    type: "website",
  },
};

export default function DemoPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Try a free SEO audit</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Paste a URL below for an instant on-page SEO check. This demo scans a single page. Download the
            desktop app to crawl a whole site and catch broken links, duplicate content, and more.
          </p>
        </div>

        <div className="mt-10">
          <DemoAuditForm />
        </div>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          Want the full crawl?{" "}
          <a href={LATEST_RELEASE_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
            Download Scary Spider SEO ↗
          </a>
        </p>
      </main>
      <Footer />
    </>
  );
}
