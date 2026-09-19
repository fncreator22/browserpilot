"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Radio, 
  Zap, 
  Users, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  ChevronRight,
  Clock,
  Terminal,
  FileCheck,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CapabilityItem {
  id: string;
  stepNumber: string;
  title: string;
  shortDesc: string;
  badge: string;
  icon: typeof Radio;
  metrics: { label: string; value: string };
  previewDetails: {
    heading: string;
    subheading: string;
    items: { label: string; value: string; badge?: string }[];
    telemetryText: string;
  };
}

const CAPABILITIES: CapabilityItem[] = [
  {
    id: "radar",
    stepNumber: "01",
    title: "Continuous 24/7 Autonomous Radar",
    shortDesc: "Never manually browse another job board. Our autonomous agents query enterprise ATS endpoints around the clock, discovering openings the second they go live.",
    badge: "Always-On",
    icon: Radio,
    metrics: { label: "Scan Frequency", value: "Every 60s" },
    previewDetails: {
      heading: "Active ATS Discovery Pipeline",
      subheading: "Live HTTP 200 Stream across 15,000+ Career Portals",
      items: [
        { label: "Stripe", value: "Staff Infrastructure Engineer", badge: "Greenhouse • Just now" },
        { label: "Anthropic", value: "Systems Research Lead", badge: "Ashby • 1m ago" },
        { label: "Scale AI", value: "Senior Distributed Systems", badge: "Lever • 3m ago" },
        { label: "Datadog", value: "L5 Cloud Platform Engineer", badge: "Workday • 6m ago" }
      ],
      telemetryText: "Zero rate-limiting • Automatic TLS fingerprint rotation active"
    }
  },
  {
    id: "fit-engine",
    stepNumber: "02",
    title: "100-Point Deterministic Fit Scoring",
    shortDesc: "Forget keyword stuffing. Our deterministic reasoning model maps your resume, GitHub commits, and architecture preferences to 10 distinct job vectors.",
    badge: "Vector Analysis",
    icon: Zap,
    metrics: { label: "Scoring Accuracy", value: "99.4%" },
    previewDetails: {
      heading: "Match Vector Decomposition",
      subheading: "Target: Senior Distributed Systems at Cloudflare",
      items: [
        { label: "Distributed Architecture (Go/Rust/Raft)", value: "98/100 Match", badge: "Verified" },
        { label: "High-Throughput Networking & eBPF", value: "94/100 Match", badge: "Verified" },
        { label: "Compensation Bracket ($260k - $340k)", value: "100/100 Match", badge: "In Range" },
        { label: "Workplace Preference (Remote / US-West)", value: "100/100 Match", badge: "Compatible" }
      ],
      telemetryText: "Full 100-point composite score: 98/100 (Top 1% Candidate Pool)"
    }
  },
  {
    id: "deepreach",
    stepNumber: "03",
    title: "DeepReach Recruiter & Decision-Maker Intelligence",
    shortDesc: "Don't send your resume into an applicant black hole. Discover the exact engineering managers, directors, and recruiters actively staffing each role.",
    badge: "Direct Contact",
    icon: Users,
    metrics: { label: "Response Rate", value: "4.2x Industry Avg" },
    previewDetails: {
      heading: "Hiring Team Intelligence Dossier",
      subheading: "Target Role: Staff Infrastructure at OpenAI",
      items: [
        { label: "Engineering Director", value: "Elena Rostova • Infrastructure", badge: "Hiring Manager" },
        { label: "Verified Direct Email", value: "e.rostova@openai.com", badge: "DNS Validated" },
        { label: "Lead Tech Recruiter", value: "Marcus Vance • AI Infra", badge: "Active Now" },
        { label: "Recommended Pitch Angle", value: "Highlight distributed consensus & GPU orchestration", badge: "AI Tailored" }
      ],
      telemetryText: "Direct outreach queue primed • Personalized pitch generated"
    }
  }
];

