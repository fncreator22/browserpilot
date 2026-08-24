"use client";

import { 
  CheckCircle2, 
  CircleDot, 
  Loader2, 
  AlertTriangle, 
  Clock, 
  Compass
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface TimelineStep {
  id: string;
  name: string;
  description: string;
  status: "COMPLETED" | "RUNNING" | "PENDING" | "BLOCKED" | "FAILED";
  timestamp?: string;
  durationMs?: number;
  toolCall?: string;
}

interface StatusTimelineProps {
  steps?: TimelineStep[];
  currentStepIndex?: number;
}

export function StatusTimeline({ steps = [] }: StatusTimelineProps) {
  const getStepIcon = (status: TimelineStep["status"]) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "RUNNING":
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case "BLOCKED":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "FAILED":
        return <AlertTriangle className="h-5 w-5 text-rose-500" />;
      default:
        return <CircleDot className="h-5 w-5 text-muted-foreground/40" />;
    }
  };

  const getBadgeVariant = (status: TimelineStep["status"]) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "RUNNING":
        return "bg-primary/10 text-primary border-primary/20 animate-pulse";
      case "BLOCKED":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "FAILED":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between pb-5 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" />
            Execution Timeline (Level 2 Disclosure)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Step-by-step agent lifecycle & deterministic state transitions
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-[11px] gap-1 bg-secondary/50">
          <Clock className="h-3 w-3" />
          Live State Machine
        </Badge>
      </div>

      {steps.length === 0 ? (
        <p className="text-xs font-mono text-muted-foreground mt-6 italic">
          Initializing pipeline and generating deterministic tool plan...
        </p>
      ) : (
        <div className="mt-6 flow-root">
          <ul className="-mb-8">
            {steps.map((step, stepIdx) => (
              <li key={step.id}>
                <div className="relative pb-8">
                  {stepIdx !== steps.length - 1 ? (
                    <span
                      className={`absolute left-4 top-4 -ml-px h-full w-0.5 ${
                        step.status === "COMPLETED"
                          ? "bg-emerald-500/60"
                          : "bg-border"
                      }`}
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="relative flex items-start space-x-3.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background ring-4 ring-card">
                      {getStepIcon(step.status)}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                          {step.name}
                          {step.durationMs ? (
                            <span className="text-[10px] font-mono text-muted-foreground font-normal">
                              ({step.durationMs}ms)
                            </span>
                          ) : null}
                        </p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-medium border ${getBadgeVariant(step.status)}`}>
                          {step.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                      {step.toolCall && (
                        <div className="mt-2 rounded-lg bg-muted/60 px-2.5 py-1.5 font-mono text-[11px] text-foreground/80 border border-border/40 inline-block max-w-full overflow-x-auto">
                          <span className="text-muted-foreground">Action:</span> {step.toolCall}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
