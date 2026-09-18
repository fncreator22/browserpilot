"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Terminal, 
  GraduationCap, 
  Briefcase, 
  Globe2, 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  Zap, 
  Clock, 
  ShieldCheck 
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PersonaSolution {
  id: string;
  role: string;
  badge: string;
  icon: typeof Terminal;
  headline: string;
  description: string;
  metricLabel: string;
  metricValue: string;
  metricContext: string;
  keyOutcomes: string[];
  sampleMatch: {
    company: string;
    title: string;
    salary: string;
    matchScore: number;
    tag: string;
  };
}

const PERSONAS: PersonaSolution[] = [
  {
    id: "staff",
    role: "Staff & Principal Engineers",
    badge: "L6+ Systems",
    icon: Terminal,
    headline: "Zero noise. Only verified distributed systems and architecture roles.",
    description: "Senior ICs waste hours filtering through junior recruiter spam. BrowserPilot runs deterministic parsers across verified L6+ level descriptions, compensation brackets ($250k - $500k+), and exact tech stacks.",
    metricLabel: "Time Saved",
    metricValue: "14 hrs/wk",
    metricContext: "Eliminates manual job board dredging entirely",
    keyOutcomes: [
      "Direct bypass to hiring manager LinkedIn and work emails",
      "Deterministic compensation verification from SEC / Level.fyi calibration",
      "Instant alerts within 60 seconds of ATS posting"
    ],
    sampleMatch: {
      company: "Stripe",
      title: "Staff Infrastructure Engineer",
      salary: "$340,000 - $480,000",
      matchScore: 99,
      tag: "Greenhouse • Direct Team Match"
    }
  },
  {
    id: "early-career",
    role: "New Grads & Students",
    badge: "Early Applicant Priority",
    icon: GraduationCap,
    headline: "Beat 5,000 applicants by being in the first 20 submissions.",
    description: "New grad and internship listings hit application caps within 2 hours. Our continuous scrapers ping Greenhouse and Ashby endpoints every 60 seconds, ensuring you apply before the role is closed.",
    metricLabel: "Interview Rate",
    metricValue: "4.8x higher",
    metricContext: "For candidates applying within the first 15 minutes",
    keyOutcomes: [
      "Real-time alerts via Webhook, Slack, and Telegram",
      "Zero ghost postings: every job verified with live HTTP status",
      "Automated fit evaluation against your GitHub and projects"
    ],
    sampleMatch: {
      company: "Datadog",
      title: "Software Engineer (New Grad 2026)",
      salary: "$145,000 - $175,000",
      matchScore: 96,
      tag: "Ashby • Posted 3m ago"
    }
  },
  {
    id: "leadership",
    role: "Engineering Managers & Directors",
    badge: "Executive Radar",
    icon: Briefcase,
    headline: "Confidential opportunity intelligence for tech leadership.",
    description: "Leadership hiring is discrete. Track covert team expansions, series funding announcements, and newly authorized headcounts across tier-1 startups before executive recruiters start outreach.",
    metricLabel: "Lead Time",
    metricValue: "12 Days Early",
    metricContext: "Average discovery before public headhunter aggregation",
    keyOutcomes: [
      "Discreet radar mode with complete search privacy",
      "Executive compensation and equity package modeling",
      "Direct board and VP Engineering connection maps"
    ],
    sampleMatch: {
      company: "Figma",
      title: "Director of Product Engineering",
      salary: "$290,000 - $390,000 + Equity",
      matchScore: 97,
      tag: "Lever • Executive Search"
    }
  },
  {
    id: "remote",
    role: "Global Remote Specialists",
    badge: "Worldwide USD/EUR",
    icon: Globe2,
    headline: "Filter out 'remote within country' fake listings instantly.",
    description: "Tired of applying to 'remote' jobs only to find geo-locking in the fine print? BrowserPilot inspects ATS payroll eligibility metadata to isolate genuine worldwide and timezone-compatible contracts.",
    metricLabel: "Precision",
    metricValue: "100% Geo-verified",
    metricContext: "Strict payroll and entity residency validation",
    keyOutcomes: [
      "Timezone overlap calculator (US / EU / APAC)",
      "Contractor vs. Full-time employer of record (EOR) flags",
      "Global tax and currency compensation benchmarks"
    ],
    sampleMatch: {
      company: "GitLab",
      title: "Senior Backend Engineer (Go / Rails)",
      salary: "$165,000 - $220,000 USD",
      matchScore: 98,
      tag: "Workday • Global Remote (Anywhere)"
    }
  }
];

