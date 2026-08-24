"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { 
  Workflow, 
  Database, 
  Cpu, 
  Globe, 
  ShieldCheck, 
  Terminal, 
  Layers, 
  Radio, 
  Bot,
  Lock,
  Boxes,
  Zap,
  ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const RUNTIME_STAGES = [
  {
    step: "01",
    phase: "Client / App Layer",
    title: "Dispatch & Stream",
    desc: "User submits natural language goal. API validates schema with Zod, commits pending record in PostgreSQL, and establishes real-time Server-Sent Events (SSE) telemetry pipeline.",
    tag: "POST /api/jobs → SSE",
    color: "from-primary/20 to-primary/5 text-primary border-primary/30",
    badgeColor: "bg-primary/10 text-primary",
  },
  {
    step: "02",
    phase: "Queue & Orchestration",
    title: "Redis BullMQ Queue",
    desc: "Asynchronous queue buffers tasks, orchestrates priority scheduling, manages worker heartbeats, and guarantees zero UI thread blocking under high load.",
    tag: "BullMQ Distributed Engine",
    color: "from-amber-500/20 to-amber-500/5 text-amber-500 border-amber-500/30",
    badgeColor: "bg-amber-500/10 text-amber-500",
  },
  {
    step: "03",
    phase: "AI Planner & Worker",
    title: "Gemini 2.0 + Playwright",
    desc: "Gemini 2.0 Planner reasons over accessibility DOM trees and dispatches actions from 8 deterministic tools in an isolated incognito browser context.",
    tag: "8 Sandboxed Tools",
    color: "from-emerald-500/20 to-emerald-500/5 text-emerald-500 border-emerald-500/30",
    badgeColor: "bg-emerald-500/10 text-emerald-500",
  },
  {
    step: "04",
    phase: "Verification Engine",
    title: "Schema Assertion",
    desc: "Extracted output is verified against target contracts and criteria. Artifacts and DOM audit snapshots are committed to storage and pushed to client.",
    tag: "Zod Schema Assertions",
    color: "from-blue-500/20 to-blue-500/5 text-blue-500 border-blue-500/30",
    badgeColor: "bg-blue-500/10 text-blue-500",
  },
];

