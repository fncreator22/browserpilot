"use client";

import Link from "next/link";
import { 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ShieldAlert, 
  Clock, 
  Lock, 
  ArrowRight,
  Info,
  RotateCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SearchStatusBannerProps {
  status: "COMPLETE" | "PARTIAL" | "NO_RESULTS" | "FAILED" | string;
  requestedCount?: number;
  verifiedCount?: number;
  explanation?: string;
  stoppingReason?: string;
  sourceNotice?: string;
  errorCode?: string;
  onRetry?: () => void;
  className?: string;
}

export function SearchStatusBanner({
  status,
  requestedCount = 0,
  verifiedCount = 0,
  explanation,
  stoppingReason,
  sourceNotice,
  errorCode,
  onRetry,
  className = "",
}: SearchStatusBannerProps) {
  // Case 1: Unauthorized 401
  if (errorCode === "UNAUTHORIZED" || status === "UNAUTHORIZED") {
    return (
      <div className={`rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3 ${className}`}>
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <h4 className="text-sm font-semibold text-foreground">Authentication Required</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You must be signed in to execute opportunity searches with the BrowserPilot Intelligence Harness.
            </p>
          </div>
          <Link href="/login">
            <Button size="sm" className="font-mono text-xs gap-1.5 cursor-pointer">
              Sign In
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Case 2: COMPLETE (verifiedCount >= requestedCount)
  if (status === "COMPLETE") {
    return (
      <div className={`rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2 ${className}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-emerald-400">
              {explanation || `Found ${verifiedCount} verified opportunities matching your criteria.`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
              Target Satisfied ({verifiedCount}/{requestedCount || verifiedCount})
            </Badge>
          </div>
        </div>

        {sourceNotice && (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1 font-mono border-t border-emerald-500/20">
            <Info className="h-3 w-3 text-muted-foreground" />
            <span>{sourceNotice}</span>
          </div>
        )}
      </div>
    );
  }

  // Case 3: PARTIAL (0 < verifiedCount < requestedCount)
  if (status === "PARTIAL") {
    const shortfall = Math.max(0, (requestedCount || 0) - verifiedCount);
    return (
      <div className={`rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2.5 ${className}`}>
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-amber-400">
              {explanation || `Found ${verifiedCount} verified opportunities. ${shortfall} additional opportunities could not be verified within your search constraints.`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px] border-amber-500/40 text-amber-400 bg-amber-500/10">
              Partial ({verifiedCount} of {requestedCount} Verified)
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-500/20 text-[11px] text-muted-foreground font-mono flex-wrap">
          <span>
            Search stopped: {stoppingReason ? stoppingReason.replace(/_/g, " ").toLowerCase() : "available candidate pool exhausted"}
          </span>
          {sourceNotice && (
            <span className="text-amber-400/90">{sourceNotice}</span>
          )}
        </div>
      </div>
    );
  }

  // Case 4: NO_RESULTS
  if (status === "NO_RESULTS") {
    return (
      <div className={`rounded-xl border border-border/80 bg-card p-6 text-center space-y-3 ${className}`}>
        <div className="flex justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <HelpCircle className="h-5 w-5" />
          </span>
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-foreground">No Verified Opportunities Found</h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            {explanation || "We could not find any active job listings that passed our verification Quality Gate matching your exact role, location, and date boundaries."}
          </p>
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          Try expanding your date filter, broadening the location, or including remote roles.
        </p>
      </div>
    );
  }

  // Case 5: FAILED / Error
  if (status === "FAILED") {
    return (
      <div className={`rounded-xl border border-destructive/30 bg-destructive/10 p-4 space-y-3 ${className}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-foreground">Search Execution Failed</h4>
              <p className="text-xs text-muted-foreground">
                {explanation || "An unexpected error occurred during search execution. Please verify your query and try again."}
              </p>
            </div>
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-7 font-mono text-xs gap-1 border-destructive/30 hover:bg-destructive/10"
            >
              <RotateCw className="h-3 w-3" />
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
