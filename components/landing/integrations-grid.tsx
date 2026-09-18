"use client";

import Link from "next/link";
import { 
  Building2, 
  Share2, 
  Bell, 
  Calendar, 
  GitBranch, 
  Terminal, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface IntegrationItem {
  name: string;
  category: "ATS" | "Alerts" | "Sync";
  status: string;
  latency: string;
  description: string;
}

const INTEGRATIONS: IntegrationItem[] = [
  {
    name: "Greenhouse",
    category: "ATS",
    status: "Direct API",
    latency: "< 90s sync",
    description: "Full API ingestion across 8,000+ top engineering organizations."
  },
  {
    name: "Ashby",
    category: "ATS",
    status: "Native Webhook",
    latency: "< 45s sync",
    description: "Instantaneous new requisition alerts for hypergrowth tech startups."
  },
  {
    name: "Lever",
    category: "ATS",
    status: "HTTP 200 Stream",
    latency: "< 60s sync",
    description: "Deep structured schema parsing for engineering and design roles."
  },
  {
    name: "Workday",
    category: "ATS",
    status: "Enterprise Crawler",
    latency: "< 3m sync",
    description: "Autonomous headless parsing for Fortune 500 tech divisions."
  },
  {
    name: "Slack",
    category: "Alerts",
    status: "Bot Integration",
    latency: "Real-time",
    description: "Pings your private career channel with 1-click apply links."
  },
  {
    name: "Telegram",
    category: "Alerts",
    status: "Encrypted Bot",
    latency: "Immediate",
    description: "Mobile notification push with instant salary and fit summaries."
  },
  {
    name: "Google Calendar",
    category: "Sync",
    status: "OAuth 2.0",
    latency: "Two-way",
    description: "Auto-blocks interview preparation and recruiter phone screens."
  },
  {
    name: "GitHub",
    category: "Sync",
    status: "Commit Analyzer",
    latency: "Continuous",
    description: "Auto-evaluates repo languages and frameworks for 100-point fit matching."
  }
];

export function IntegrationsGrid() {
  return (
    <section className="py-20 lg:py-28 bg-white border-b border-[#d4e0ed]/60 relative">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0b3558] tracking-tight">
            Connects with your entire career workflow.
          </h2>
          <p className="text-base sm:text-lg text-[#476788] leading-relaxed">
            From direct ATS career engines to instant Slack alerts and GitHub commit analyzers, BrowserPilot integrates natively with the tools you already rely on.
          </p>
        </div>

        {/* Grid of Integrations */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {INTEGRATIONS.map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl border border-[#d4e0ed] bg-[#f8f9fb] hover:bg-white hover:border-[#006bff]/50 shadow-sm hover:shadow-marble-2 transition-all space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white text-[#006bff] border border-[#d4e0ed]">
                  {item.category}
                </span>
                <span className="text-[11px] font-mono text-emerald-700 font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {item.latency}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#0b3558] group-hover:text-[#006bff] transition-colors">
                  {item.name}
                </h3>
                <p className="text-xs text-[#476788] leading-relaxed mt-1">
                  {item.description}
                </p>
              </div>

              <div className="pt-2 border-t border-[#d4e0ed] flex items-center justify-between text-[11px] text-[#476788] font-mono">
                <span>Protocol:</span>
                <span className="font-semibold text-[#0b3558]">{item.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Developer Webhook & API Callout */}
        <div className="mt-12 p-6 sm:p-8 rounded-3xl border border-[#d4e0ed] bg-[#f0f7ff] flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-lg font-bold text-[#0b3558]">
              Need custom ATS ingest or automated webhooks?
            </h4>
            <p className="text-xs sm:text-sm text-[#476788]">
              BrowserPilot supports custom REST webhooks, JSON payload dispatching, and private company scrapers.
            </p>
          </div>
          <Link href="/login" className="shrink-0">
            <Button
              className="h-11 px-5 rounded-lg bg-[#006bff] hover:bg-[#006bff]/90 text-white font-semibold text-xs sm:text-sm gap-2 shadow-marble-1 cursor-pointer"
            >
              <Zap className="h-4 w-4" />
              <span>Explore Webhook Docs</span>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
