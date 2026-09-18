"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, ShieldCheck, ArrowRight, Quote, TrendingUp, Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Testimonial {
  id: string;
  name: string;
  role: string;
  previousCompany: string;
  newCompany: string;
  offerMetric: string;
  timeframe: string;
  quote: string;
  avatarInitials: string;
  badge: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: "1",
    name: "Alexandre Moreau",
    role: "Staff Infrastructure Engineer",
    previousCompany: "Series B FinTech",
    newCompany: "Stripe",
    offerMetric: "+$110,000 Base & Equity",
    timeframe: "11 days from radar alert",
    quote: "Standard job boards are full of ghost listings and expired forms. BrowserPilot's continuous radar caught an unlisted systems opening at Stripe at 8:15 AM. I applied within 4 minutes, and had a recruiter call by noon. It paid for itself 1,000x over.",
    avatarInitials: "AM",
    badge: "Verified Staff IC Placement"
  },
  {
    id: "2",
    name: "Priya Venkatesh",
    role: "Director of Product Engineering",
    previousCompany: "Mid-Market SaaS",
    newCompany: "Datadog",
    offerMetric: "L7 Leadership Offer",
    timeframe: "Bypassed 300+ public applicants",
    quote: "Executive job hunting requires absolute discretion. BrowserPilot let me monitor covert engineering team expansions without leaking my intent. The DeepReach recruiter dossiers gave me direct contact with the VP of Engineering with verified deliverability.",
    avatarInitials: "PV",
    badge: "Verified Executive Search"
  },
  {
    id: "3",
    name: "Kaelen Chen",
    role: "Backend Engineer (Distributed Systems)",
    previousCompany: "Bootcamp Graduate",
    newCompany: "Cloudflare",
    offerMetric: "First Tech Role ($165k)",
    timeframe: "Applied 45s after ATS publish",
    quote: "For entry and mid-level roles, applying after 2 hours means your resume is buried under 1,000 other submissions. With BrowserPilot, I was applicant #3 on a brand new Ashby requisition. That speed is the only reason I got an interview in this market.",
    avatarInitials: "KC",
    badge: "First-Wave Early Applicant"
  }
];

export function TestimonialStage() {
  const [selectedIdx, setSelectedIdx] = useState(0);

  return (
    <section className="py-20 lg:py-28 bg-[#f8f9fb] border-b border-[#d4e0ed]/60 relative overflow-hidden">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        {/* Metric Counter Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-16">
          {[
            { value: "24,000+", label: "Autonomous Radars Active" },
            { value: "90s", label: "Average Requisition Discovery" },
            { value: "+$42,000", label: "Average Compensation Lift" },
            { value: "0", label: "Ghost Postings Allowed" }
          ].map((stat, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white border border-[#d4e0ed] shadow-marble-1 text-center space-y-1"
            >
              <div className="text-2xl sm:text-3xl font-extrabold text-[#006bff] tracking-tight">
                {stat.value}
              </div>
              <div className="text-xs font-semibold text-[#476788]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0b3558] tracking-tight">
            Loved by top builders. Backed by verifiable offers.
          </h2>
          <p className="text-base sm:text-lg text-[#476788] leading-relaxed">
            See how software engineers, tech leads, and engineering directors transformed their job search with autonomous opportunity radar.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-[#d4e0ed] bg-white p-6 sm:p-7 shadow-marble-2 flex flex-col justify-between space-y-6 hover:shadow-marble-3 transition-all hover:-translate-y-1"
            >
              {/* Card Top: Rating + Verification Badge */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {t.badge}
                  </span>
                </div>

                {/* Quote Text */}
                <p className="text-sm text-[#0b3558] leading-relaxed font-normal">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              {/* Card Bottom: Candidate Profile + Transition Telemetry */}
              <div className="pt-4 border-t border-[#d4e0ed] space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#0b3558] text-white flex items-center justify-center font-bold text-sm">
                    {t.avatarInitials}
                  </div>
                  <div>
                    <div className="font-bold text-[#0b3558] text-sm">{t.name}</div>
                    <div className="text-xs text-[#476788]">{t.role}</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#f8f9fb] border border-[#d4e0ed] text-xs flex items-center justify-between font-mono">
                  <span className="text-[#476788]">{t.previousCompany} → <strong className="text-[#0b3558]">{t.newCompany}</strong></span>
                  <span className="font-bold text-emerald-700">{t.offerMetric}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