export function ArchitectureSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Vertical scroll drives horizontal movement for the pipeline
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Smooth horizontal translation driven by vertical scroll
  const xTranslate = useTransform(
    scrollYProgress,
    [0.15, 0.85],
    shouldReduceMotion ? ["0%", "0%"] : ["15%", "-25%"]
  );

  return (
    <section id="architecture" className="py-16 sm:py-24 border-t border-border/60 bg-muted/20 overflow-hidden">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="outline" className="mb-3 font-mono text-xs text-primary border-primary/30">
            System Topology
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Engineered for Determinism, Safety & Speed
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
            BrowserPilot partitions autonomous agent reasoning from browser execution via distributed queueing, sandboxed incognito pools, and verifiable schema assertions.
          </p>
        </div>

        <Tabs defaultValue="runtime" className="w-full max-w-5xl mx-auto">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-background border border-border/80 p-1">
              <TabsTrigger value="runtime" className="text-xs sm:text-sm font-mono px-4 py-1.5 gap-2">
                <Workflow className="h-4 w-4" />
                Scroll-Driven Pipeline
              </TabsTrigger>
              <TabsTrigger value="security" className="text-xs sm:text-sm font-mono px-4 py-1.5 gap-2">
                <ShieldCheck className="h-4 w-4" />
                Security Boundaries
              </TabsTrigger>
              <TabsTrigger value="progressive" className="text-xs sm:text-sm font-mono px-4 py-1.5 gap-2">
                <Layers className="h-4 w-4" />
                Progressive Disclosure
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Scroll-driven Horizontal Pipeline */}
          <TabsContent value="runtime">
            <div ref={containerRef} className="relative py-4">
              <div className="text-center mb-4 text-xs font-mono text-muted-foreground flex items-center justify-center gap-1.5">
                <span>Vertical scroll animates horizontal pipeline progression</span>
                <ArrowRight className="h-3 w-3 text-primary animate-pulse" />
              </div>

              {/* Desktop Scroll-Driven Horizontal Motion */}
              <div className="hidden md:block overflow-hidden py-4">
                <motion.div
                  style={{ x: xTranslate }}
                  className="flex gap-6 w-max will-change-transform"
                >
                  {RUNTIME_STAGES.map((stage, idx) => (
                    <motion.div
                      key={stage.step}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: idx * 0.1 }}
                      className="w-[340px] shrink-0"
                    >
                      <Card className={`h-full p-6 border bg-gradient-to-b ${stage.color} backdrop-blur-md flex flex-col justify-between shadow-lg`}>
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <span className={`flex h-9 w-9 items-center justify-center rounded-xl font-mono font-bold text-sm ${stage.badgeColor}`}>
                              {stage.step}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-mono bg-background/80">
                              {stage.phase}
                            </Badge>
                          </div>

                          <h4 className="text-base font-bold text-foreground mb-2">
                            {stage.title}
                          </h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {stage.desc}
                          </p>
                        </div>

                        <div className="mt-6 pt-3 border-t border-border/40 font-mono text-[10px] text-muted-foreground flex items-center justify-between">
                          <span>{stage.tag}</span>
                          <span className="text-foreground font-semibold">Stage {idx + 1}/4</span>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              {/* Mobile Fallback Grid (Zero horizontal overflow/jank) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
                {RUNTIME_STAGES.map((stage, idx) => (
                  <motion.div
                    key={stage.step}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                  >
                    <Card className="p-5 border-border/80 bg-card flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono font-bold text-xs ${stage.badgeColor}`}>
                            {stage.step}
                          </span>
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {stage.phase}
                          </Badge>
                        </div>
                        <h4 className="text-sm font-bold text-foreground">{stage.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          {stage.desc}
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-border/40 font-mono text-[10px] text-muted-foreground">
                        {stage.tag}
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Security */}
          <TabsContent value="security">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  title: "Zero Arbitrary Eval",
                  icon: Lock,
                  color: "text-rose-500 bg-rose-500/10",
                  desc: "No LLM output string is ever passed to eval() or unvalidated page scripts. All actions execute through parameterized, typed Playwright methods.",
                },
                {
                  title: "Domain Whitelisting",
                  icon: ShieldCheck,
                  color: "text-amber-500 bg-amber-500/10",
                  desc: "Worker interceptors enforce network navigation boundaries, preventing cross-origin leaks and blocking internal RFC-1918 subnets.",
                },
                {
                  title: "Ephemeral Contexts",
                  icon: Boxes,
                  color: "text-emerald-500 bg-emerald-500/10",
                  desc: "Incognito browser contexts are spun up fresh per job and destroyed upon completion, preventing lingering cookies or cross-task pollution.",
                },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                  >
                    <Card className="p-5 border-border/80 bg-card/80 h-full">
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div className={`p-2 rounded-lg ${item.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <h4 className="text-sm font-bold text-foreground">{item.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* Tab 3: Progressive Disclosure */}
          <TabsContent value="progressive">
            <div className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                {[
                  { level: "Level 1: Final Answer", color: "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5", desc: "Direct answers, formatted tables, CSV/JSON exports for immediate consumption." },
                  { level: "Level 2: Timeline", color: "text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/5", desc: "Chronological milestone progress with status badges and step durations." },
                  { level: "Level 3: Metrics", color: "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5", desc: "Token usage, runtime latency, worker heap memory, and retry statistics." },
                  { level: "Level 4: Raw Logs", color: "text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/5", desc: "Full Playwright tool invocations, selectors, DOM payloads, and screenshots." },
                ].map((tier, i) => (
                  <motion.div
                    key={tier.level}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: i * 0.08 }}
                    className={`p-3.5 rounded-xl border ${tier.color}`}
                  >
                    <span className="font-mono font-bold block mb-1">{tier.level}</span>
                    <p className="text-muted-foreground text-[11px]">{tier.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
