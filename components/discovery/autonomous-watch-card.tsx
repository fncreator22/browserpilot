"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Radio, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  ChevronRight, 
  Sliders, 
  ArrowRight,
  AlertCircle,
  RotateCw,
  Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { SearchIntent } from "@/lib/scraper/providers/baseProvider";

interface AutonomousWatchCardProps {
  intent: SearchIntent;
  query: string;
  onWatchSaved?: (watchData: any) => void;
  className?: string;
}

export function AutonomousWatchCard({ intent, query, onWatchSaved, className = "" }: AutonomousWatchCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedWatch, setSavedWatch] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const roles = intent.roles || [intent.role || "Software Engineer"];
  const locations = intent.locations || (intent.location ? [intent.location] : ["India", "Remote"]);
  const workModes = intent.workModes || (intent.workMode ? [intent.workMode] : ["ANY"]);
  const opportunityTypes = intent.opportunityTypes || (intent.opportunityType ? [intent.opportunityType] : ["FULL_TIME"]);
  const experienceLevels = intent.experienceLevels || (intent.experienceLevel ? [intent.experienceLevel] : ["ENTRY_LEVEL"]);
  const scanIntervalHours = intent.watchIntent?.scanIntervalHours || 4;
  const minimumMatchScore = intent.minimumMatchScore || 70;

  const handleSaveWatch = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/discovery/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          roles,
          skills: intent.skills || [],
          locations,
          companies: intent.companies || (intent.company ? [intent.company] : []),
          workModes,
          experienceLevels,
          opportunityTypes,
          preferredSources: intent.sources || ["LinkedIn", "Y Combinator", "Indeed"],
          minimumMatchScore,
          scanIntervalHours,
          latestOnly: intent.sortMode === "LATEST",
          freshnessWindowHours: intent.freshnessWindowHours || 48,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Please sign in to save an autonomous watch.");
        }
        throw new Error(data.message || "Failed to save autonomous watch.");
      }

      setIsSaved(true);
      setSavedWatch(data.watch);
      if (onWatchSaved) {
        onWatchSaved(data.watch);
      }
      toast.success("Autonomous Watch Active!", {
        description: `BrowserPilot will monitor for new opportunities every ${scanIntervalHours} hours and alert you.`,
      });
    } catch (err: unknown) {
      const msg = (err as Error).message || "An unexpected error occurred.";
      setError(msg);
      toast.error("Watch Creation Failed", { description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`w-full rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Info Column */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Radio className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
              Autonomous Watch
              {isSaved && (
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 font-mono text-[10px]">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                </Badge>
              )}
            </h3>
            <Badge variant="outline" className="border-border/60 bg-muted/30 text-muted-foreground font-mono text-[10px]">
              Every {scanIntervalHours} Hours
            </Badge>
            <Badge variant="outline" className="border-border/60 bg-muted/30 text-muted-foreground font-mono text-[10px]">
              Min Fit: {minimumMatchScore}%
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
            {isSaved
              ? `Active watch is monitoring multi-source postings. You'll receive proactive notifications whenever a brand new opportunity or repost is discovered.`
              : `Convert this search into an autonomous background watch. BrowserPilot will periodically search across LinkedIn, YC, and Indeed and alert you only when something genuinely new appears.`}
          </p>

          {/* Config Preview Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] font-mono">
            <span className="text-muted-foreground">Monitoring:</span>
            {roles.slice(0, 3).map((r) => (
              <span key={r} className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                {r}
              </span>
            ))}
            {locations.slice(0, 2).map((l) => (
              <span key={l} className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                {l}
              </span>
            ))}
            {workModes.filter((m) => m !== "ANY").map((m) => (
              <span key={m} className="rounded bg-primary/10 text-primary px-1.5 py-0.5 font-semibold">
                {m}
              </span>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-mono pt-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}
        </div>

        {/* Right Action Column */}
        <div className="flex items-center gap-3 shrink-0">
          {isSaved ? (
            <div className="flex items-center gap-2">
              <Link href="/app/watch">
                <Button variant="outline" size="sm" className="h-8 px-3 font-mono text-xs gap-1.5 border-border/80 hover:bg-muted/40 cursor-pointer">
                  <Sliders className="h-3.5 w-3.5" />
                  Manage Watch
                </Button>
              </Link>
              <Link href="/app/notifications">
                <Button variant="secondary" size="sm" className="h-8 px-3 font-mono text-xs gap-1.5 cursor-pointer">
                  <Bell className="h-3.5 w-3.5 text-primary" />
                  View Alerts
                </Button>
              </Link>
            </div>
          ) : (
            <Button
              onClick={handleSaveWatch}
              disabled={isSaving}
              className="h-9 px-4 font-mono text-xs font-semibold gap-2 shadow-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSaving ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-background border-t-transparent animate-spin" />
                  Saving Watch...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Save as Autonomous Watch
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
