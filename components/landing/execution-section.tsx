"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { 
  ArrowRight, 
  Sparkles, 
  Activity, 
  ShieldCheck, 
  Building, 
  MapPin, 
  Briefcase, 
  CheckCircle2, 
  Clock, 
  Globe 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusTimeline, TimelineStep } from "@/components/execution/status-timeline";

const SWARM_DISCOVERY_STEPS: TimelineStep[] = [
  {
    id: "s1",
    name: "Synthesizing career intent",
    description: "Gemini 2.5 parses natural language query into structured target roles, skill taxonomy, and location preferences.",
    status: "COMPLETED",
    durationMs: 280,
    toolCall: "ai.planDiscovery({ role: 'Staff Systems Engineer', workMode: 'REMOTE' })",
  },
  {
    id: "s2",
    name: "Dispatching multi-source swarm",
    description: "Concurrently queries direct ATS endpoints (Greenhouse, Lever, Ashby), tech networks, and career boards.",
    status: "COMPLETED",
    durationMs: 540,
    toolCall: "swarm.harvestSources({ targets: ['Ashby', 'Greenhouse', 'Lever', 'LinkedIn', 'HN'] })",
  },
  {
    id: "s3",
    name: "Truth-gate verification",
    description: "Performs live HTTP assertion checks to purge expired, closed, or ghost listings before ingestion.",
    status: "COMPLETED",
    durationMs: 620,
    toolCall: "truthGate.verifyEvidence({ checkHttpStatus: true, filterGhostListings: true })",
  },
  {
    id: "s4",
    name: "Relevance ranking & badging",
    description: "Scores candidate jobs on 100-point deterministic scale; differentiates exact matches from recommendations.",
    status: "RUNNING",
    durationMs: 310,
    toolCall: "ranker.evaluateFit({ assignBadges: true, prioritizeFreshness: true })",
  },
  {
    id: "s5",
    name: "Autonomous watch loop",
    description: "Enrolls search intent into background discovery queue for continuous scheduled monitoring.",
    status: "PENDING",
  },
];

const MOCK_SWARM_CARDS = [
  {
    company: "Linear",
    title: "Staff Distributed Systems Engineer",
    source: "Ashby",
    location: "Remote",
    fit: 96,
    badge: "Exact Match",
    badgeType: "exact",
    tagline: "Matches Role & Target Skills",
  },
  {
    company: "Figma",
    title: "Senior Infrastructure & Cloud Architect",
    source: "Greenhouse",
    location: "Remote / Hybrid",
    fit: 91,
    badge: "Exact Match",
    badgeType: "exact",
    tagline: "Matches High-Concurrency Experience",
  },
  {
    company: "Neon Database",
    title: "Rust Core Storage Engineer",
    source: "Hacker News",
    location: "London / Remote",
    fit: 88,
    badge: "Recommendation",
    badgeType: "rec",
    tagline: "Alternative Location • Remote Opportunity",
  },
  {
    company: "Supabase",
    title: "Full Stack Infrastructure Developer",
    source: "Ashby",
    location: "San Francisco, CA",
    fit: 84,
    badge: "Recommendation",
    badgeType: "rec",
    tagline: "Similar Role • Adjacent Systems Stack",
  },
];

export function ExecutionSection() {
  return (
    <section className="py-16 sm:py-24 relative">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10"
        >
          <div>
            <Badge variant="outline" className="mb-2 font-mono text-xs text-primary border-primary/30">
              Autonomous Swarm Radar
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-foreground">
              Multi-Source Harvesting & Truth-Gate Verification
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
              Watch BrowserPilot synthesize intent, query disparate ATS platforms in parallel, purge ghost listings, and surface transparently-badged opportunities.
            </p>
          </div>
          <Link href="/app">
            <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 shadow-xs">
              Open Discovery Workspace <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </motion.div>

        {/* Sticky Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Timeline */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <StatusTimeline steps={SWARM_DISCOVERY_STEPS} />
            </motion.div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 font-mono text-xs text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Multi-Source Swarm Stream
              </span>
              <span className="text-foreground font-semibold">5 Active Sources • HTTP 200</span>
            </div>
          </div>

          {/* Right Column: Live Opportunity Stream & Badging Showcase */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#1F3D2E]" />
                  <span className="font-serif font-bold text-sm sm:text-base text-foreground">
                    Live Verified Ingestion Stream
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border-emerald-300">
                    Truth-Gate Verified
                  </Badge>
                </div>
              </div>

              {/* Swarm Cards with Recommendation Badging */}
              <div className="space-y-3">
                {MOCK_SWARM_CARDS.map((card, idx) => (
                  <div
                    key={card.company}
                    className="rounded-xl border border-border/70 bg-white dark:bg-slate-900/50 p-3.5 sm:p-4 shadow-xs hover:border-[#1F3D2E]/40 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#1F3D2E]/10 text-[#1F3D2E] font-mono text-[10px] font-bold">
                          #{idx + 1}
                        </span>
                        <span className="font-sans font-semibold text-xs sm:text-sm text-foreground flex items-center gap-1">
                          <Building className="h-3 w-3 text-[#1F3D2E]" />
                          {card.company}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-[#E8EFEA] text-[#1F3D2E] border border-[#C3D5CA]">
                          {card.source}
                        </span>
                        {card.badgeType === "exact" ? (
                          <Badge variant="outline" className="text-[10px] font-sans px-1.5 py-0 text-emerald-800 border-emerald-300 bg-emerald-50 flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                            Exact Match
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-sans px-1.5 py-0 text-amber-800 border-amber-300 bg-amber-50 flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5 text-amber-600" />
                            Recommendation
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-[#1F3D2E] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          {card.fit}% fit
                        </span>
                        <Badge variant="outline" className="text-[10px] font-sans px-1.5 py-0 bg-emerald-50 text-emerald-800 border-emerald-300 flex items-center gap-1">
                          <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" />
                          Verified Live
                        </Badge>
                      </div>
                    </div>

                    <div className="text-sm font-serif font-bold text-foreground">
                      {card.title}
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5 text-xs text-muted-foreground font-sans">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {card.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          Full-Time
                        </span>
                      </div>

                      {card.tagline && (
                        <span className={`text-[10px] font-sans font-medium px-1.5 py-0.5 rounded border ${
                          card.badgeType === "exact"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}>
                          {card.tagline}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs font-sans text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Average multi-source discovery: <strong>1.4s</strong> (Zero LLM token latency)
                </span>
                <Link href="/app" className="text-[#1F3D2E] font-medium hover:underline inline-flex items-center gap-1">
                  Try live search <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
