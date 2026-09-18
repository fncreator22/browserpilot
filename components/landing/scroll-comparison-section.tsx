"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { 
  motion, 
  useScroll, 
  useTransform, 
  useSpring,
  useMotionValueEvent,
  useReducedMotion
} from "motion/react";
import { 
  ShieldCheck, 
  Users, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Zap, 
  Activity, 
  SlidersHorizontal,
  Clock,
  Radio,
  FileCheck2,
  AlertTriangle,
  MailCheck,
  SendHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComparisonStage {
  id: string;
  stepNumber: string;
  tag: string;
  title: string;
  subtitle: string;
  metricLabel: string;
  bpMetric: string;
  tradMetric: string;
  bpDetails: string[];
  tradDetails: string[];
  portalBadge: string;
}

const COMPARISON_STAGES: ComparisonStage[] = [
  {
    id: "speed",
    stepNumber: "01",
    tag: "DISCOVERY VELOCITY",
    title: "Continuous Radar vs 48-Hour Aggregator Delay",
    subtitle: "Requisition Discovery & Rapid Early Application",
    metricLabel: "Average Detection Latency",
    bpMetric: "90 Seconds",
    tradMetric: "36 to 48 Hours",
    bpDetails: [
      "Direct API polling on official Greenhouse, Ashby, Lever, and Workday endpoints",
      "Immediate device alert when requisition opens in employer internal ATS",
      "First 25 applicants capture 82% of all scheduled interview screens"
    ],
    tradDetails: [
      "Third-party batch crawlers index jobs 1 to 2 days after publication",
      "Application queue already exceeds 400+ submissions before listing appears",
      "Sub-2% screen rate due to resume overload and candidate exhaustion"
    ],
    portalBadge: "Greenhouse & Ashby Direct Hooks"
  },
  {
    id: "ghosts",
    stepNumber: "02",
    tag: "ENDPOINT INTEGRITY",
    title: "100% Active Endpoints vs 38% Ghost Listings",
    subtitle: "ATS Endpoint Integrity & Stale Requisition Pruning",
    metricLabel: "Ghost Job Exclusion Rate",
    bpMetric: "0% Ghost Postings",
    tradMetric: "38.4% Phantom Roles",
    bpDetails: [
      "Live HTTP 200 handshake confirms requisition is actively accepting candidates",
      "Automatic real-time pruning the millisecond a job is filled, frozen, or closed",
      "Zero placeholder listings or resume-hoarding postings allowed into feed"
    ],
    tradDetails: [
      "Up to 40% of listings are stale, cancelled, or evergreen placeholder postings",
      "Candidates spend hours filling custom applications for roles already filled",
      "Expired forms result in automated silent rejections without review"
    ],
    portalBadge: "Deterministic Verification"
  },
  {
    id: "deepreach",
    stepNumber: "03",
    tag: "RECRUITER INTELLIGENCE",
    title: "Direct Recruiter Reach vs ATS Black Holes",
    subtitle: "DeepReach Hiring Lead Directory & Verified Contacts",
    metricLabel: "Recruiter Phone Screen Rate",
    bpMetric: "82% Screen Rate",
    tradMetric: "Sub-2% Response",
    bpDetails: [
      "Direct identity resolution for engineering directors and lead recruiters",
      "100% verified corporate work emails with SMTP handshake confirmation",
      "Tailored pitch angles matched to team tech stack and architecture"
    ],
    tradDetails: [
      "Resumes pass through automated keyword filters rejecting 75% of qualified applicants",
      "No direct contact details for hiring managers or technical leads",
      "Generic unmonitored automated receipts with zero human visibility"
    ],
    portalBadge: "SMTP Handshake Confirmed"
  }
];

const ATS_PLUGINS = [
  { name: "Greenhouse API", status: "Active 60s Polling", latency: "142ms", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { name: "Ashby HQ Webhook", status: "Sub-Second Ingestion", latency: "89ms", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { name: "Lever Requisitions", status: "Real-time Verification", latency: "164ms", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { name: "Workday Enterprise", status: "Isolated Worker Pool", latency: "310ms", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { name: "SmartRecruiters", status: "Continuous REST Stream", latency: "195ms", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { name: "Jobvite Enterprise", status: "Direct Feed Handshake", latency: "215ms", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { name: "Public Job Boards", status: "Delayed Crawl Queue", latency: "36h to 48h", color: "text-rose-700 bg-rose-50 border-rose-200" }
];

export function ScrollComparisonSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [scrubPercent, setScrubPercent] = useState(0);

  // 1. Pin Animation & Scroll-Linked Progression
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Spring physics for butter-smooth scrubbing
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 26,
    restDelta: 0.001
  });

  const shouldReduceMotion = useReducedMotion();
  const activeProgress = shouldReduceMotion ? scrollYProgress : smoothProgress;

  // Dynamic stage state and scrub readout listener
  useMotionValueEvent(activeProgress, "change", (latest) => {
    setScrubPercent(Math.round(latest * 100));
    if (latest < 0.33) {
      setActiveStageIndex(0);
    } else if (latest < 0.66) {
      setActiveStageIndex(1);
    } else {
      setActiveStageIndex(2);
    }
  });

  // 2. Parallax Effect Transforms (Background 0.5x, Midground 1.0x, Foreground 1.4x)
  const backgroundY = useTransform(activeProgress, [0, 1], [-30, 45]);
  const foregroundY = useTransform(activeProgress, [0, 1], [40, -80]);

  // 3. Horizontal Scroll Transform (Vertical wheel input -> Horizontal runway output)
  const horizontalTrackX = useTransform(activeProgress, [0.05, 0.95], ["0%", "-52%"]);

  // 4. 3D Animation Stack Transforms (Scale, Translation, Rotation, and Opacity)
  // Card 1 (Speed): In foreground initially, tilts back and scales down as user scrubs
  const card1Scale = useTransform(activeProgress, [0, 0.33, 0.66], [1, 0.94, 0.88]);
  const card1Y = useTransform(activeProgress, [0, 0.33, 0.66], [0, -18, -36]);
  const card1RotateX = useTransform(activeProgress, [0, 0.33, 0.66], shouldReduceMotion ? [0, 0, 0] : [0, 3, 6]);
  const card1Opacity = useTransform(activeProgress, [0, 0.38, 0.52], [1, 0.75, 0]);

  // Card 2 (Ghost Shield): Rises up, takes center stage, then tilts back
  const card2Scale = useTransform(activeProgress, [0.18, 0.38, 0.66, 0.95], [0.92, 1, 1, 0.92]);
  const card2Y = useTransform(activeProgress, [0.18, 0.38, 0.66, 0.95], [60, 0, 0, -22]);
  const card2RotateX = useTransform(activeProgress, [0.18, 0.38, 0.66, 0.95], shouldReduceMotion ? [0, 0, 0] : [4, 0, 0, 3]);
  const card2Opacity = useTransform(activeProgress, [0.18, 0.32, 0.7, 0.86], [0, 1, 1, 0]);

  // Card 3 (DeepReach): Rises to complete the stack with primary CTA
  const card3Scale = useTransform(activeProgress, [0.52, 0.72, 1], [0.92, 1, 1]);
  const card3Y = useTransform(activeProgress, [0.52, 0.72, 1], [60, 0, 0]);
  const card3RotateX = useTransform(activeProgress, [0.52, 0.72, 1], shouldReduceMotion ? [0, 0, 0] : [4, 0, 0]);
  const card3Opacity = useTransform(activeProgress, [0.52, 0.68], [0, 1]);

  // Smooth scroll jump to stage offset when clicking HUD pill
  const scrollToStage = (stageIdx: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const containerTop = rect.top + scrollTop;
    const scrollableDistance = containerRef.current.offsetHeight - window.innerHeight;
    const targetOffset = containerTop + (stageIdx / (COMPARISON_STAGES.length - 0.2)) * scrollableDistance;
    window.scrollTo({
      top: targetOffset,
      behavior: "smooth"
    });
  };

  return (
    <section 
      ref={containerRef} 
      className="relative min-h-[340vh] sm:min-h-[320vh] bg-[#f8f9fb] border-t border-[#d4e0ed] select-none"
      id="comparison"
    >
      {/* Pin Animation: Pinned sticky viewport container */}
      <div className="sticky top-16 md:top-20 h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] flex flex-col justify-between overflow-hidden px-3 sm:px-6 lg:px-8 py-3 md:py-4">
        
        {/* Parallax Background Ambient Atmosphere (0.5x Speed) */}
        <motion.div 
          style={{ y: backgroundY }}
          className="absolute inset-0 pointer-events-none -z-10 overflow-hidden"
        >
          <div className="absolute -top-24 left-1/4 w-[600px] h-[600px] bg-[#006bff]/5 rounded-full blur-[140px]" />
          <div className="absolute top-1/2 right-10 w-[500px] h-[500px] bg-[#0099ff]/5 rounded-full blur-[120px]" />
          <div className="absolute inset-0 bg-[radial-gradient(#d4e0ed_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
        </motion.div>

        {/* Top Pinned Telemetry & Scroll Progression HUD */}
        <div className="max-w-[1240px] w-full mx-auto space-y-2.5 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#d4e0ed]">
            <div className="flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-[#006bff] animate-ping" />
              <span className="font-mono text-xs font-bold text-[#0b3558] tracking-wide uppercase">
                Interactive Comparison Matrix
              </span>
              <span className="hidden md:inline text-xs text-[#476788]">
                Autonomous Radar vs Traditional Aggregators
              </span>
            </div>

            {/* Reactive Stage Indicators (Active Highlighting & Click-to-Scrub) */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {COMPARISON_STAGES.map((stage, idx) => {
                const isActive = activeStageIndex === idx;
                return (
                  <button 
                    key={stage.id}
                    type="button"
                    onClick={() => scrollToStage(idx)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono transition-all duration-300 cursor-pointer ${
                      isActive 
                        ? "border border-[#006bff] bg-[#f0f7ff] text-[#006bff] font-bold shadow-xs ring-2 ring-[#006bff]/20" 
                        : "border border-[#d4e0ed] bg-white text-[#476788] hover:text-[#0b3558] hover:border-[#b8d5ff]"
                    }`}
                  >
                    <span className={isActive ? "text-[#006bff] font-extrabold" : "text-[#476788]"}>
                      {stage.stepNumber}
                    </span>
                    <span className="hidden lg:inline">{stage.tag}</span>
                  </button>
                );
              })}

              {/* Live Scrub Telemetry Readout */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#d4e0ed] text-[10px] font-mono text-[#476788]">
                <span>Scrub:</span>
                <span className="text-[#006bff] font-bold">{scrubPercent}%</span>
              </div>
            </div>
          </div>

          {/* Scroll Progression Indicator Bar */}
          <div className="w-full h-1 bg-[#e2eaf2] rounded-full overflow-hidden">
            <motion.div 
              style={{ scaleX: smoothProgress, transformOrigin: "left" }}
              className="h-full bg-[#006bff] rounded-full"
            />
          </div>
        </div>

        {/* Centerpiece 3D Animation Stack Viewport */}
        <div className="relative w-full max-w-[1240px] mx-auto flex-1 flex items-center justify-center my-1 sm:my-2 [perspective:1200px]">
          
          {/* STACK CARD 1: Discovery Velocity */}
          <motion.div 
            style={{ 
              scale: card1Scale,
              y: card1Y,
              rotateX: card1RotateX,
              opacity: card1Opacity,
              transformStyle: "preserve-3d"
            }}
            className={`w-full absolute inset-x-0 mx-auto ${activeStageIndex === 0 ? "pointer-events-auto z-30" : "pointer-events-none z-10"}`}
          >
            <div className="rounded-2xl sm:rounded-3xl border border-[#d4e0ed] bg-white/95 backdrop-blur-md p-3 sm:p-6 lg:p-7 shadow-marble-3 space-y-2.5 sm:space-y-4">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 sm:pb-2.5 border-b border-[#f0f3f8]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] sm:text-xs font-bold text-[#006bff]">STAGE 01</span>
                    <span className="text-[10px] sm:text-[11px] font-mono text-[#476788] bg-[#f0f3f8] px-2 py-0.5 rounded">
                      {COMPARISON_STAGES[0].tag}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-xl lg:text-2xl font-bold text-[#0b3558] tracking-tight mt-0.5">
                    {COMPARISON_STAGES[0].title}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs text-[#0b3558] bg-[#f0f7ff] border border-[#b8d5ff] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
                  <Activity className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-[#006bff] animate-pulse" />
                  <span>{COMPARISON_STAGES[0].portalBadge}</span>
                </div>
              </div>

              {/* Balanced 2-Column Comparison Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4 lg:gap-6 items-stretch">
                
                {/* Left: Traditional Aggregators */}
                <div className="rounded-xl border border-rose-200/80 bg-rose-50/25 p-2.5 sm:p-4 lg:p-5 flex flex-col justify-between space-y-2 sm:space-y-3.5">
                  <div className="space-y-1.5 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] sm:text-xs font-bold text-rose-800 uppercase tracking-wider">Traditional Aggregators</span>
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-rose-700 bg-white border border-rose-200 px-2 py-0.5 rounded-full">
                        {COMPARISON_STAGES[0].tradMetric}
                      </span>
                    </div>

                    <ul className="space-y-1 sm:space-y-2 text-[11px] sm:text-xs text-[#476788]">
                      {COMPARISON_STAGES[0].tradDetails.map((item, i) => (
                        <li key={i} className={`items-start gap-1.5 ${i === 2 ? "hidden sm:flex" : "flex"}`}>
                          <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span className="leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Purpose-Built Status Widget (Visible on tablet/desktop) */}
                  <div className="hidden sm:block rounded-lg border border-rose-200/60 bg-white p-3 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-[#476788]">
                      <span className="flex items-center gap-1.5 text-rose-700 font-semibold">
                        <Clock className="h-3.5 w-3.5" />
                        Batch Crawler Delay
                      </span>
                      <span className="text-[11px] text-rose-600 font-bold">+48h Latency</span>
                    </div>
                    <div className="text-[11px] text-[#476788] bg-rose-50/60 p-2 rounded border border-rose-100">
                      Requisition: Distributed Systems Engineer (482 submissions logged. Application queue capped.)
                    </div>
                  </div>
                </div>

                {/* Right: BrowserPilot Autonomous Radar */}
                <div className="rounded-xl border border-[#b8d5ff] bg-[#f0f7ff]/35 p-2.5 sm:p-4 lg:p-5 flex flex-col justify-between space-y-2 sm:space-y-3.5 shadow-xs">
                  <div className="space-y-1.5 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] sm:text-xs font-bold text-[#006bff] uppercase tracking-wider">BrowserPilot Autonomous Radar</span>
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5 rounded-full">
                        {COMPARISON_STAGES[0].bpMetric}
                      </span>
                    </div>

                    <ul className="space-y-1 sm:space-y-2 text-[11px] sm:text-xs text-[#0b3558]">
                      {COMPARISON_STAGES[0].bpDetails.map((item, i) => (
                        <li key={i} className={`items-start gap-1.5 ${i === 2 ? "hidden sm:flex" : "flex"}`}>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Purpose-Built Status Widget (Visible on tablet/desktop) */}
                  <div className="hidden sm:block rounded-lg border border-[#b8d5ff] bg-white p-3 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-[#0b3558]">
                      <span className="flex items-center gap-1.5 text-[#006bff] font-semibold">
                        <Radio className="h-3.5 w-3.5 animate-pulse" />
                        Live Greenhouse & Ashby Webhook
                      </span>
                      <span className="text-[11px] text-emerald-600 font-bold">90s Ingestion</span>
                    </div>
                    <div className="text-[11px] text-[#0b3558] bg-[#f0f7ff] p-2 rounded border border-[#b8d5ff]">
                      Requisition: Staff Infrastructure Engineer @ Stripe (Applicant #3. Priority screen window active.)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* STACK CARD 2: Ghost Job Elimination */}
          <motion.div 
            style={{ 
              scale: card2Scale,
              y: card2Y,
              rotateX: card2RotateX,
              opacity: card2Opacity,
              transformStyle: "preserve-3d"
            }}
            className={`w-full absolute inset-x-0 mx-auto ${activeStageIndex === 1 ? "pointer-events-auto z-30" : "pointer-events-none z-20"}`}
          >
            <div className="rounded-2xl sm:rounded-3xl border border-[#d4e0ed] bg-white/95 backdrop-blur-md p-3 sm:p-6 lg:p-7 shadow-marble-3 space-y-2.5 sm:space-y-4">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 sm:pb-2.5 border-b border-[#f0f3f8]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] sm:text-xs font-bold text-[#006bff]">STAGE 02</span>
                    <span className="text-[10px] sm:text-[11px] font-mono text-[#476788] bg-[#f0f3f8] px-2 py-0.5 rounded">
                      {COMPARISON_STAGES[1].tag}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-xl lg:text-2xl font-bold text-[#0b3558] tracking-tight mt-0.5">
                    {COMPARISON_STAGES[1].title}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
                  <ShieldCheck className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-emerald-600" />
                  <span>{COMPARISON_STAGES[1].portalBadge}</span>
                </div>
              </div>

              {/* Balanced 2-Column Comparison Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4 lg:gap-6 items-stretch">
                
                {/* Left: Traditional Aggregators */}
                <div className="rounded-xl border border-rose-200/80 bg-rose-50/25 p-2.5 sm:p-4 lg:p-5 flex flex-col justify-between space-y-2 sm:space-y-3.5">
                  <div className="space-y-1.5 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] sm:text-xs font-bold text-rose-800 uppercase tracking-wider">Public Aggregators</span>
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-rose-700 bg-white border border-rose-200 px-2 py-0.5 rounded-full">
                        {COMPARISON_STAGES[1].tradMetric}
                      </span>
                    </div>

                    <ul className="space-y-1 sm:space-y-2 text-[11px] sm:text-xs text-[#476788]">
                      {COMPARISON_STAGES[1].tradDetails.map((item, i) => (
                        <li key={i} className={`items-start gap-1.5 ${i === 2 ? "hidden sm:flex" : "flex"}`}>
                          <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span className="leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Purpose-Built Status Widget (Visible on tablet/desktop) */}
                  <div className="hidden sm:block rounded-lg border border-rose-200/60 bg-white p-3 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-[#476788]">
                      <span className="flex items-center gap-1.5 text-rose-700 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Phantom Requisition Alert
                      </span>
                      <span className="text-[11px] text-rose-600 font-bold">Stale 68%</span>
                    </div>
                    <div className="text-[11px] text-[#476788] bg-rose-50/60 p-2 rounded border border-rose-100">
                      HTTP 302 Expired Redirect: Role filled 4 months ago. Evergreen resume harvester.
                    </div>
                  </div>
                </div>

                {/* Right: BrowserPilot Autonomous Radar */}
                <div className="rounded-xl border border-[#b8d5ff] bg-[#f0f7ff]/35 p-2.5 sm:p-4 lg:p-5 flex flex-col justify-between space-y-2 sm:space-y-3.5 shadow-xs">
                  <div className="space-y-1.5 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] sm:text-xs font-bold text-[#006bff] uppercase tracking-wider">BrowserPilot Endpoint Shield</span>
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5 rounded-full">
                        {COMPARISON_STAGES[1].bpMetric}
                      </span>
                    </div>

                    <ul className="space-y-1 sm:space-y-2 text-[11px] sm:text-xs text-[#0b3558]">
                      {COMPARISON_STAGES[1].bpDetails.map((item, i) => (
                        <li key={i} className={`items-start gap-1.5 ${i === 2 ? "hidden sm:flex" : "flex"}`}>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Purpose-Built Status Widget (Visible on tablet/desktop) */}
                  <div className="hidden sm:block rounded-lg border border-[#b8d5ff] bg-white p-3 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-[#0b3558]">
                      <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                        <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                        Cryptographic Endpoint Fingerprint
                      </span>
                      <span className="text-[11px] text-emerald-600 font-bold">HTTP 200 OK</span>
                    </div>
                    <div className="text-[11px] text-[#0b3558] bg-[#f0f7ff] p-2 rounded border border-[#b8d5ff]">
                      Requisition: Principal Architect @ Datadog (Active capacity: 2 seats. 0% ghost probability.)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* STACK CARD 3: Direct Recruiter Reach */}
          <motion.div 
            style={{ 
              scale: card3Scale,
              y: card3Y,
              rotateX: card3RotateX,
              opacity: card3Opacity,
              transformStyle: "preserve-3d"
            }}
            className={`w-full absolute inset-x-0 mx-auto ${activeStageIndex === 2 ? "pointer-events-auto z-30" : "pointer-events-none z-10"}`}
          >
            <div className="rounded-2xl sm:rounded-3xl border border-[#d4e0ed] bg-white/95 backdrop-blur-md p-3 sm:p-6 lg:p-7 shadow-marble-3 space-y-2.5 sm:space-y-4">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 sm:pb-2.5 border-b border-[#f0f3f8]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] sm:text-xs font-bold text-[#006bff]">STAGE 03</span>
                    <span className="text-[10px] sm:text-[11px] font-mono text-[#476788] bg-[#f0f3f8] px-2 py-0.5 rounded">
                      {COMPARISON_STAGES[2].tag}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-xl lg:text-2xl font-bold text-[#0b3558] tracking-tight mt-0.5">
                    {COMPARISON_STAGES[2].title}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs text-[#006bff] bg-[#f0f7ff] border border-[#b8d5ff] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
                  <Users className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-[#006bff]" />
                  <span>{COMPARISON_STAGES[2].portalBadge}</span>
                </div>
              </div>

              {/* Balanced 2-Column Comparison Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4 lg:gap-6 items-stretch">
                
                {/* Left: Traditional Aggregators */}
                <div className="rounded-xl border border-rose-200/80 bg-rose-50/25 p-2.5 sm:p-4 lg:p-5 flex flex-col justify-between space-y-2 sm:space-y-3.5">
                  <div className="space-y-1.5 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] sm:text-xs font-bold text-rose-800 uppercase tracking-wider">Public ATS Gatekeepers</span>
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-rose-700 bg-white border border-rose-200 px-2 py-0.5 rounded-full">
                        {COMPARISON_STAGES[2].tradMetric}
                      </span>
                    </div>

                    <ul className="space-y-1 sm:space-y-2 text-[11px] sm:text-xs text-[#476788]">
                      {COMPARISON_STAGES[2].tradDetails.map((item, i) => (
                        <li key={i} className={`items-start gap-1.5 ${i === 2 ? "hidden sm:flex" : "flex"}`}>
                          <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span className="leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Purpose-Built Status Widget (Visible on tablet/desktop) */}
                  <div className="hidden sm:block rounded-lg border border-rose-200/60 bg-white p-3 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-[#476788]">
                      <span className="flex items-center gap-1.5 text-rose-700 font-semibold">
                        <XCircle className="h-3.5 w-3.5" />
                        Inbound Resume Black Hole
                      </span>
                      <span className="text-[11px] text-rose-600 font-bold">Cold Rate: &lt;2%</span>
                    </div>
                    <div className="text-[11px] text-[#476788] bg-rose-50/60 p-2 rounded border border-rose-100">
                      Unmonitored portal queue: Position #489. Filtered by uncalibrated keyword parser.
                    </div>
                  </div>
                </div>

                {/* Right: BrowserPilot Autonomous Radar */}
                <div className="rounded-xl border border-[#b8d5ff] bg-[#f0f7ff]/35 p-2.5 sm:p-4 lg:p-5 flex flex-col justify-between space-y-2 sm:space-y-3.5 shadow-xs">
                  <div className="space-y-1.5 sm:space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] sm:text-xs font-bold text-[#006bff] uppercase tracking-wider">DeepReach Recruiter Dossier</span>
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-[#006bff] bg-white border border-[#b8d5ff] px-2 py-0.5 rounded-full">
                        {COMPARISON_STAGES[2].bpMetric}
                      </span>
                    </div>

                    <ul className="space-y-1 sm:space-y-2 text-[11px] sm:text-xs text-[#0b3558]">
                      {COMPARISON_STAGES[2].bpDetails.map((item, i) => (
                        <li key={i} className={`items-start gap-1.5 ${i === 2 ? "hidden sm:flex" : "flex"}`}>
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#006bff] shrink-0 mt-0.5" />
                          <span className="leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Purpose-Built Status Widget with Action */}
                  <div className="rounded-lg border border-[#b8d5ff] bg-white p-2.5 sm:p-3 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-[#0b3558]">
                      <span className="flex items-center gap-1.5 text-[#006bff] font-semibold text-[11px] sm:text-xs">
                        <MailCheck className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-[#006bff]" />
                        Sarah Lin (VP Infrastructure)
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-[#006bff] font-bold">SMTP Verified</span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#f0f4f8]">
                      <span className="text-[10px] sm:text-[11px] text-[#476788] truncate">
                        slin@stripe.com • Direct Match
                      </span>
                      <Link href="/login">
                        <Button 
                          size="sm"
                          className="h-6 sm:h-7 px-2.5 sm:px-3 rounded bg-[#006bff] hover:bg-[#006bff]/90 text-white font-semibold text-[10px] sm:text-[11px] shadow-xs gap-1 cursor-pointer shrink-0"
                        >
                          <span>Launch Outreach</span>
                          <SendHorizontal className="h-2.5 sm:h-3 w-2.5 sm:w-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Pinned Horizontal Multi-Portal Track (Horizontal Scroll Runway) */}
        <div className="max-w-[1240px] w-full mx-auto shrink-0 pt-2 border-t border-[#d4e0ed]">
          <div className="flex items-center justify-between text-xs text-[#476788] mb-1.5 font-mono">
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#006bff]" />
              <span className="font-bold text-[#0b3558]">LIVE ATS CONNECTOR LATENCY RUNWAY</span>
            </span>
            <span className="text-[11px] text-[#006bff] font-semibold hidden sm:inline">
              Vertical wheel input scrubs connector ecosystem horizontally
            </span>
          </div>

          <div className="overflow-hidden relative w-full">
            <motion.div 
              style={{ x: horizontalTrackX }}
              className="flex items-center gap-2.5 w-max py-0.5"
            >
              {ATS_PLUGINS.map((portal, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#d4e0ed] bg-white text-xs shadow-xs shrink-0"
                >
                  <span className="font-bold text-[#0b3558]">{portal.name}</span>
                  <span className="text-[11px] text-[#476788]">{portal.status}</span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${portal.color}`}>
                    {portal.latency}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Foreground Floating Parallax Badge (1.4x Speed Depth Layer) */}
        <motion.div 
          style={{ y: foregroundY }}
          className="hidden xl:block absolute right-10 bottom-24 pointer-events-none z-40"
        >
          <div className="rounded-2xl border border-[#b8d5ff] bg-white/95 backdrop-blur-md p-3.5 shadow-marble-2 text-xs space-y-1 max-w-xs">
            <div className="flex items-center gap-2 text-[#006bff] font-bold">
              <Zap className="h-3.5 w-3.5" />
              <span>Real-Time Differential</span>
            </div>
            <p className="text-[11px] text-[#476788] leading-relaxed">
              BrowserPilot candidates submit before aggregator crawlers start batch indexing.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
