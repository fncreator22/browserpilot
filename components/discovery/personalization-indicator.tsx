"use client";

import Link from "next/link";
import { Brain, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUIState } from "@/components/providers/ui-state-provider";

interface PersonalizationIndicatorProps {
  personalization?: {
    applied: boolean;
    memoriesUsed?: Array<{ category: string; key: string; value: string }>;
    summary?: string;
    overrideNotice?: string;
  };
  className?: string;
}

export function PersonalizationIndicator({
  personalization,
  className = "",
}: PersonalizationIndicatorProps) {
  const { openProfileModal } = useUIState();

  if (!personalization || !personalization.applied) return null;

  const memories = personalization.memoriesUsed || [];

  return (
    <div className={`rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono ${className}`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/20 text-blue-500 shrink-0">
          <Brain className="h-3.5 w-3.5" />
        </span>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-blue-600 dark:text-blue-300">Personalized Discovery</span>
            <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-600 dark:text-blue-300 bg-blue-500/10 px-1.5 py-0">
              Active Memory Applied
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {personalization.summary || `Using your saved preferences: ${memories.map((m) => m.value).join(" · ")}`}
            {personalization.overrideNotice && (
              <span className="text-amber-400 block pt-0.5">{personalization.overrideNotice}</span>
            )}
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => openProfileModal("CAREER_MEMORY")}
        className="h-7 text-[11px] font-mono border-blue-500/40 text-blue-600 dark:text-blue-300 hover:bg-blue-500/20 cursor-pointer shrink-0"
      >
        Manage Memory
        <ArrowRight className="h-3 w-3 ml-1" />
      </Button>
    </div>
  );
}
