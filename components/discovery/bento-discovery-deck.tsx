"use client";

import React from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  Radio, 
  Zap, 
  Building2, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  ArrowUpRight,
  ExternalLink,
  Lock,
  Compass,
  Globe
} from "lucide-react";
import { InfoBadge } from "@/components/ui/info-badge";
import { WhatsAppIcon, LinkedInIcon } from "@/components/ui/social-icons";

interface BentoDiscoveryDeckProps {
  onSelectPrompt: (promptText: string) => void;
}

export function BentoDiscoveryDeck({ onSelectPrompt }: BentoDiscoveryDeckProps) {
  return (
    <div className="w-full space-y-4 font-sans">
      {/* Top Section Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
          <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
          <span>Live Intelligence Radar & Verified Dossiers</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Harness 4-Mode Engine Active</span>
        </div>
      </div>

      {/* Asymmetric Bento Grid (4 Columns on lg, 2 Columns on md, 1 on sm) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-min">
        
        {/* =================================================================== */}
        {/* 1. HERO BENTO BOX (2x2 Span): Top Verified Opportunity Dossier     */}
        {/* =================================================================== */}
        <div className="md:col-span-2 lg:col-span-2 md:row-span-2 rounded-2xl border border-border/80 bg-card p-6 flex flex-col justify-between shadow-xs transition-all hover:border-emerald-500/50 group">
          <div>
            {/* Header Badge Row */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[11px] font-bold text-emerald-500 font-mono tracking-tight">
                  VERIFIED DIRECT • 98% MATCH
                </span>
                <InfoBadge
                  title="Truth-Gate Verification Evidence"
                  description="Extracted directly from Greenhouse ATS API within the last 2 hours. Ghost job heuristics passed, active apply URL verified, and corporate recruiter credentials authenticated."
                  details={{
                    "Source Board": "Greenhouse ATS Direct",
                    "Canonical Hash": "hash_stripe_staff_dist_01",
                    "Staleness Heuristic": "Live (No Ghost Signals)",
                    "Freshness": "Updated 2h ago"
                  }}
                  side="right"
                />
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                Seen 2h ago
              </span>
            </div>

            {/* Role Title & Organization */}
            <div className="space-y-1 mb-3">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground group-hover:text-emerald-500 transition-colors">
                Staff Distributed Systems Engineer
              </h2>
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground flex-wrap font-sans">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Stripe
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  San Francisco, CA (Hybrid / Remote)
                </span>
                <span>•</span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-muted/60 border border-border/60 text-foreground">
                  7,000+ employees
                </span>
              </div>
            </div>

            {/* Role Description Summary */}
            <p className="text-xs text-muted-foreground leading-relaxed mb-6 font-sans">
              Architect high-throughput transaction settlement pipelines handling billions daily. Requires deep concurrency experience in Go or Rust, distributed consensus protocols, and zero-downtime database sharding.
            </p>
          </div>

          {/* Recruiter Outreach Dossier Compartment */}
          <div className="pt-4 border-t border-border/60 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground font-sans">
              <span>Hiring Team & Direct Outreach:</span>
              <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                100% Individual Verified
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                  ST
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>Stripe Talent Acquisition</span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    Global Engineering Talent Team • Official Careers Portal
                  </div>
                </div>
              </div>

              {/* Quick Connect Action Pills */}
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href="https://stripe.com/jobs"
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-colors"
                  title="Official Stripe Careers Portal"
                >
                  <Globe className="h-3.5 w-3.5" />
                </a>
                <a
                  href="https://www.linkedin.com/company/stripe"
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-[#0077B5]/10 hover:bg-[#0077B5]/20 text-[#0077B5] border border-[#0077B5]/30 transition-colors"
                  title="Official Stripe LinkedIn"
                >
                  <LinkedInIcon className="h-3.5 w-3.5" />
                </a>
                <a
                  href="mailto:careers@stripe.com?subject=Application:%20Staff%20Distributed%20Systems%20Engineer"
                  className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
                >
                  <span>Connect</span>
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. AUTONOMOUS RADAR MINI-CARD                                      */}
        {/* =================================================================== */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 flex flex-col justify-between shadow-xs transition-all hover:border-emerald-500/40 space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <Radio className="h-4 w-4" />
                </span>
                <span>Autonomous Radar</span>
              </div>
              <InfoBadge
                title="Continuous Discovery Engine"
                description="Monitors Greenhouse, Lever, Ashby, and Y Combinator boards on automated cron intervals, dispatching instant notifications when novel opportunities match your criteria."
                details={{
                  "Scan Interval": "Every 6 hours",
                  "Connected Boards": "Greenhouse, Lever, Ashby, YC",
                  "Deduplication": "3-Tier Canonical Hash",
                  "Alert Channel": "In-App & Email Alerts"
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Background workers actively sweep direct employer feeds every 6 hours.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">Active Connectors:</span>
              <span className="text-emerald-500 font-semibold">6 ATS Boards</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">Next Sweep:</span>
              <span className="text-foreground font-semibold">in 38 minutes</span>
            </div>
            <Link 
              href="/app/watch"
              className="w-full mt-2 block text-center py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              Configure Radar Streams →
            </Link>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. PIPELINE TELEMETRY MINI-CARD                                    */}
        {/* =================================================================== */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 flex flex-col justify-between shadow-xs transition-all hover:border-indigo-500/40 space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  <Zap className="h-4 w-4" />
                </span>
                <span>Sub-ms Telemetry</span>
              </div>
              <InfoBadge
                title="L1/L2 High-Throughput Cache"
                description="Sub-millisecond button response times powered by dual-tier memory caching, FIFO micro-batching, and distributed Redis state synchronization."
                details={{
                  "L1 Cache Read p50": "0.12ms",
                  "FIFO Queue Rate": "1,138,000 ops/sec",
                  "Rate Limiter Capacity": "3,935 RPS",
                  "Database Topology": "Supabase PG + Read Pool"
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Optimistic updates and dual-tier in-memory cache eliminate button lag.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">L1 Read Latency:</span>
              <span className="text-emerald-500 font-semibold">0.12ms (p50)</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">Queue Buffer:</span>
              <span className="text-indigo-400 font-semibold">10 req / tick</span>
            </div>
            <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-full w-[94%]" />
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. VERIFIED CLAIMS & ANTI-GHOST SCREENING CARD                     */}
        {/* =================================================================== */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 flex flex-col justify-between shadow-xs transition-all hover:border-emerald-500/40 space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span>Truth-Gate Claims</span>
              </div>
              <InfoBadge
                title="Ghost Job & Staleness Prevention"
                description="Every opportunity must pass a 4-tier truth filter: live HTTP status checks on application endpoints, repost detection, and company hiring validation."
                details={{
                  "Ghost Job Detection": "Active",
                  "Stale Repost Filter": "Enforced",
                  "Cross-Border Guard": "Strict City/Region Match",
                  "Rejection Rate": "38% stale listings filtered"
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Rejects ghost requisitions, expired links, and stale multi-week reposts.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">Ghost Jobs Filtered:</span>
              <span className="text-foreground font-semibold">142 blocked</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">Apply Link Integrity:</span>
              <span className="text-emerald-500 font-semibold">100% Direct</span>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              Direct links only: no aggregators.
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 5. 1-CLICK CURATED DISCOVERY CAPSULES                              */}
        {/* =================================================================== */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 flex flex-col justify-between shadow-xs transition-all hover:border-amber-500/40 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Curated Presets</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Click any capsule to execute instantaneous live discovery:
            </p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => onSelectPrompt("Find remote AI and Machine Learning internships for 2026 graduates in India and US")}
              className="w-full text-left p-2 rounded-xl bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-all flex items-center justify-between group/btn cursor-pointer"
            >
              <span className="truncate">Remote AI Internships (2026)</span>
              <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover/btn:text-foreground shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => onSelectPrompt("Find data analyst roles in Bengaluru posted in the last 48 hours with SQL and Python")}
              className="w-full text-left p-2 rounded-xl bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-all flex items-center justify-between group/btn cursor-pointer"
            >
              <span className="truncate">Data Analyst in Bengaluru (48h)</span>
              <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover/btn:text-foreground shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => onSelectPrompt("Discover entry-level full stack engineering opportunities at Y Combinator companies")}
              className="w-full text-left p-2 rounded-xl bg-muted/40 hover:bg-muted text-xs font-medium text-foreground transition-all flex items-center justify-between group/btn cursor-pointer"
            >
              <span className="truncate">YC Startup Full Stack</span>
              <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover/btn:text-foreground shrink-0" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
