"use client";

import React from "react";
import { HelpCircle, Users, MapPin, Globe, Building2 } from "lucide-react";

export interface CompanyIntelligencePillProps {
  companyName?: string;
  employeeHeadcountBracket?: string | null;
  headquarters?: string | null;
  officialDomain?: string | null;
  isUndisclosed?: boolean;
  employerType?: "VERIFIED_CORPORATE" | "STAFFING_AGENCY" | "UNDISCLOSED_EMPLOYER" | string;
  className?: string;
}

export function CompanyIntelligencePill({
  companyName,
  employeeHeadcountBracket,
  headquarters,
  officialDomain,
  isUndisclosed = false,
  employerType,
  className = "",
}: CompanyIntelligencePillProps) {
  // If explicitly undisclosed or employerType indicates undisclosed
  if (isUndisclosed || employerType === "UNDISCLOSED_EMPLOYER") {
    return (
      <span
        className={`badge badge-sm badge-outline inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-sans text-[11px] font-medium border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 ${className}`}
        title="Undisclosed or anonymized employer"
      >
        <HelpCircle className="h-3 w-3 shrink-0 stroke-[2] text-amber-600 dark:text-amber-400" />
        <span>Undisclosed Employer</span>
      </span>
    );
  }

  const hasChips = Boolean(employeeHeadcountBracket || headquarters || officialDomain);
  if (!hasChips) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1.5 flex-wrap text-muted-foreground ${className}`}>
      {/* Headcount Chip */}
      {employeeHeadcountBracket && (
        <span
          className="badge badge-xs badge-outline inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans border-border/70 bg-slate-50 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
          title={`Estimated Headcount: ${employeeHeadcountBracket}`}
        >
          <Users className="h-2.5 w-2.5 shrink-0 text-emerald-600 dark:text-emerald-400 stroke-[1.75]" />
          <span>{employeeHeadcountBracket}</span>
        </span>
      )}

      {/* Headquarters Chip */}
      {headquarters && (
        <span
          className="badge badge-xs badge-outline inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans border-border/70 bg-slate-50 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
          title={`Headquarters: ${headquarters}`}
        >
          <MapPin className="h-2.5 w-2.5 shrink-0 text-emerald-600 dark:text-emerald-400 stroke-[1.75]" />
          <span className="truncate max-w-[120px]">{headquarters}</span>
        </span>
      )}

      {/* Official Domain Chip */}
      {officialDomain && (
        <span
          className="badge badge-xs badge-outline inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans border-border/70 bg-slate-50 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
          title={`Official Domain: ${officialDomain}`}
        >
          <Globe className="h-2.5 w-2.5 shrink-0 text-emerald-600 dark:text-emerald-400 stroke-[1.75]" />
          <span className="truncate max-w-[110px]">{officialDomain}</span>
        </span>
      )}
    </div>
  );
}
