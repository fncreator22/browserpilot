"use client";

import Link from "next/link";
import { Brain, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  if (!personalization || !personalization.applied) return null;

  const memories = personalization.memoriesUsed || [];

  return (
    <div className={`rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono ${className}`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500/20 text-purple-400 shrink-0">
          <Brain className="h-3.5 w-3.5" />
        </span>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-purple-300">Personalized Discovery</span>
            <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-300 bg-purple-500/10 px-1.5 py-0">
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

      <Link href="/app/settings/memory">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] font-mono border-purple-500/40 text-purple-300 hover:bg-purple-500/20 cursor-pointer shrink-0"
        >
          Manage Memory
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </Link>
    </div>
  );
}
