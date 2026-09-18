"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { 
  Radio, 
  ShieldCheck, 
  Briefcase, 
  Zap, 
  Search, 
  ArrowUpRight, 
  Mail, 
  CheckCircle2, 
  MapPin, 
  DollarSign,
  Activity,
  Terminal,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ProductTab = "RADAR" | "SCRAPER" | "RECRUITER" | "FIT_ENGINE";

export function CaveStage() {
  const [activeTab, setActiveTab] = useState<ProductTab>("RADAR");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -7;
    const rotateY = ((x - centerX) / centerX) * 7;

    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
      {/* 3D Cave Stage Container */}
      <div 
        className="relative overflow-hidden rounded-[32px] p-6 sm:p-10 lg:p-14 text-white shadow-marble-3 border border-white/20"
        style={{
          background: "radial-gradient(ellipse at 50% 20%, #006bff 0%, #004599 35%, #08213b 70%, #041221 100%)",
        }}
      >
        {/* Concentric 3D Radar Rings Background Animation */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-45">
          <div 
            className="w-[850px] h-[850px] relative flex items-center justify-center transition-transform duration-1000"
            style={{
              transform: "perspective(900px) rotateX(55deg) scale(1.1)",
            }}
          >
            {/* Animated Concentric Rings */}
            <div className="absolute w-[800px] h-[800px] rounded-full border border-sky-400/25 animate-[spin_60s_linear_infinite]" />
            {/* Orbiting Satellite Node 1 on Outer Ring */}
            <div className="absolute w-[800px] h-[800px] rounded-full animate-[spin_20s_linear_infinite]">
              <div className="h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(56,189,248,0.7)] absolute -top-1.5 left-1/2 -translate-x-1/2" />
            </div>

            <div className="absolute w-[620px] h-[620px] rounded-full border border-sky-300/35 animate-[spin_40s_linear_infinite_reverse]" />
            {/* Orbiting Satellite Node 2 on Middle Ring */}
            <div className="absolute w-[620px] h-[620px] rounded-full animate-[spin_16s_linear_infinite_reverse]">
              <div className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)] absolute -bottom-1.5 left-1/2 -translate-x-1/2" />
            </div>

            <div className="absolute w-[440px] h-[440px] rounded-full border border-cyan-400/30" />
            {/* Orbiting Satellite Node 3 on Inner Ring */}
            <div className="absolute w-[440px] h-[440px] rounded-full animate-[spin_24s_linear_infinite]">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.7)] absolute top-1/2 -left-1.5 -translate-y-1/2" />
            </div>

            <div className="absolute w-[280px] h-[280px] rounded-full border border-white/40" />
            <div className="absolute w-[140px] h-[140px] rounded-full bg-[#0099ff]/30 blur-md" />

            {/* Crosshair Sweep Line */}
            <div 
              className="absolute w-[800px] h-0.5 bg-gradient-to-r from-transparent via-cyan-300 to-transparent animate-[spin_8s_linear_infinite]" 
            />
          </div>
        </div>

        {/* Ambient Atmosphere Blobs */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#006bff]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#0099ff]/30 rounded-full blur-3xl pointer-events-none" />

        {/* Header: Product Navigation Switcher */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8 sm:mb-12">
          {[
            { id: "RADAR", label: "Autonomous Radar", icon: Radio, badge: "24/7" },
            { id: "SCRAPER", label: "Zero-Ghost Scraper", icon: ShieldCheck, badge: "HTTP 200" },
            { id: "RECRUITER", label: "DeepReach Recruiter", icon: Briefcase, badge: "Verified" },
            { id: "FIT_ENGINE", label: "100-Point Fit Engine", icon: Zap, badge: "98% Match" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ProductTab)}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer backdrop-blur-md border ${
                  isActive
                    ? "bg-white text-[#0b3558] border-white shadow-marble-2 font-bold scale-105"
                    : "bg-white/10 text-white/90 border-white/15 hover:bg-white/20 hover:border-white/30"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-[#006bff]" : "text-sky-300"}`} />
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isActive ? "bg-[#006bff]/10 text-[#006bff]" : "bg-white/10 text-white"
                }`}>
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3D Interactive Stage Canvas */}
        <div 
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative z-10 max-w-4xl mx-auto transition-transform duration-200 ease-out"
          style={{
            transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          <AnimatePresence mode="wait">
            {/* TAB 1: Autonomous Radar View */}
            {activeTab === "RADAR" && (
              <motion.div
                key="RADAR"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl border border-white/30 bg-white/95 backdrop-blur-xl p-6 sm:p-8 text-[#0b3558] shadow-2xl space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#d4e0ed] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#006bff] text-white shadow-marble-1">
                      <Radio className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-sans text-base sm:text-lg font-bold">
                        Autonomous 24/7 Radar Cluster
                      </h3>
                      <p className="text-xs text-[#476788]">
                        Active polling across 15,000+ official ATS infrastructure boards
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                      Next Sweep in 14m
                    </span>
                  </div>
                </div>

              {/* Radar Live Watch Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-[#d4e0ed] bg-[#f8f9fb] p-4 space-y-2">
                  <span className="text-[11px] font-mono text-[#476788] uppercase tracking-wider">Target Domain</span>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">GitLab B.V.</span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      Live (HTTP 200)
                    </Badge>
                  </div>
                  <p className="text-xs text-[#476788]">Staff Infrastructure Engineer</p>
                  <span className="inline-block text-xs font-mono font-bold text-[#006bff]">$190k - $240k</span>
                </div>

                <div className="rounded-xl border border-[#d4e0ed] bg-[#f8f9fb] p-4 space-y-2">
                  <span className="text-[11px] font-mono text-[#476788] uppercase tracking-wider">Target Domain</span>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Datadog</span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      Live (HTTP 200)
                    </Badge>
                  </div>
                  <p className="text-xs text-[#476788]">Principal Distributed Systems</p>
                  <span className="inline-block text-xs font-mono font-bold text-[#006bff]">$210k - $260k</span>
                </div>

                <div className="rounded-xl border border-[#d4e0ed] bg-[#f8f9fb] p-4 space-y-2">
                  <span className="text-[11px] font-mono text-[#476788] uppercase tracking-wider">Target Domain</span>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Anthropic</span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      Live (HTTP 200)
                    </Badge>
                  </div>
                  <p className="text-xs text-[#476788]">Platform Systems Architect</p>
                  <span className="inline-block text-xs font-mono font-bold text-[#006bff]">$240k - $320k</span>
                </div>
              </div>

              {/* Action Strip */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <span className="text-xs font-mono text-[#476788]">
                  Telemetry: 342 roles scanned in last 2 hours • 3 high-fit vacancies detected
                </span>
                <Link href="/login">
                  <Button size="sm" className="h-9 px-4 rounded-lg bg-[#006bff] text-white font-semibold text-xs shadow-marble-1 cursor-pointer">
                    <span>Deploy Radar Watch</span>
                    <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}

          {/* TAB 2: Zero-Ghost Scraper View */}
          {activeTab === "SCRAPER" && (
            <motion.div
              key="SCRAPER"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-white/30 bg-white/95 backdrop-blur-xl p-6 sm:p-8 text-[#0b3558] shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-[#d4e0ed] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-marble-1">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-sans text-base sm:text-lg font-bold">
                      Zero-Ghost Real-Time Endpoint Scraper
                    </h3>
                    <p className="text-xs text-[#476788]">
                      Authentic handshake validation directly against employer servers
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-mono">
                  100% Authentic
                </Badge>
              </div>

              {/* Raw JSON Code Display */}
              <div className="rounded-xl bg-[#06233d] p-4 font-mono text-xs text-sky-100 space-y-1.5 overflow-x-auto">
                <div className="text-[#a6bbd1] text-[11px]">// Live Greenhouse API Endpoint Payload Verification</div>
                <div>HTTP/2 200 OK</div>
                <div>date: Fri, 18 Sep 2026 03:30:12 GMT</div>
                <div>x-ats-status: <span className="text-emerald-400">&quot;ACTIVE_ACCEPTING_RESUMES&quot;</span></div>
                <div>x-ghost-probability: <span className="text-emerald-400">0.000</span></div>
                <div>canonical_url: <span className="text-amber-300">&quot;https://boards.greenhouse.io/gitlab/jobs/4829104&quot;</span></div>
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-[#476788]">
                <span>Validated across Greenhouse, Ashby, Lever, Workday</span>
                <span className="text-emerald-600 font-bold">Zero Stale Aggregators</span>
              </div>
            </motion.div>
          )}

          {/* TAB 3: DeepReach Recruiter View */}
          {activeTab === "RECRUITER" && (
            <motion.div
              key="RECRUITER"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-white/30 bg-white/95 backdrop-blur-xl p-6 sm:p-8 text-[#0b3558] shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-[#d4e0ed] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#006bff] text-white shadow-marble-1">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-sans text-base sm:text-lg font-bold">
                      DeepReach Recruiter &amp; Engineering Leads
                    </h3>
                    <p className="text-xs text-[#476788]">
                      Authenticated work emails and 1-click personal outreach shortcuts
                    </p>
                  </div>
                </div>
                <Badge className="bg-[#e6f0ff] text-[#004eba] border-[#b8d5ff] text-xs font-mono">
                  Direct Outreach
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#d4e0ed] bg-[#f8f9fb] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm">Sarah Jenkins</h4>
                      <p className="text-xs text-[#476788]">Lead Recruiter • Infrastructure Team</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                      Recruiter
                    </Badge>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#d4e0ed] flex items-center justify-between text-xs font-mono">
                    <span>sjenkins@gitlab.com</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-[#d4e0ed] bg-[#f8f9fb] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm">David Chen</h4>
                      <p className="text-xs text-[#476788]">Engineering Manager • Cloud Systems</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700">
                      Hiring Lead
                    </Badge>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-[#d4e0ed] flex items-center justify-between text-xs font-mono">
                    <span>dchen@gitlab.com</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: 100-Point Fit Engine View */}
          {activeTab === "FIT_ENGINE" && (
            <motion.div
              key="FIT_ENGINE"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-white/30 bg-white/95 backdrop-blur-xl p-6 sm:p-8 text-[#0b3558] shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between border-b border-[#d4e0ed] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-marble-1">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-sans text-base sm:text-lg font-bold">
                      100-Point Candidate Fit Scoring Engine
                    </h3>
                    <p className="text-xs text-[#476788]">
                      Mathematical vector matching against your specific career parameters
                    </p>
                  </div>
                </div>
                <Badge className="bg-[#e6f0ff] text-[#004eba] border-[#b8d5ff] text-xs font-mono font-bold">
                  98% Candidate Match
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-[#f8f9fb] border border-[#d4e0ed]">
                  <span className="text-2xl font-bold text-[#006bff]">100%</span>
                  <p className="text-[11px] font-mono text-[#476788] mt-1">Tech Stack</p>
                </div>
                <div className="p-3 rounded-xl bg-[#f8f9fb] border border-[#d4e0ed]">
                  <span className="text-2xl font-bold text-[#006bff]">96%</span>
                  <p className="text-[11px] font-mono text-[#476788] mt-1">Seniority</p>
                </div>
                <div className="p-3 rounded-xl bg-[#f8f9fb] border border-[#d4e0ed]">
                  <span className="text-2xl font-bold text-[#006bff]">98%</span>
                  <p className="text-[11px] font-mono text-[#476788] mt-1">Compensation</p>
                </div>
                <div className="p-3 rounded-xl bg-[#f8f9fb] border border-[#d4e0ed]">
                  <span className="text-2xl font-bold text-emerald-600">100%</span>
                  <p className="text-[11px] font-mono text-[#476788] mt-1">Remote Fit</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {["Kubernetes", "Go", "Terraform", "Distributed Systems", "AWS"].map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded text-xs font-mono font-medium bg-[#f0f3f8] text-[#0b3558] border border-[#d4e0ed]">
                    {tag} • Matched
                  </span>
                ))}
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
