import type { Metadata } from "next";
import Image from "next/image";
import { CornerWeb } from "@/components/CornerWeb";

export const metadata: Metadata = {
  title: "Down for maintenance",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      <CornerWeb
        corner="top-left"
        size={280}
        className="text-(--color-ink) opacity-[0.16]"
      />
      <CornerWeb
        corner="bottom-right"
        size={280}
        className="text-(--color-ink) opacity-[0.16]"
      />
      <Image
        src="/mascot.png"
        alt=""
        width={140}
        height={140}
        className="mb-6"
      />
      <p className="text-sm font-bold tracking-widest text-primary uppercase">
        Maintenance
      </p>
      <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
        Spinning some new web.
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        We&apos;re doing planned maintenance. This won&apos;t take long, so
        check back in a few minutes.
      </p>
    </main>
  );
}
