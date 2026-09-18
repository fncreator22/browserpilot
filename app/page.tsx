import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import {
  LandingNavbar,
  HeroSection,
  CaveStage,
  TrustLogoStrip,
  SolutionsCarousel,
  InteractiveCapabilitiesSection,
  SolutionsShowcase,
  TestimonialStage,
  IntegrationsGrid,
  PricingOverviewSection,
  BottomSignupStage,
  DarkFooter,
  ScrollComparisonSection,
} from "@/components/landing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "BrowserPilot: Autonomous Opportunity Discovery Platform",
  description: "Continuous background scrapers monitor official Greenhouse, Ashby, Lever, and Workday portals 24/7. Instant verified match scoring, zero ghost jobs, and direct recruiter reach.",
};

export default async function RootPage() {
  const session = await getServerSession(authOptions).catch(() => null);
  const isLoggedIn = !!session?.user;
  const userEmail = session?.user?.email || null;

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-[#0b3558] selection:bg-[#006bff]/20 selection:text-[#006bff]">
      {/* Sticky 64px Navigation */}
      <LandingNavbar isLoggedIn={isLoggedIn} />

      {/* Main Marketing Landing Page */}
      <main className="space-y-0">
        {/* 1. Hero Section (Headline, Subhead, Inline Email / Google Auth & Live Telemetry) */}
        <HeroSection isLoggedIn={isLoggedIn} userEmail={userEmail} />

        {/* 2. Centerpiece 3D Cave Stage with Concentric Radar Rings & Mouse-Tilt 3D Switcher */}
        <CaveStage />

        {/* 3. Trust Logo Strip (Full-Width Monochrome ATS Logos) */}
        <TrustLogoStrip />

        {/* 4. Persona Solutions Carousel ("See how candidates use BrowserPilot") */}
        <SolutionsCarousel />

        {/* 5. Interactive Capabilities Section (3-Pillar Accordion + Live 3D Viewport) */}
        <InteractiveCapabilitiesSection />

        {/* 6. Scroll-Linked Interactive Comparison Matrix (Animation Stack, Pinning & Parallax) */}
        <ScrollComparisonSection />

        {/* 7. Alternating Two-Column Story Showcase */}
        <SolutionsShowcase />

        {/* 7. Testimonials & Verified Candidate Offer Metrics */}
        <TestimonialStage />

        {/* 8. ATS & Developer Ecosystem Grid */}
        <IntegrationsGrid />

        {/* 9. 3-Tier Pricing & Quota Comparison Matrix */}
        <PricingOverviewSection />

        {/* 10. High-Conversion Bottom Email & Google Signup Stage */}
        <BottomSignupStage isLoggedIn={isLoggedIn} userEmail={userEmail} />
      </main>

      {/* 11. Deep Dark Navy Site Footer with Real-time Telemetry */}
      <DarkFooter />
    </div>
  );
}
