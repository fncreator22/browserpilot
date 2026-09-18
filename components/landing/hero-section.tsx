"use client";

import Link from "next/link";
import { 
  Sparkles, 
  Radio, 
  ShieldCheck, 
  CheckCircle2, 
  Building2, 
  Zap,
  MapPin,
  DollarSign
} from "lucide-react";
import { HeroAuthForm } from "./hero-auth-form";

interface HeroSectionProps {
  isLoggedIn?: boolean;
  userEmail?: string | null;
}

export function HeroSection({ isLoggedIn = false, userEmail }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden pt-14 pb-12 lg:pt-24 lg:pb-16 text-center">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#006bff]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-[1000px] px-6 lg:px-8 space-y-6">
        {/* Display Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-[76px] font-bold text-[#0b3558] tracking-tight leading-[1.08] max-w-4xl mx-auto">
          Never search for a job again.{" "}
          <span className="text-[#006bff]">Let autonomous radar find it.</span>
        </h1>

        {/* Subheading */}
        <p className="text-lg sm:text-xl text-[#476788] leading-relaxed max-w-2xl mx-auto font-normal">
          Continuous background scrapers monitor official Greenhouse, Ashby, Lever, and Workday portals 24/7. Instant verified match scoring, zero ghost jobs, and direct recruiter reach.
        </p>

        {/* Centered Inline Email & Google Auth Cluster */}
        <div className="pt-3 flex justify-center">
          <HeroAuthForm isLoggedIn={isLoggedIn} userEmail={userEmail} align="center" />
        </div>

        {/* Centered Trust Telemetry */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-[#476788] pt-3">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#006bff]" />
            99.98% Verification Uptime
          </span>
          <span className="text-[#d4e0ed]">•</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#006bff]" />
            Zero Aggregated Stale Postings
          </span>
          <span className="text-[#d4e0ed]">•</span>
          <span>15,000+ Direct ATS Portals</span>
        </div>
      </div>
    </section>
  );
}
