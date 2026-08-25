"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { Sparkles, CheckCircle2, Bot, ArrowRight, ShieldCheck, Terminal, Cpu } from "lucide-react";
import { TaskInput } from "@/components/agent/task-input";

export function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Parallax shifts for ambient background elements
  const bgGlowY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [0, 80]);
  const bgGlowScale = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [1, 1] : [1, 1.15]);
  const heroContentY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [0, -30]);

  return (
    <section ref={heroRef} className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
      {/* Ambient Parallax Gradient Backgrounds */}
      <motion.div
        style={{ y: bgGlowY, scale: bgGlowScale }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[380px] bg-primary/10 blur-[130px] rounded-full pointer-events-none -z-10 animate-ambient-float will-change-transform"
      />
      <motion.div
        style={{ y: bgGlowY }}
        className="absolute top-1/3 left-1/4 w-[350px] h-[220px] bg-emerald-500/10 blur-[110px] rounded-full pointer-events-none -z-10 animate-ambient-drift-reverse will-change-transform"
      />

      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div style={{ y: heroContentY }} className="text-center max-w-3xl mx-auto mb-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-mono text-primary mb-6 shadow-xs backdrop-blur-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Next-Gen Autonomous Web Agent</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-foreground font-semibold">Gemini 2.5 + Playwright</span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.12]"
          >
            Deterministic Browser Automation,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-500 to-teal-400">
              Autonomously Verified.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2, ease: "easeOut" }}
            className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed"
          >
            BrowserPilot turns high-level natural language goals into sandboxed, multi-step browser interactions with zero arbitrary JavaScript injection and real-time progressive disclosure telemetry.
          </motion.p>
        </motion.div>

        {/* Interactive Hero Task Input with Entrance Motion */}
        <motion.div
          initial={{ opacity: 0, y: 25, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl mx-auto"
        >
          <TaskInput />
        </motion.div>

        {/* Quick Badges Strip */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground font-mono"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>8 Sandboxed v1 Tools</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Zero `eval()` Policy</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Redis BullMQ Queue</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Server-Sent Events (SSE)</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
