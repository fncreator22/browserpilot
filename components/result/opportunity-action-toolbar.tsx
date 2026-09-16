"use client";

import React, { useState } from "react";
import { 
  Bookmark, 
  BookmarkCheck, 
  ExternalLink, 
  Share2, 
  Check, 
  Copy,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { STAGE_CONFIG, type PipelineStage } from "@/app/app/saved/page";

interface OpportunityActionToolbarProps {
  opportunityId: string;
  initialSaved?: boolean;
  initialStage?: PipelineStage;
  primaryApplyUrl: string;
  companyName: string;
  title: string;
  shareUrl?: string;
}

export function OpportunityActionToolbar({
  opportunityId,
  initialSaved = false,
  initialStage = "SAVED",
  primaryApplyUrl,
  companyName,
  title,
  shareUrl,
}: OpportunityActionToolbarProps) {
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [currentStage, setCurrentStage] = useState<PipelineStage>(initialStage);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showStageSelector, setShowStageSelector] = useState(false);

  const handleToggleSave = async () => {
    setIsSaving(true);
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);

    try {
      if (nextSaved) {
        const res = await fetch(`/api/opportunities/${opportunityId}/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: JSON.stringify({ stage: currentStage }) }),
        });
        if (!res.ok) throw new Error("Failed to save");
        toast.success("Opportunity saved to your workspace", {
          description: "Track progress under Saved Opportunities",
        });
      } else {
        const res = await fetch(`/api/opportunities/${opportunityId}/save`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to unsave");
        toast.success("Opportunity removed from saved list");
      }
    } catch {
      setIsSaved(!nextSaved);
      toast.error("Failed to update bookmark status");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStage = async (stage: PipelineStage) => {
    setCurrentStage(stage);
    setShowStageSelector(false);

    try {
      const res = await fetch(`/api/opportunities/${opportunityId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: JSON.stringify({ stage }) }),
      });
      if (!res.ok) throw new Error("Failed to update pipeline stage");
      toast.success(`Pipeline Stage: ${STAGE_CONFIG[stage].label}`, {
        description: `Updated status for ${title} at ${companyName}`,
      });
    } catch {
      toast.error("Failed to update pipeline stage");
    }
  };

  const handleCopyLink = () => {
    const url = shareUrl || (typeof window !== "undefined" ? window.location.href : "");
    if (!url) return;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    toast.success("Opportunity link copied to clipboard");
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
      {/* 1. Apply CTA */}
      <a
        href={primaryApplyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-opacity shadow-xs"
      >
        <span>Apply on Company Site</span>
        <ExternalLink className="h-3.5 w-3.5" />
      </a>

      {/* 2. Bookmark / Save Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isSaving}
        onClick={handleToggleSave}
        className={`h-10 px-3.5 rounded-xl text-xs font-mono gap-1.5 border transition-all cursor-pointer ${
          isSaved
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
            : "border-border/80 hover:bg-muted/40"
        }`}
      >
        {isSaved ? (
          <>
            <BookmarkCheck className="h-4 w-4 text-emerald-500 fill-emerald-500/20" />
            <span>Saved</span>
          </>
        ) : (
          <>
            <Bookmark className="h-4 w-4 text-muted-foreground" />
            <span>Save Job</span>
          </>
        )}
      </Button>

      {/* 3. Pipeline Stage Selector (Visible if Saved) */}
      {isSaved && (
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowStageSelector(!showStageSelector)}
            className="h-10 px-3 rounded-xl text-xs font-mono gap-1.5 border-border/80 hover:bg-muted/40 cursor-pointer"
          >
            <span className="text-muted-foreground text-[11px]">Stage:</span>
            <span className="font-semibold text-foreground">{STAGE_CONFIG[currentStage].label}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>

          {showStageSelector && (
            <div className="absolute top-full left-0 mt-1.5 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl z-30 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[10px] font-mono text-muted-foreground font-semibold border-b border-border/40 mb-1">
                Select Pipeline Stage
              </div>
              {(["SAVED", "APPLIED", "INTERVIEWING", "OFFER"] as PipelineStage[]).map((stg) => (
                <button
                  key={stg}
                  type="button"
                  onClick={() => handleUpdateStage(stg)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between transition-colors cursor-pointer ${
                    currentStage === stg
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{STAGE_CONFIG[stg].label}</span>
                  {currentStage === stg && <Check className="h-3 w-3 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Copy Share Link */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleCopyLink}
        className="h-10 px-3 rounded-xl text-xs font-mono text-muted-foreground hover:text-foreground cursor-pointer"
        title="Copy direct share link"
      >
        {isCopied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-500 mr-1" />
            <span className="text-emerald-500">Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5 mr-1" />
            <span>Share</span>
          </>
        )}
      </Button>
    </div>
  );
}
