import type { NextConfig } from "next";
import path from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;
