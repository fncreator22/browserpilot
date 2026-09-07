"use client";

import { useEffect, useState, useRef } from "react";
import { 
  Bot, 
  Search, 
  Layers, 
  ShieldCheck, 
  CheckCircle2, 
  Loader2, 
  Compass,
  AlertCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface SearchProgressProps {
  query: string;
  executionId?: string;
  onComplete?: (result: any) => void;
  onError?: (error: any) => void;
}

interface SearchStage {
  id: string;
  label: string;
  description: string;
  icon: typeof Search;
}

const SEARCH_STAGES: SearchStage[] = [
  {
    id: "intent",
    label: "Parsing Intent",
    description: "Extracting role, location, work mode, and freshness constraints",
    icon: Compass,
  },
  {
    id: "plan",
    label: "Planning Search",
    description: "Selecting optimal target ATS sources and retrieval tools",
    icon: Bot,
  },
  {
    id: "harvest",
    label: "Querying ATS Portals",
    description: "Querying multi-source platforms and job boards",
    icon: Search,
  },
  {
    id: "verify",
    label: "Verifying URLs",
    description: "Running evidence Quality Gate checks and freshness gating",
    icon: ShieldCheck,
  },
  {
    id: "rank",
    label: "Scoring & Ranking",
    description: "Calculating deterministic relevance scores and deduplicating",
    icon: Layers,
  },
];

const STAGE_INDEX_MAP: Record<string, number> = {
  intent: 0,
  plan: 1,
  harvest: 2,
  verify: 3,
  rank: 4,
};

export function SearchProgress({
  query,
  executionId,
  onComplete,
  onError,
}: SearchProgressProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [stageDetails, setStageDetails] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (!executionId) {
      setCurrentStageIndex(0);
      return;
    }

    hasCompletedRef.current = false;
    let eventSource: EventSource | null = null;
    let fallbackPollInterval: NodeJS.Timeout | null = null;

    const fetchFinalResults = async () => {
      if (hasCompletedRef.current) return;
      hasCompletedRef.current = true;
      try {
        const res = await fetch(`/api/search/${executionId}`);
        if (res.ok) {
          const data = await res.json();
          if (onComplete) {
            onComplete(data);
          }
        }
      } catch (fetchErr) {
        console.warn("[SearchProgress] Error fetching completed results:", fetchErr);
      }
    };

    try {
      eventSource = new EventSource(`/api/search/${executionId}/events`);

      eventSource.onopen = () => {
        setErrorNotice(null);
      };

      // Generic message handler
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.stage && STAGE_INDEX_MAP[data.stage] !== undefined) {
            setCurrentStageIndex(STAGE_INDEX_MAP[data.stage]);
            if (data.label) setStageDetails(data.label);
          }
        } catch {}
      };

      // Listen to specific pipeline stage events
      Object.keys(STAGE_INDEX_MAP).forEach((stageKey) => {
        eventSource?.addEventListener(stageKey, (event: MessageEvent) => {
          const stageIdx = STAGE_INDEX_MAP[stageKey];
          setCurrentStageIndex(stageIdx);
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.label) setStageDetails(parsed.label);
          } catch {}
        });
      });

      // Completion event
      eventSource.addEventListener("complete", () => {
        setCurrentStageIndex(5);
        fetchFinalResults();
        eventSource?.close();
      });

      // Cancellation event
      eventSource.addEventListener("cancelled", () => {
        setCurrentStageIndex(5);
        fetchFinalResults();
        eventSource?.close();
      });

      // Error event from server
      eventSource.addEventListener("error", (e) => {
        // If readyState is CLOSED or server emitted custom error
        const customEvent = e as MessageEvent;
        if (customEvent.data) {
          try {
            const parsed = JSON.parse(customEvent.data);
            setErrorNotice(parsed.message || "Search encountered an error.");
            if (onError) onError(parsed);
          } catch {}
        }
      });

      // Fallback Polling (in case SSE drops or client is in an environment blocking SSE)
      fallbackPollInterval = setInterval(async () => {
        if (hasCompletedRef.current) {
          if (fallbackPollInterval) clearInterval(fallbackPollInterval);
          return;
        }
        try {
          const res = await fetch(`/api/search/${executionId}`);
          if (res.ok) {
            const data = await res.json();
            if (["COMPLETED", "PARTIAL", "STOPPED", "FAILED"].includes(data.status)) {
              if (fallbackPollInterval) clearInterval(fallbackPollInterval);
              eventSource?.close();
              fetchFinalResults();
            }
          }
        } catch {}
      }, 3000);
    } catch (sseErr) {
      console.warn("[SearchProgress] Could not initialize EventSource:", sseErr);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackPollInterval) {
        clearInterval(fallbackPollInterval);
      }
    };
  }, [executionId, onComplete, onError]);

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
                {stageDetails
                  ? `Active stage: ${stageDetails}`
                  : "BrowserPilot is actively executing your search through the Intelligence Harness"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30 bg-primary/5 self-start sm:self-auto">
            Live Stream
          </Badge>
        </div>

        {errorNotice && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorNotice}</span>
          </div>
        )}

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
