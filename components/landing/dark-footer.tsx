"use client";

import Link from "next/link";
import { Radio, ShieldCheck, Activity } from "lucide-react";

export function DarkFooter() {
  return (
    <footer className="bg-[#041221] text-[#a6bbd1] border-t border-[#0b3558] pt-16 pb-12">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 space-y-12">
        {/* Main Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[#006bff] flex items-center justify-center text-white shadow-sm">
                <Radio className="h-4 w-4" />
              </div>
              <span className="font-bold text-lg text-white tracking-tight">
                BrowserPilot
              </span>
            </Link>

            <p className="text-sm text-[#a6bbd1] max-w-sm leading-relaxed">
              Autonomous opportunity intelligence platform. Continuous ATS scrapers, deterministic 100-point match scoring, and direct hiring manager outreach.
            </p>

            {/* Live System Status Indicator */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#08213b] border border-[#0b3558] text-xs font-mono text-white">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>All Radar Nodes Operational (99.98%)</span>
            </div>
          </div>

          {/* Column 1: Product */}
          <div className="space-y-3 text-sm">
            <div className="font-bold text-white text-xs uppercase tracking-wider">
              Product
            </div>
            <ul className="space-y-2">
              <li>
                <Link href="/app" className="hover:text-white transition-colors">
                  Autonomous Radar
                </Link>
              </li>
              <li>
                <Link href="/app" className="hover:text-white transition-colors">
                  Zero-Ghost Scraper
                </Link>
              </li>
              <li>
                <Link href="/app" className="hover:text-white transition-colors">
                  DeepReach Recruiter
                </Link>
              </li>
              <li>
                <Link href="/app" className="hover:text-white transition-colors">
                  100-Point Fit Engine
                </Link>
              </li>
              <li>
                <Link href="/app/plans" className="hover:text-white transition-colors">
                  Pricing & Quotas
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: ATS Integrations */}
          <div className="space-y-3 text-sm">
            <div className="font-bold text-white text-xs uppercase tracking-wider">
              ATS Engines
            </div>
            <ul className="space-y-2">
              <li>
                <Link href="/app" className="hover:text-white transition-colors">
                  Greenhouse Ingest
                </Link>
              </li>
              <li>
                <Link href="/app" className="hover:text-white transition-colors">
                  Ashby Native Webhook
                </Link>
              </li>
              <li>
                <Link href="/app" className="hover:text-white transition-colors">
                  Lever Real-time API
                </Link>
              </li>
              <li>
                <Link href="/app" className="hover:text-white transition-colors">
                  Workday Enterprise
                </Link>
              </li>
              <li>
                <Link href="/app" className="hover:text-white transition-colors">
                  SmartRecruiters Sync
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Trust & Legal */}
          <div className="space-y-3 text-sm">
            <div className="font-bold text-white text-xs uppercase tracking-wider">
              Trust & Legal
            </div>
            <ul className="space-y-2">
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Security Architecture
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Candidate Data Protection
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Cookie Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[#0b3558] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#a6bbd1]">
          <div>
            &copy; {new Date().getFullYear()} BrowserPilot Technologies Inc. All rights reserved.
          </div>

          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1 text-[#a6bbd1]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#006bff]" />
              Deterministic Career Autopilot
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
