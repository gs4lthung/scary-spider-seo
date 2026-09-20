import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { REPO_URL, RELEASES_URL, SITE_URL } from "@/lib/site";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const title = "Scary Spider SEO: Desktop Site Crawler & SEO Auditor";
const shortTitle = "Scary Spider SEO";
const description =
  "Crawl any site and get a sortable table of every page. SEO and accessibility issues are flagged inline. Free desktop app for Windows, macOS, and Linux.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    template: `%s: ${shortTitle}`,
  },
  description,
  keywords: [
    "SEO auditor",
    "site crawler",
    "desktop SEO tool",
    "free SEO crawler",
    "accessibility audit",
    "broken link checker",
    "sitemap crawler",
    "SEO checker Windows",
    "SEO checker Mac",
    "Tauri app",
  ],
  authors: [{ name: shortTitle }],
  alternates: {
    canonical: "/",
  },
  verification: {
    google: "hxLezdTHHzh_1mLRs2HE7bAzZ-s5-7vUZga9x7vzkPk",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: shortTitle,
    images: [
      {
        url: "/og-banner.png",
        width: 2000,
        height: 500,
        alt: shortTitle,
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-banner.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#171522" },
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: shortTitle,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Windows, macOS, Linux",
  description,
  url: SITE_URL,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  downloadUrl: RELEASES_URL,
  softwareHelp: REPO_URL,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
