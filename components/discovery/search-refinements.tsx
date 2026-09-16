"use client";

import { Sparkles, Globe, Clock, Target, Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchRefinementsProps {
  currentQuery: string;
  onSelectRefinement: (refinementPrompt: string) => void;
  className?: string;
}

function stripFreshness(query: string): string {
  return query
    .replace(/\b(?:posted\s+)?(?:in|within|for|past)\s+(?:the\s+)?(?:last|past)\s+\d+\s*(?:hours?|hrs?|days?|d|weeks?|w|months?|m)\b/gi, "")
    .replace(/\b(?:posted\s+)?(?:today|yesterday|this week|this month)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function SearchRefinements({
  currentQuery,
  onSelectRefinement,
  className = "",
}: SearchRefinementsProps) {
  const queryLower = currentQuery.toLowerCase();
  const cleanedQuery = stripFreshness(currentQuery);

  const refinements: Array<{ label: string; text: string; icon: typeof Sparkles }> = [];

  if (!queryLower.includes("remote")) {
    refinements.push({
      label: "+ Remote only",
      text: `${currentQuery.trim()} (Remote only)`,
      icon: Globe,
    });
  }

  // Broaden / Adjust Freshness Window intelligently
  const hasShortWindow = /\b(24\s*h|today|yesterday|1\s*day|2\s*days|3\s*days|48\s*hours)\b/i.test(queryLower);
  const hasWeekWindow = /\b(7\s*days?|week)\b/i.test(queryLower);

  if (hasShortWindow) {
    refinements.push({
      label: "+ Expand to 7 days",
      text: `${cleanedQuery} posted in the last 7 days`,
      icon: Clock,
    });
    refinements.push({
      label: "+ Expand to 30 days",
      text: `${cleanedQuery} posted in the last 30 days`,
      icon: Clock,
    });
  } else if (hasWeekWindow) {
    refinements.push({
      label: "+ Expand to 30 days",
      text: `${cleanedQuery} posted in the last 30 days`,
      icon: Clock,
    });
  } else if (!queryLower.includes("days") && !queryLower.includes("month") && !queryLower.includes("week")) {
    refinements.push({
      label: "+ Past 7 days only",
      text: `${cleanedQuery} posted in the last 7 days`,
      icon: Clock,
    });
  }

  if (!queryLower.includes("10") && !queryLower.includes("20")) {
    refinements.push({
      label: "+ Target 10 jobs",
      text: `${currentQuery.trim().replace(/\b\d+\b/, "10")}${!/\b\d+\b/.test(currentQuery) ? " - Find 10 opportunities" : ""}`,
      icon: Target,
    });
  }

  if (!queryLower.includes("yc") && !queryLower.includes("startup")) {
    refinements.push({
      label: "+ YC startups",
      text: `${currentQuery.trim()} at Y Combinator startups`,
      icon: Building2,
    });
  }

  const isEntryLevel = queryLower.includes("entry") || queryLower.includes("junior") || queryLower.includes("intern") || queryLower.includes("grad") || queryLower.includes("fresh") || queryLower.includes("0-2");
  const isSeniorLevel = queryLower.includes("senior") || queryLower.includes("lead") || queryLower.includes("staff") || queryLower.includes("principal");

  if (!isEntryLevel && !isSeniorLevel) {
    refinements.push({
      label: "+ Senior / Lead",
      text: `Senior ${currentQuery.trim()}`,
      icon: Sparkles,
    });
  } else if (isEntryLevel && !queryLower.includes("0-2")) {
    refinements.push({
      label: "+ 0-2 YOE only",
      text: `${currentQuery.trim()} (0-2 years of experience)`,
      icon: Sparkles,
    });
  }

  if (refinements.length === 0) {
    refinements.push({
      label: "+ Expand to 30 days",
      text: `${cleanedQuery} posted in the last 30 days`,
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
