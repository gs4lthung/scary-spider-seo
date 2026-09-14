import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { TechStack } from "@/components/TechStack";
import { Download } from "@/components/Download";
import { Footer } from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next"
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Features />
        <TechStack />
        <Download />
      </main>
      <Footer />
      <Analytics />
    </>
  );
}
