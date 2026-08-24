"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { 
  Bot, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Zap, 
  Terminal, 
  CheckCircle2, 
  Layers, 
  Globe, 
  Server, 
  Sparkles,
  Lock,
  Workflow,
  Search,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { ExecutionSection } from "@/components/landing/execution-section";
import { ArchitectureSection } from "@/components/architecture/architecture-section";
import { ResultCard } from "@/components/result/result-card";
import { ErrorCatalogDemo } from "@/components/execution/blocked-state-card";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1">
        {/* 1. Hero Section (Parallax & Motion Reveal) */}
        <HeroSection />

        {/* 2. "How It Works" Strip (Scroll-Triggered Stagger Reveal) */}
        <section id="how-it-works" className="py-16 border-y border-border/60 bg-muted/30 relative">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className="text-center max-w-2xl mx-auto mb-12"
            >
              <Badge variant="outline" className="mb-2 font-mono text-xs text-primary border-primary/30">
                Agent Lifecycle
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                From Natural Language to Verified Result
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                {
                  step: "01",
                  title: "Specify Goal",
                  desc: "Declare your target task in plain English with optional domain whitelist constraints.",
                  icon: Sparkles,
                },
                {
                  step: "02",
                  title: "Autonomous Planning",
                  desc: "Gemini 2.0 Flash synthesizes DOM accessibility trees into structured tool action sequences.",
                  icon: Cpu,
                },
                {
                  step: "03",
                  title: "Deterministic Execution",
                  desc: "Background worker executes parameterized Playwright tools in an isolated incognito sandbox.",
                  icon: Terminal,
                },
                {
                  step: "04",
                  title: "Automated Verification",
                  desc: "Extracted data is audited against Zod contracts and streamed live via 4 disclosure tiers.",
                  icon: ShieldCheck,
                },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.45, delay: idx * 0.1, ease: "easeOut" }}
                    className="rounded-2xl border border-border/80 bg-card p-5 relative shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-2xl font-bold text-primary/40">{item.step}</span>
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-1.5">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. Execution Section (Sticky / Pinned Behavior) */}
        <ExecutionSection />

        {/* 4. Architecture Section (Vertical-Scroll-Drives-Horizontal-Movement) */}
        <ArchitectureSection />

        {/* 5. Result Showcase Section (Scale / Reveal on Appearance) */}
        <section id="showcase" className="py-16 sm:py-24 relative overflow-hidden">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className="text-center max-w-2xl mx-auto mb-10"
            >
              <Badge variant="outline" className="mb-2 font-mono text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                Verified Outcome
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Structured Result Presentation (Level 1)
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
                Extracted data is automatically verified against typed schema contracts before returning.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-5xl mx-auto"
            >
              <ResultCard />
            </motion.div>
          </div>
        </section>

        {/* 6. Reliability & §26 Error State Showcase */}
        <section id="reliability" className="py-16 sm:py-24 border-t border-border/60 bg-muted/20">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className="text-center max-w-3xl mx-auto mb-12"
            >
              <Badge variant="outline" className="mb-2 font-mono text-xs text-rose-600 dark:text-rose-400 border-rose-500/30">
                Resilience & Compliance
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Human-Readable Diagnostics & Security Barriers
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
                BrowserPilot enforces strict anti-bot compliance: rather than bypassing CAPTCHAs, it halts safely and flags human-readable diagnostics.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="max-w-5xl mx-auto"
            >
              <ErrorCatalogDemo />
            </motion.div>
          </div>
        </section>

        {/* 7. Scale & Telemetry Section (Slow Background Motion) */}
        <section className="py-16 sm:py-20 relative overflow-hidden">
          {/* Slow ambient floating background gradients */}
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[450px] h-[250px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10 animate-ambient-float" />
          <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[350px] h-[200px] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none -z-10 animate-ambient-drift-reverse" />

          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: "Distributed Worker Pool",
                  desc: "Headless Playwright worker instances scale independently on Redis BullMQ queues with heartbeat health checks.",
                  icon: Server,
                  color: "bg-primary/10 text-primary",
                },
                {
                  title: "Zero Memory Leak Guarantee",
                  desc: "Every task lifecycle operates inside an isolated incognito browser context, automatically torn down after execution.",
                  icon: ShieldCheck,
                  color: "bg-emerald-500/10 text-emerald-500",
                },
                {
                  title: "Sub-Second Tool Calls",
                  desc: "Streamlined 8-tool schema minimizes prompt token overhead and delivers rapid sub-500ms Playwright actions.",
                  icon: Zap,
                  color: "bg-amber-500/10 text-amber-500",
                },
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: i * 0.1 }}
                    className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm hover:shadow-md transition-all backdrop-blur-sm"
                  >
                    <div className={`p-3 rounded-xl ${card.color} w-fit mb-4`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-2">{card.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 8. Call to Action (CTA) */}
        <section className="py-16 sm:py-20 border-t border-border/60 bg-gradient-to-b from-card to-background relative overflow-hidden">
          <div className="container mx-auto max-w-5xl px-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 text-primary mb-6">
                <Bot className="h-8 w-8" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                Ready to Orchestrate Autonomous Web Tasks?
              </h2>
              <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Launch the BrowserPilot workspace, enter your goal, and observe deterministic browser automation in real-time.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link href="/app">
                  <Button size="lg" className="gap-2 font-semibold px-8 shadow-lg">
                    Launch BrowserPilot Workspace <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/app">
                  <Button variant="outline" size="lg" className="font-mono text-xs border-border">
                    Explore Live Workspace
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
