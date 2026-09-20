import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Features } from "@/components/Features";
import { TechStack } from "@/components/TechStack";
import { Download } from "@/components/Download";
import { FAQ } from "@/components/FAQ";
import { Sponsor } from "@/components/Sponsor";
import { Footer } from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <TechStack />
      <Download />
      <FAQ />
      <Sponsor />
      </main>
      <Footer />
      <Analytics />
      <SpeedInsights />
    </>
  );
}