export function SolutionsCarousel() {
  const [activeId, setActiveId] = useState("staff");
  const activePersona = PERSONAS.find((p) => p.id === activeId) || PERSONAS[0];
  const PersonaIcon = activePersona.icon;

  return (
    <section className="py-20 lg:py-28 bg-[#f8f9fb] border-b border-[#d4e0ed]/60">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0b3558] tracking-tight">
            See how high-caliber talent uses BrowserPilot.
          </h2>
          <p className="text-base sm:text-lg text-[#476788] leading-relaxed">
            Whether you are targeting staff-level distributed systems, your first tech role, or global remote contracts, configure autonomous scrapers to your exact career archetype.
          </p>
        </div>

        {/* Persona Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-10">
          {PERSONAS.map((persona) => {
            const Icon = persona.icon;
            const isSelected = persona.id === activeId;
            return (
              <button
                key={persona.id}
                type="button"
                onClick={() => setActiveId(persona.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-[#0b3558] text-white border-[#0b3558] shadow-marble-2 scale-[1.02]"
                    : "bg-white text-[#476788] border-[#d4e0ed] hover:border-[#006bff]/50 hover:text-[#0b3558] hover:bg-[#f0f3f8]"
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? "text-[#006bff]" : "text-[#476788]"}`} />
                <span>{persona.role}</span>
              </button>
            );
          })}
        </div>

        {/* Active Persona Deep Dive Card */}
        <div className="rounded-3xl border border-[#d4e0ed] bg-white p-6 sm:p-10 lg:p-12 shadow-marble-2 transition-all">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Col: Narrative & Telemetry */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#e6f0ff] flex items-center justify-center text-[#006bff]">
                  <PersonaIcon className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#006bff] tracking-wide uppercase">
                    {activePersona.badge}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#0b3558]">
                    {activePersona.headline}
                  </h3>
                </div>
              </div>

              <p className="text-[#476788] text-base leading-relaxed">
                {activePersona.description}
              </p>

              {/* Outcomes List */}
              <div className="space-y-2.5 pt-2">
                {activePersona.keyOutcomes.map((outcome, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#006bff] shrink-0 mt-1" />
                    <span className="text-sm font-medium text-[#0b3558] leading-snug">
                      {outcome}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Link */}
              <div className="pt-4">
                <Link href="/login">
                  <Button
                    variant="outline"
                    className="h-11 px-5 rounded-lg border-[#006bff] text-[#006bff] hover:bg-[#006bff] hover:text-white font-semibold text-sm transition-all gap-2 cursor-pointer shadow-marble-1"
                  >
                    <span>Activate {activePersona.badge} Radar</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Col: Live Telemetry & Verified Match Card Preview */}
            <div className="lg:col-span-5 space-y-4">
              {/* Telemetry Metric Tile */}
              <div className="rounded-2xl border border-[#d4e0ed] bg-[#f8f9fb] p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#476788] mb-1">
                  {activePersona.metricLabel}
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-[#006bff] tracking-tight">
                  {activePersona.metricValue}
                </div>
                <div className="text-xs font-medium text-[#476788] mt-1">
                  {activePersona.metricContext}
                </div>
              </div>

              {/* Sample Match Card */}
              <div className="rounded-2xl border-2 border-[#006bff]/20 bg-white p-5 shadow-marble-2 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#006bff]/5 rounded-bl-full pointer-events-none" />
                
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {activePersona.sampleMatch.tag}
                  </span>
                  <span className="text-xs font-bold text-[#006bff] bg-[#e6f0ff] px-2 py-0.5 rounded-full">
                    {activePersona.sampleMatch.matchScore}% Match
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-[#0b3558] text-base leading-tight">
                    {activePersona.sampleMatch.title}
                  </h4>
                  <div className="text-xs font-semibold text-[#476788] mt-0.5">
                    {activePersona.sampleMatch.company}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#d4e0ed] flex items-center justify-between text-xs font-medium text-[#0b3558]">
                  <span>Compensation:</span>
                  <span className="font-bold text-emerald-700">{activePersona.sampleMatch.salary}</span>
                </div>

                <div className="text-[11px] font-mono text-[#476788] flex items-center gap-1.5 pt-1">
                  <ShieldCheck className="h-3 w-3 text-[#006bff]" />
                  <span>Verified live via direct ATS webhook</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
