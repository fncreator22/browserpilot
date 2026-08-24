"use client";

import { 
  Activity, 
  Cpu, 
  Database, 
  Timer, 
  Layers, 
  CheckCheck, 
  Zap, 
  HardDrive 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WorkerMetricsProps {
  durationSeconds?: number;
  stepsCompleted?: number;
  maxSteps?: number;
  tokensUsed?: number;
  memoryMb?: number;
  confidenceScore?: number;
  status?: string;
}

export function WorkerMetrics({
  durationSeconds = 14.2,
  stepsCompleted = 5,
  maxSteps = 15,
  tokensUsed = 4280,
  memoryMb = 148,
  confidenceScore = 99.2,
  status = "RUNNING",
}: WorkerMetricsProps) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Worker & Performance Metrics (Level 3 Disclosure)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Resource utilization, token consumption, and sandbox runtime statistics
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-[11px] bg-secondary/40">
          Node.js • Playwright Engine
        </Badge>
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Metric 1 */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-mono uppercase">Elapsed</span>
            <Timer className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono tracking-tight text-foreground">
              {durationSeconds}s
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Total runtime</span>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-mono uppercase">Actions</span>
            <Layers className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono tracking-tight text-foreground">
              {stepsCompleted}<span className="text-xs text-muted-foreground font-normal">/{maxSteps}</span>
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Steps executed</span>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-mono uppercase">Tokens</span>
            <Zap className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono tracking-tight text-foreground">
              {tokensUsed.toLocaleString()}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Gemini 2.0 Flash</span>
        </div>

        {/* Metric 4 */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-mono uppercase">RAM Heap</span>
            <Cpu className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono tracking-tight text-foreground">
              {memoryMb} MB
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Worker sandbox</span>
        </div>

        {/* Metric 5 */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-mono uppercase">Confidence</span>
            <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {confidenceScore}%
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Schema match</span>
        </div>

        {/* Metric 6 */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-mono uppercase">Retries</span>
            <Database className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold font-mono tracking-tight text-foreground">
              0 / 2
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Auto-recovery</span>
        </div>
      </div>
    </div>
  );
}
