"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { 
  Bot, 
  Search, 
  Layers, 
  ShieldCheck, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  Compass
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SearchProgressProps {
  query: string;
}

interface SearchStage {
  id: string;
  label: string;
  description: string;
  icon: typeof Search;
  estimatedDurationMs: number;
}

const SEARCH_STAGES: SearchStage[] = [
  {
    id: "intent",
    label: "Understanding Request",
    description: "Extracting role, location, work mode, and freshness constraints",
    icon: Compass,
    estimatedDurationMs: 600,
  },
  {
    id: "plan",
    label: "Planning Search",
    description: "Selecting optimal target ATS sources and retrieval tools",
    icon: Bot,
    estimatedDurationMs: 900,
  },
  {
    id: "harvest",
    label: "Searching Sources",
    description: "Querying multi-source platforms and job boards",
    icon: Search,
    estimatedDurationMs: 1400,
  },
  {
    id: "verify",
    label: "Verifying Opportunities",
    description: "Running evidence Quality Gate checks and freshness gating",
    icon: ShieldCheck,
    estimatedDurationMs: 1600,
  },
  {
    id: "rank",
    label: "Ranking Results",
    description: "Calculating deterministic relevance scores and deduplicating",
    icon: Layers,
    estimatedDurationMs: 1000,
  },
];

export function SearchProgress({ query }: SearchProgressProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  useEffect(() => {
    let accumulatedTime = 0;
    const timers: NodeJS.Timeout[] = [];

    SEARCH_STAGES.forEach((stage, idx) => {
      if (idx === 0) return;
      accumulatedTime += SEARCH_STAGES[idx - 1].estimatedDurationMs;
      const timer = setTimeout(() => {
        setCurrentStageIndex((prev) => Math.max(prev, idx));
      }, accumulatedTime);
      timers.push(timer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6" aria-live="polite" aria-busy="true">
      {/* Active Query Announcement Card */}
      <Card className="p-5 border-primary/20 bg-card/95 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Searching Opportunities</h3>
              <p className="text-xs text-muted-foreground">
                BrowserPilot is actively executing your search through the Intelligence Harness
              </p>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30 bg-primary/5 self-start sm:self-auto">
            Live Search Execution
          </Badge>
        </div>

        {/* Active Query Quote */}
        <div className="rounded-lg bg-muted/40 p-3 font-mono text-xs text-foreground/90 border border-border/50 break-words">
          <span className="text-muted-foreground mr-2 select-none">&ldquo;</span>
          {query}
          <span className="text-muted-foreground ml-2 select-none">&rdquo;</span>
        </div>

        {/* Real Stages List */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2">
          {SEARCH_STAGES.map((stage, idx) => {
            const isDone = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            const Icon = stage.icon;

            return (
              <div
                key={stage.id}
                className={`flex flex-col p-2.5 rounded-lg border transition-all text-left ${
                  isCurrent
                    ? "border-primary/40 bg-primary/5 shadow-xs"
                    : isDone
                    ? "border-emerald-500/30 bg-emerald-500/5 opacity-80"
                    : "border-border/40 bg-card/50 opacity-40"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded text-[10px] ${
                      isDone
                        ? "text-emerald-500"
                        : isCurrent
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isCurrent ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    0{idx + 1}
                  </span>
                </div>
                <span className="text-xs font-semibold text-foreground line-clamp-1">
                  {stage.label}
                </span>
                <span className="text-[10px] text-muted-foreground line-clamp-2 leading-tight mt-0.5 hidden sm:inline-block">
                  {stage.description}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Structural Skeletons for Pending Result Cards */}
      <div className="space-y-3 pt-2" aria-hidden="true">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider px-1">
          Preparing Opportunity Dossiers...
        </div>
        {[1, 2, 3].map((skeletonIdx) => (
          <div
            key={skeletonIdx}
            className="rounded-2xl border border-border/60 bg-card/60 p-5 space-y-4 animate-pulse"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="h-5 w-1/3 bg-muted rounded-md" />
                <div className="h-3.5 w-1/4 bg-muted/70 rounded-md" />
              </div>
              <div className="h-8 w-16 bg-muted/60 rounded-full" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <div className="h-6 w-20 bg-muted/60 rounded-md" />
              <div className="h-6 w-24 bg-muted/60 rounded-md" />
              <div className="h-6 w-28 bg-muted/60 rounded-md" />
            </div>
            <div className="h-10 w-full bg-muted/40 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
