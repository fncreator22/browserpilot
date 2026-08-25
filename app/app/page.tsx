"use client";

import { motion } from "motion/react";
import { 
  Bot, 
  Sparkles, 
  ShieldCheck, 
  Terminal, 
  Cpu, 
  Lock, 
  Zap 
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { TaskInput } from "@/components/agent/task-input";

export default function AppPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-10">
        {/* Header Title Bar */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Autonomous Task Dispatcher
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Define target goals, configure domain whitelists, and launch sandboxed browser agent executions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 font-mono text-xs flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Sandbox Status:</span>
              <span className="font-semibold text-foreground">Ready</span>
            </div>
          </div>
        </motion.div>

        {/* Primary Task Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-4xl mx-auto space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-foreground font-mono flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              New Autonomous Goal
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              Ephemerality: 24h Auto-Purge Active
            </span>
          </div>

          <TaskInput />
        </motion.div>

        {/* Architecture & Sandbox Isolation Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4"
        >
          <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Ephemeral Sandbox
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every job executes in a fresh, isolated incognito Playwright browser context with zero cross-session state leakage.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold">
              <Lock className="h-4 w-4" />
              24-Hour Auto-Purge
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All terminal job records, observations, and screenshot artifacts are automatically purged from disk 24 hours after completion.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold">
              <Terminal className="h-4 w-4" />
              Real-Time Telemetry
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              4-level progressive disclosure provides live shader states, Playwright tool steps, token counts, and verified DOM outputs.
            </p>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