export function InteractiveCapabilitiesSection() {
  const [activeTab, setActiveTab] = useState<string>("radar");
  const activeCapability = CAPABILITIES.find((c) => c.id === activeTab) || CAPABILITIES[0];
  const ActiveIcon = activeCapability.icon;

  return (
    <section className="py-20 lg:py-28 bg-white border-b border-[#d4e0ed]/60">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0b3558] tracking-tight">
            Designed to outperform manual job search in every dimension.
          </h2>
          <p className="text-base sm:text-lg text-[#476788] leading-relaxed">
            Click through our 3-stage autonomous pipeline to see how BrowserPilot continuously discovers, scores, and connects you to tier-1 roles.
          </p>
        </div>

        {/* 2-Column Interactive Split: Left Accordion Steps | Right Live 3D Viewport */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Interactive Accordion Step List */}
          <div className="lg:col-span-5 space-y-4">
            {CAPABILITIES.map((cap) => {
              const isCurrent = cap.id === activeTab;
              const Icon = cap.icon;
              return (
                <div
                  key={cap.id}
                  onClick={() => setActiveTab(cap.id)}
                  className={`p-6 rounded-2xl border transition-all cursor-pointer text-left ${
                    isCurrent
                      ? "bg-[#f8f9fb] border-[#006bff] shadow-marble-2"
                      : "bg-white border-[#d4e0ed] hover:border-[#476788]/40 hover:bg-[#fafbfd]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                          isCurrent ? "bg-[#006bff] text-white" : "bg-[#d4e0ed]/50 text-[#476788]"
                        }`}
                      >
                        {cap.stepNumber}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#006bff]">
                        {cap.badge}
                      </span>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${
                        isCurrent ? "text-[#006bff] rotate-90" : "text-[#476788]/40"
                      }`}
                    />
                  </div>

                  <h3 className="text-lg font-bold text-[#0b3558] mb-2 leading-snug">
                    {cap.title}
                  </h3>

                  <p className="text-sm text-[#476788] leading-relaxed">
                    {cap.shortDesc}
                  </p>

                  {isCurrent && (
                    <div className="mt-4 pt-4 border-t border-[#d4e0ed] flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#476788]">{cap.metrics.label}:</span>
                      <span className="text-[#006bff] font-bold">{cap.metrics.value}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column: Live Visual Viewport with 3D Card Depth */}
          <div className="lg:col-span-7 sticky top-24">
            <div className="rounded-3xl border border-[#d4e0ed] bg-gradient-to-br from-[#f8f9fb] to-[#ffffff] p-6 sm:p-8 lg:p-10 shadow-marble-3 relative overflow-hidden">
              {/* Background ambient lighting */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#006bff]/5 rounded-full blur-3xl pointer-events-none" />

              {/* Viewport Header Bar */}
              <div className="flex items-center justify-between pb-5 border-b border-[#d4e0ed] mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#e6f0ff] flex items-center justify-center text-[#006bff] shadow-sm">
                    <ActiveIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-[#0b3558]">
                      {activeCapability.previewDetails.heading}
                    </h4>
                    <p className="text-xs text-[#476788]">
                      {activeCapability.previewDetails.subheading}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Real-Time Stream</span>
                </div>
              </div>

              {/* Interactive Pipeline Items */}
              <div className="space-y-3">
                {activeCapability.previewDetails.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-[#d4e0ed] bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-[#006bff]/50 transition-all hover:translate-x-1"
                  >
                    <div>
                      <div className="text-xs font-semibold text-[#476788]">{item.label}</div>
                      <div className="text-sm font-bold text-[#0b3558]">{item.value}</div>
                    </div>
                    {item.badge && (
                      <span className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-full bg-[#e6f0ff] text-[#004eba] border border-[#d4e0ed] self-start sm:self-auto">
                        {item.badge}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom Telemetry Footer */}
              <div className="mt-6 pt-4 border-t border-[#d4e0ed] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="font-mono text-[#476788] flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#006bff]" />
                  {activeCapability.previewDetails.telemetryText}
                </span>
                <Link href="/login">
                  <Button
                    size="sm"
                    className="h-9 px-4 rounded-lg bg-[#006bff] hover:bg-[#006bff]/90 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-marble-1"
                  >
                    <span>Launch Pilot</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
