"use client";

import { useState } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Layers, 
  Filter, 
  Clock, 
  RotateCw, 
  AlertCircle,
  CheckCircle2,
  Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SearchDiagnosticsCardProps {
  diagnostics?: {
    requestedCount?: number;
    validResultCount?: number;
    rejectedResultCount?: number;
    stoppingReason?: string;
    totalRounds?: number;
    rejectionReasons?: string[];
  };
  correctionState?: {
    roundsExecuted?: number;
    stoppingReason?: string;
    totalActions?: number;
    history?: Array<{
      roundNumber: number;
      reason: string;
      strategy: string;
      verifiedGained: number;
      durationMs: number;
    }>;
  };
  sourceSummary?: {
    toolsExecuted?: string[];
    memoriesRetrieved?: number;
    durationMs?: number;
  };
  metadata?: {
    totalUniqueOpportunities?: number;
    returnedCount?: number;
    durationMs?: number;
    providersAttempted?: number;
    providersSucceeded?: number;
    explanation?: string;
  };
  className?: string;
}

export function SearchDiagnosticsCard({
  diagnostics,
  correctionState,
  sourceSummary,
  metadata,
  className = "",
}: SearchDiagnosticsCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!diagnostics && !correctionState && !sourceSummary) return null;

  const validCount = diagnostics?.validResultCount ?? metadata?.returnedCount ?? 0;
  const rejectedCount = diagnostics?.rejectedResultCount ?? 0;
  const rounds = correctionState?.roundsExecuted ?? diagnostics?.totalRounds ?? 1;
  const stoppingReason = (diagnostics?.stoppingReason || correctionState?.stoppingReason || "TARGET_SATISFIED").replace(/_/g, " ").toLowerCase();
  const durationMs = sourceSummary?.durationMs ?? metadata?.durationMs ?? 0;
  const tools = sourceSummary?.toolsExecuted ?? [];
  const rejectionReasons = diagnostics?.rejectionReasons || [];

  return (
    <div className={`rounded-xl border border-border/70 bg-card/60 p-4 transition-all ${className}`}>
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 text-left cursor-pointer select-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
          </span>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
              Quality Gate & Search Diagnostics
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {validCount} verified • {rejectedCount} filtered by Quality Gate • {rounds} round{rounds !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] hidden sm:inline-flex">
            {stoppingReason}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </button>

      {/* Expandable Content */}
      {isOpen && (
        <div className="pt-4 mt-3 border-t border-border/40 space-y-4 font-mono text-xs">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/40">
              <span className="text-[10px] text-muted-foreground uppercase block">Verified Active</span>
              <span className="text-sm font-bold text-emerald-500">{validCount}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/40">
              <span className="text-[10px] text-muted-foreground uppercase block">Rejected Stale/Mismatch</span>
              <span className="text-sm font-bold text-amber-500">{rejectedCount}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/40">
              <span className="text-[10px] text-muted-foreground uppercase block">Correction Rounds</span>
              <span className="text-sm font-bold text-primary">{rounds}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border border-border/40">
              <span className="text-[10px] text-muted-foreground uppercase block">Search Latency</span>
              <span className="text-sm font-bold text-foreground">{durationMs > 0 ? `${durationMs}ms` : "Fast"}</span>
            </div>
          </div>

          {/* Rejection Reasons Breakdown */}
          {rejectionReasons.length > 0 && (
            <div className="space-y-1.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
                <Filter className="h-3 w-3" />
                Quality Gate Rejections:
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {rejectionReasons.map((reason, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-[10px] border-amber-500/30 bg-amber-500/10 text-amber-400"
                  >
                    {reason}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Sources / Tools Executed */}
          {tools.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Sources & Capabilities Harvested:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tools.map((tool, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-[10px] font-mono px-2 py-0.5"
                  >
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Safe Privacy Notice */}
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border/40">
            <Info className="h-3 w-3 text-muted-foreground shrink-0" />
            <span>
              All results verified against live source pages. Zero private tokens or model traces are stored.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
