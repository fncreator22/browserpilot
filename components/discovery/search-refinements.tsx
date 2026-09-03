"use client";

import { Sparkles, Globe, Clock, Target, Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchRefinementsProps {
  currentQuery: string;
  onSelectRefinement: (refinementPrompt: string) => void;
  className?: string;
}

export function SearchRefinements({
  currentQuery,
  onSelectRefinement,
  className = "",
}: SearchRefinementsProps) {
  const queryLower = currentQuery.toLowerCase();

  const refinements: Array<{ label: string; text: string; icon: typeof Sparkles }> = [];

  if (!queryLower.includes("remote")) {
    refinements.push({
      label: "+ Remote only",
      text: `${currentQuery.trim()} (Remote only)`,
      icon: Globe,
    });
  }

  if (!queryLower.includes("10") && !queryLower.includes("20")) {
    refinements.push({
      label: "+ Target 10 jobs",
      text: `${currentQuery.trim().replace(/\b\d+\b/, "10")}${!/\b\d+\b/.test(currentQuery) ? " - Find 10 opportunities" : ""}`,
      icon: Target,
    });
  }

  if (!queryLower.includes("7 days") && !queryLower.includes("week") && !queryLower.includes("24 hours")) {
    refinements.push({
      label: "+ Past 7 days only",
      text: `${currentQuery.trim()} posted in the last 7 days`,
      icon: Clock,
    });
  }

  if (!queryLower.includes("yc") && !queryLower.includes("startup")) {
    refinements.push({
      label: "+ YC startups",
      text: `${currentQuery.trim()} at Y Combinator startups`,
      icon: Building2,
    });
  }

  if (!queryLower.includes("senior") && !queryLower.includes("intern") && !queryLower.includes("lead")) {
    refinements.push({
      label: "+ Senior / Lead",
      text: `Senior ${currentQuery.trim()}`,
      icon: Sparkles,
    });
  }

  if (refinements.length === 0) {
    refinements.push({
      label: "+ Expand to 15 days",
      text: `${currentQuery.trim()} posted in the last 15 days`,
      icon: Clock,
    });
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap text-xs ${className}`}>
      <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
        <Sparkles className="h-3 w-3 text-primary" />
        Quick Refinements:
      </span>
      {refinements.map((ref) => {
        const Icon = ref.icon;
        return (
          <Button
            key={ref.label}
            variant="outline"
            size="sm"
            onClick={() => onSelectRefinement(ref.text)}
            className="h-6 px-2.5 font-mono text-[11px] gap-1 border-border/70 hover:bg-muted/40 text-muted-foreground hover:text-foreground cursor-pointer rounded-full"
          >
            <Icon className="h-3 w-3 text-primary" />
            {ref.label}
          </Button>
        );
      })}
    </div>
  );
}
