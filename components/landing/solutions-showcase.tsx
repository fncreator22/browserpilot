"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { 
  Clock, 
  ShieldCheck, 
  Users, 
  ArrowRight, 
  CheckCircle2, 
  Activity, 
  AlertTriangle, 
  Mail, 
  Sparkles,
  Zap,
  Building2,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function SolutionsShowcase() {
  return (
    <div className="space-y-0">
      {/* 1. First Story: 90-Second Advantage */}
      <motion.section 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="py-20 lg:py-28 bg-[#f0f7ff]/70 border-b border-[#d4e0ed]/60 relative overflow-hidden"
      >
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#0099ff]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Narrative Column */}
            <div className="lg:col-span-6 space-y-6">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0b3558] tracking-tight leading-[1.15]">
                Bypass the 500-applicant queue. Apply within 90 seconds.
              </h2>

              <p className="text-base sm:text-lg text-[#476788] leading-relaxed">
                By day two of a job posting, recruiters are drowned in 400+ resumes and resume review slows to a halt. BrowserPilot monitors career endpoints directly, pinging your device the moment the requisition is created in the company internal ATS.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  "First 25 applicants receive 82% of all initial recruiter phone screens",
                  "Direct Webhook notifications push straight to your phone or desktop",
                  "One-click auto-filled applications with verified portfolio attachments"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#006bff] shrink-0 mt-1" />
                    <span className="text-sm font-medium text-[#0b3558]">{item}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Link href="/login">
                  <Button
                    className="h-11 px-6 rounded-lg bg-[#006bff] hover:bg-[#006bff]/90 text-white font-semibold text-sm shadow-marble-2 gap-2 cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <span>Set Up Instant Alerts</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Visual Column: Interactive Speed Curve & Live Job Feed */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl border border-[#d4e0ed] bg-white p-6 sm:p-8 shadow-marble-3 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#d4e0ed]">
                  <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#0b3558]">
                    <Activity className="h-4 w-4 text-[#006bff] animate-pulse" />
                    <span>TIMELINE TO APPLICATION CAP</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    90s Response Time
                  </span>
                </div>

                {/* Progress Comparison */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-[#0b3558] mb-1.5">
                      <span>BrowserPilot Discovery & Application</span>
                      <span className="text-[#006bff] font-bold">Minute 01 • Candidate #4</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-[#f0f3f8] overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: "12%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-[#006bff] rounded-full" 
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold text-[#476788] mb-1.5">
                      <span>Public Job Board Aggregation (LinkedIn/Indeed)</span>
                      <span className="text-[#476788]">Hour 36 • Candidate #512</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-[#f0f3f8] overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: "94%" }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                        className="h-full bg-[#a6bbd1] rounded-full" 
                      />
                    </div>
                  </div>
                </div>

                {/* Live Candidate Outcome Quote */}
                <div className="p-4 rounded-xl bg-[#f8f9fb] border border-[#d4e0ed] text-xs space-y-2">
                  <div className="flex items-center gap-2 text-[#0b3558] font-bold">
                    <Sparkles className="h-4 w-4 text-[#006bff]" />
                    <span>Real-world Candidate Outcome</span>
                  </div>
                  <p className="text-[#476788] leading-relaxed italic">
                    &ldquo;Applied to an unlisted Stripe position 3 minutes after BrowserPilot detected the Greenhouse webhook. Recruiter scheduled a screen 40 minutes later before public boards even crawled it.&rdquo;
                  </p>
                  <div className="text-[11px] font-mono text-[#0b3558] font-semibold">
                    Senior Systems Engineer, San Francisco
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 2. Second Story: Zero Ghost Postings */}
      <motion.section 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="py-20 lg:py-28 bg-[#f8f9fb] border-b border-[#d4e0ed]/60 relative overflow-hidden"
      >
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#006bff]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Visual Column (Swapped for Alternating Layout) */}
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="rounded-3xl border border-[#d4e0ed] bg-white p-6 sm:p-8 shadow-marble-3 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-[#d4e0ed]">
                  <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#0b3558]">
                    <ShieldCheck className="h-4 w-4 text-[#006bff]" />
                    <span>ATS HEALTH & GHOST FILTER</span>
                  </div>
                  <span className="text-xs font-bold text-[#006bff] bg-[#e6f0ff] border border-[#b8d5ff] px-2 py-0.5 rounded-full">
                    Active Filtration
                  </span>
                </div>

                {/* Audit Stream Items */}
                <div className="space-y-2.5">
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <div>
                        <div className="font-bold text-[#0b3558]">Greenhouse API: Requisition #84201</div>
                        <div className="text-emerald-700 text-[11px]">HTTP 200 OK • Hiring Active • 1 Open Headcount</div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-700">VERIFIED</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 flex items-center justify-between text-xs opacity-75">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 w-2 rounded-full bg-rose-500" />
                      <div>
                        <div className="font-bold text-[#0b3558]">Stale Board Listing #19381</div>
                        <div className="text-rose-700 text-[11px]">HTTP 404 Form Expired • 90+ Days Inactive • Ghost Job</div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-rose-700 line-through">DROPPED</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <div>
                        <div className="font-bold text-[#0b3558]">Ashby API: Security Infra Lead</div>
                        <div className="text-emerald-700 text-[11px]">HTTP 200 OK • Payroll Budget Approved • Direct Apply</div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-700">VERIFIED</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#d4e0ed] flex items-center justify-between text-xs text-[#476788] font-mono">
                  <span>Ghost Job Filter Rate:</span>
                  <span className="font-bold text-[#0b3558]">38.4% Postings Rejected</span>
                </div>
              </div>
            </div>

            {/* Narrative Column */}
            <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0b3558] tracking-tight leading-[1.15]">
                No zombie listings. No expired forms. Guaranteed.
              </h2>

              <p className="text-base sm:text-lg text-[#476788] leading-relaxed">
                Up to 40% of positions listed on standard job boards are ghost listings: roles that were filled months ago, evergreen placeholders, or cancelled requisitions. BrowserPilot verifies live API endpoints in real time so you never waste effort on a dead lead.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  "Deterministic HTTP 200 verification on the official company ATS",
                  "Automatic purging of cancelled, frozen, or closed requisitions",
                  "Detection of evergreen placeholder jobs with zero hiring intent"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#006bff] shrink-0 mt-1" />
                    <span className="text-sm font-medium text-[#0b3558]">{item}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Link href="/login">
                  <Button
                    className="h-11 px-6 rounded-lg bg-[#0b3558] hover:bg-[#0b3558]/90 text-white font-semibold text-sm shadow-marble-2 gap-2 cursor-pointer transition-all"
                  >
                    <span>Inspect Verified Postings</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 3. Third Story: DeepReach Recruiter Intelligence */}
      <motion.section 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="py-20 lg:py-28 bg-[#f0fdf4]/70 border-b border-[#d4e0ed]/60 relative overflow-hidden"
      >
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Narrative Column */}
            <div className="lg:col-span-6 space-y-6">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0b3558] tracking-tight leading-[1.15]">
                Direct line to hiring managers. Skip the automated gatekeepers.
              </h2>

              <p className="text-base sm:text-lg text-[#476788] leading-relaxed">
                Resume parsers reject 75% of qualified applicants before human eyes ever see them. BrowserPilot identifies the exact engineering director or talent partner managing the opening and equips you with verified direct emails and targeted pitch drafts.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  "100% verified corporate emails with SMTP handshake confirmation",
                  "Customized cold outreach angles tailored to the hiring team's current stack",
                  "Direct LinkedIn and GitHub handles for technical decision-makers"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-1" />
                    <span className="text-sm font-medium text-[#0b3558]">{item}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Link href="/login">
                  <Button
                    className="h-11 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-marble-2 gap-2 cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    <span>Explore DeepReach Contacts</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Visual Column: Recruiter Dossier Card */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl border border-[#d4e0ed] bg-white p-6 sm:p-8 shadow-marble-3 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-[#d4e0ed]">
                  <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#0b3558]">
                    <Mail className="h-4 w-4 text-emerald-600" />
                    <span>DECISION-MAKER DOSSIER</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    99% Deliverability
                  </span>
                </div>

                {/* Profile Card */}
                <div className="p-4 rounded-2xl bg-[#f8f9fb] border border-[#d4e0ed] space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-[#0b3558] text-white flex items-center justify-center font-bold text-base shadow-sm">
                      SL
                    </div>
                    <div>
                      <div className="font-bold text-[#0b3558] text-base">Sarah Lindqvist</div>
                      <div className="text-xs font-medium text-[#476788]">VP of Infrastructure Engineering • Vercel</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-white border border-[#d4e0ed]">
                      <span className="text-[#476788] block text-[11px]">Work Email</span>
                      <span className="font-mono font-semibold text-[#0b3558]">s.lindqvist@vercel.com</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-[#d4e0ed]">
                      <span className="text-[#476788] block text-[11px]">SMTP Handshake</span>
                      <span className="font-mono font-semibold text-emerald-700">Valid Mailbox (250 OK)</span>
                    </div>
                  </div>
                </div>

                {/* Pitch Draft Viewport */}
                <div className="p-4 rounded-xl bg-white border border-emerald-200 text-xs space-y-2">
                  <div className="flex items-center justify-between font-semibold text-[#0b3558]">
                    <span>AI-Generated Angle: Distributed Systems Pitch</span>
                    <span className="text-emerald-700 text-[11px] font-mono">Ready to Send</span>
                  </div>
                  <p className="text-[#476788] text-[12px] leading-relaxed italic bg-[#f8f9fb] p-3 rounded-lg border border-[#d4e0ed]">
                    &ldquo;Hi Sarah, I noticed your infrastructure team just posted the Distributed Edge Lead role on Greenhouse. Given my background scaling Raft clusters to 1M RPS at Cloudflare, I put together a quick breakdown of how our consensus latency was cut by 40%...&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
