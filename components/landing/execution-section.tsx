"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Sparkles, Terminal, Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusTimeline, TimelineStep } from "@/components/execution/status-timeline";
import { ScreenshotCard } from "@/components/result/screenshot-card";
import { UplinkExecutionVisualizer, ExecutionState } from "@/components/threeui/uplink-execution-visualizer";

const EXECUTION_DEMO_STEPS: TimelineStep[] = [
  {
    id: "s1",
    name: "Understanding request",
    description: "Gemini 2.5 synthesizes natural language goal into a structured 5-step navigation plan.",
    status: "COMPLETED",
    durationMs: 320,
    toolCall: "ai.planGoal({ goal: 'Extract AI stories' })",
  },
  {
    id: "s2",
    name: "Preparing workflow",
    description: "Spinning up isolated incognito browser context & setting domain whitelist lock.",
    status: "COMPLETED",
    durationMs: 440,
    toolCall: "worker.initSandbox({ allowedDomains: ['news.ycombinator.com'] })",
  },
  {
    id: "s3",
    name: "Opening browser",
    description: "Navigated to target URL and verified DOMContentLoaded event without errors.",
    status: "COMPLETED",
    durationMs: 1120,
    toolCall: "browser.navigate({ url: 'https://news.ycombinator.com' })",
  },
  {
    id: "s4",
    name: "Finding information",
    description: "Inspecting story table rows and extracting titles, authors, and point scores.",
    status: "RUNNING",
    durationMs: 820,
    toolCall: "browser.inspect({ selector: '.athing' })",
  },
  {
    id: "s5",
    name: "Verifying result",
    description: "Schema verification assertion check pending against contract model.",
    status: "PENDING",
  },
];

export function ExecutionSection() {
  const [activeVisualizerState, setActiveVisualizerState] = useState<ExecutionState>("RUNNING");

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
              Execution Demo & ThreeUI Sandbox
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Real-Time Uplink & Pinned Telemetry
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              ThreeUI UplinkLoader visualizes the live WebGL execution link strictly during active job processing.
            </p>
          </div>
          <Link href="/app">
            <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 shadow-xs">
              Launch Workspace <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </motion.div>

        {/* Sticky Grid Layout (§18 / §19) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sticky Left Column: Timeline */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <StatusTimeline steps={EXECUTION_DEMO_STEPS} />
            </motion.div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 font-mono text-xs text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                Live Agent Telemetry Stream
              </span>
              <span className="text-foreground font-semibold">200 OK • SSE</span>
            </div>
          </div>

          {/* Right Column: ThreeUI UplinkLoader & Viewport Snapshot */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Real ThreeUI UplinkLoader Visualizer */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <UplinkExecutionVisualizer
                currentState={activeVisualizerState}
                interactiveControls={true}
                onStateChange={(st) => setActiveVisualizerState(st)}
              />
            </motion.div>

            {/* 2. Viewport Snapshot */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <ScreenshotCard isWorking={activeVisualizerState === "RUNNING"} />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
