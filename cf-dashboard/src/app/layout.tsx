import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CF Dashboard",
  description: "Cloudflare resource management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
