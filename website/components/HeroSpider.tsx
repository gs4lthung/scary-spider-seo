"use client";

import dynamic from "next/dynamic";
import Image from "next/image";

const SpiderCanvas = dynamic(
  () => import("@/components/spider-3d/SpiderCanvas"),
  {
    ssr: false,
    loading: () => (
      <Image
        src="/mascot.png"
        alt="Scary Spider SEO mascot"
        width={512}
        height={512}
        priority
        className="h-full w-full object-contain"
      />
    ),
  },
);

export function HeroSpider() {
  return (
    <div className="h-full w-full" aria-hidden="true">
      <SpiderCanvas />
    </div>
  );
}
