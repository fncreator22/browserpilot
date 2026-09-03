"use client";

import { 
  Compass, 
  Briefcase, 
  MapPin, 
  Globe, 
  Clock, 
  Target, 
  Sparkles,
  Code2,
  GraduationCap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface InterpretedIntentCardProps {
  intent: any;
  canonicalIntent?: any;
  requestedCount?: number;
  className?: string;
}

export function InterpretedIntentCard({
  intent,
  canonicalIntent,
  requestedCount,
  className = "",
}: InterpretedIntentCardProps) {
  const activeIntent = canonicalIntent || intent;
  if (!activeIntent) return null;

  const role = activeIntent.roles?.[0] || activeIntent.role || "Any Role";
  const location = activeIntent.locations?.[0] || activeIntent.location || "Any Location";
  const workMode = activeIntent.workModes?.[0] || activeIntent.workMode || "ANY";
  const days = activeIntent.postedWithinDays;
  const hours = activeIntent.freshnessWindowHours;
  const freshnessText = days
    ? `Last ${days} days`
    : hours
    ? `Last ${hours} hours`
    : "Anytime";
  const count = requestedCount || activeIntent.requestedCount || 10;
  const skills: string[] = activeIntent.skills || [];
  const gradYear = activeIntent.targetGradYear;

  return (
    <div className={`rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/20 text-primary">
            <Sparkles className="h-3 w-3" />
          </span>
          <h4 className="text-xs font-semibold text-foreground tracking-wide font-mono uppercase">
            BrowserPilot Interpreted Request
          </h4>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          Canonical Intent
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {/* Role */}
        <div className="flex items-start gap-2 p-2 rounded-lg bg-background/60 border border-border/40">
          <Briefcase className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase font-mono">Role</div>
            <div className="text-xs font-semibold text-foreground truncate" title={role}>
              {role}
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-start gap-2 p-2 rounded-lg bg-background/60 border border-border/40">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase font-mono">Location</div>
            <div className="text-xs font-semibold text-foreground truncate" title={location}>
              {location}
            </div>
          </div>
        </div>

        {/* Work Mode */}
        <div className="flex items-start gap-2 p-2 rounded-lg bg-background/60 border border-border/40">
          <Globe className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase font-mono">Work Mode</div>
            <div className="text-xs font-semibold text-foreground capitalize truncate">
              {workMode.toLowerCase()}
            </div>
          </div>
        </div>

        {/* Freshness */}
        <div className="flex items-start gap-2 p-2 rounded-lg bg-background/60 border border-border/40">
          <Clock className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase font-mono">Freshness</div>
            <div className="text-xs font-semibold text-foreground truncate">
              {freshnessText}
            </div>
          </div>
        </div>

        {/* Requested Count */}
        <div className="flex items-start gap-2 p-2 rounded-lg bg-background/60 border border-border/40">
          <Target className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase font-mono">Target</div>
            <div className="text-xs font-semibold text-foreground">
              {count} {count === 1 ? "Role" : "Roles"}
            </div>
          </div>
        </div>
      </div>

      {/* Optional Skills & Target Grad Year */}
      {(skills.length > 0 || gradYear) && (
        <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
          {skills.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Code2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground font-mono">Skills:</span>
              {skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-4">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
          {gradYear && (
            <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground ml-auto">
              <GraduationCap className="h-3.5 w-3.5 text-primary" />
              <span>Batch of {gradYear}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
