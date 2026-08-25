"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Import real UplinkLoader from the dedicated subpath with dynamic loading for Next.js SSR safety
const UplinkLoader = dynamic(
  () => import("@designcodeio/threeui/components/UplinkLoader").then((mod) => mod.UplinkLoader),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#030806] font-mono text-xs text-emerald-500/60">
        <span className="animate-pulse flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          MOUNTING SYS.LINK WEBGL SHADER...
        </span>
      </div>
    ),
  }
);

export type ExecutionState = 
  | "PLANNING"
  | "CONNECTING"
  | "RUNNING"
  | "VERIFYING"
  | "SUCCESS"
  | "BLOCKED";

export interface ExecutionStateConfig {
  state: ExecutionState;
  label: string;
  sysTag: string;
  subtitle: string;
  progressPercent: number;
  badgeClass: string;
  glowColor: string;
  isTerminal: boolean;
}

export const STATE_CONFIG_MAP: Record<ExecutionState, ExecutionStateConfig> = {
  PLANNING: {
    state: "PLANNING",
    label: "AGENT PLANNING",
    sysTag: "SYS.PLAN // SYNTHESIS",
    subtitle: ">_ Gemini 3.6 Flash decomposing goal into structured tool steps...",
    progressPercent: 18,
    badgeClass: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    glowColor: "rgba(245, 158, 11, 0.2)",
    isTerminal: false,
  },
  CONNECTING: {
    state: "CONNECTING",
    label: "WORKER INITIALIZATION",
    sysTag: "SYS.LINK // SANDBOX_INIT",
    subtitle: "Allocating isolated incognito browser context & setting domain locks...",
    progressPercent: 38,
    badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    glowColor: "rgba(6, 182, 212, 0.2)",
    isTerminal: false,
  },
  RUNNING: {
    state: "RUNNING",
    label: "PLAYWRIGHT EXECUTING",
    sysTag: "SYS.RUN // TOOL_DISPATCH",
    subtitle: "Dispatching browser actions (inspect, click, extractText) in sandbox...",
    progressPercent: 68,
    badgeClass: "bg-primary/10 text-primary border-primary/30 animate-pulse",
    glowColor: "rgba(59, 130, 246, 0.25)",
    isTerminal: false,
  },
  VERIFYING: {
    state: "VERIFYING",
    label: "SCHEMA ASSERTION",
    sysTag: "SYS.VERIFY // ZOD_CONTRACT",
    subtitle: "Auditing extracted data payload against target Zod schema contracts...",
    progressPercent: 88,
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    glowColor: "rgba(168, 85, 247, 0.2)",
    isTerminal: false,
  },
  SUCCESS: {
    state: "SUCCESS",
    label: "TASK COMPLETE",
    sysTag: "SYS.DONE // PAYLOAD_READY",
    subtitle: "All actions verified with 100% schema match. Telemetry committed.",
    progressPercent: 100,
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    glowColor: "rgba(16, 185, 129, 0.25)",
    isTerminal: true,
  },
  BLOCKED: {
    state: "BLOCKED",
    label: "BLOCKED (§26 WALL)",
    sysTag: "SYS.HALT // BOT_CHALLENGE",
    subtitle: "Anti-bot verification wall encountered. Zero-bypass policy enforced.",
    progressPercent: 68,
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    glowColor: "rgba(244, 63, 94, 0.25)",
    isTerminal: true,
  },
};

interface UplinkExecutionVisualizerProps {
  currentState?: ExecutionState;
  interactiveControls?: boolean;
  onStateChange?: (state: ExecutionState) => void;
  className?: string;
}

export function UplinkExecutionVisualizer({
  currentState = "RUNNING",
  interactiveControls = false,
  onStateChange,
  className = "",
}: UplinkExecutionVisualizerProps) {
  const [internalOverride, setInternalOverride] = useState<ExecutionState | null>(null);

  const activeState = internalOverride ?? currentState;

  const handleStateSelect = (newState: ExecutionState) => {
    setInternalOverride(newState);
    onStateChange?.(newState);
  };

  const config = STATE_CONFIG_MAP[activeState] || STATE_CONFIG_MAP.RUNNING;

  return (
    <div className={`overflow-hidden rounded-2xl border border-border/80 bg-[#030806] shadow-2xl relative ${className}`}>
      {/* 1. Header HUD Overlay */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#030806]/80 px-4 py-2.5 backdrop-blur-md z-10 relative">
        <div className="flex items-center gap-2.5">
          <div className="flex h-2.5 w-2.5 items-center justify-center">
            <span
              className={`h-2 w-2 rounded-full ${
                activeState === "BLOCKED"
                  ? "bg-rose-500 animate-ping"
                  : activeState === "SUCCESS"
                  ? "bg-emerald-500"
                  : "bg-primary animate-pulse"
              }`}
            />
          </div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
            {config.sysTag}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`font-mono text-[10px] uppercase font-semibold ${config.badgeClass}`}
          >
            {config.label}
          </Badge>
          <span className="font-mono text-[11px] text-white/50">
            {config.progressPercent}%
          </span>
        </div>
      </div>

      {/* 2. Real ThreeUI UplinkLoader Canvas (Protected Black Box) */}
      <div className="relative h-[220px] sm:h-[260px] w-full">
        {/* Render real UplinkLoader component */}
        <UplinkLoader className="h-full w-full" />

        {/* Tactical Scanline & Vignette Overlay per §19 */}
        <div className="pointer-events-none absolute inset-0 scanlines opacity-40" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#030806] via-transparent to-[#030806]/40" />

        {/* Telemetry Center HUD Overlay */}
        <div className="absolute inset-x-4 bottom-3 z-10 flex flex-col gap-1.5 rounded-xl border border-white/10 bg-[#030806]/80 p-3 backdrop-blur-md">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-white/80 flex items-center gap-1.5">
              <Terminal className="h-3 w-3 text-emerald-400" />
              {config.subtitle}
            </span>
            <span className="text-emerald-400 font-bold hidden sm:inline">
              [TELEMETRY_LINK_ESTABLISHED]
            </span>
          </div>

          {/* Progress Bar Gauge */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full transition-all duration-700 ease-out ${
                activeState === "BLOCKED"
                  ? "bg-rose-500"
                  : activeState === "SUCCESS"
                  ? "bg-emerald-500"
                  : "bg-gradient-to-r from-cyan-500 via-primary to-emerald-400"
              }`}
              style={{ width: `${config.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Interactive State Stepper Controls (Optional Testing Bar) */}
      {interactiveControls && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#060e0b] px-4 py-2.5 text-xs font-mono">
          <span className="text-white/60 text-[11px]">Override State:</span>
          <div className="flex flex-wrap gap-1">
            {(["PLANNING", "CONNECTING", "RUNNING", "VERIFYING", "SUCCESS", "BLOCKED"] as ExecutionState[]).map(
              (st) => (
                <button
                  key={st}
                  onClick={() => handleStateSelect(st)}
                  className={`rounded px-2 py-0.5 text-[10px] transition-all border ${
                    activeState === st
                      ? "bg-emerald-500 text-black font-bold border-emerald-400 shadow-xs"
                      : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {st}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
