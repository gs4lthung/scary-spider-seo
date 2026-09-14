import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const title = "Scary Spider SEO — Desktop Site Crawler & SEO Auditor";
const shortTitle = "Scary Spider SEO";
const description =
  "Crawl any site and get a sortable table of every page — SEO and accessibility issues flagged inline. Free desktop app for Windows, macOS, and Linux.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    template: `%s — ${shortTitle}`,
  },
  description,
  keywords: [
    "SEO auditor",
    "site crawler",
    "desktop SEO tool",
    "accessibility audit",
    "broken link checker",
    "Tauri app",
  ],
  authors: [{ name: shortTitle }],
  alternates: {
    canonical: "/",
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
      { url: "/favicon-128.png", sizes: "128x128", type: "image/png" },
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
        url: "/og-image.png",
        width: 1200,
        height: 630,
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
    images: ["/og-image.png"],
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
  downloadUrl: "https://github.com/gs4lthung/gseo/releases",
  softwareHelp: "https://github.com/gs4lthung/gseo",
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
