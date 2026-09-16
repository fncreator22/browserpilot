"use client";

import React from "react";
import { ShieldCheck, Building2, AlertTriangle, AlertOctagon } from "lucide-react";

export interface TrustScoreBadgeProps {
  score: number; // 0 - 100
  tier: "HIGH_TRUST" | "MODERATE_TRUST" | "SUSPICIOUS" | "GHOST_JOB_AFFILIATE";
  isGhostJob?: boolean;
  compact?: boolean;
  className?: string;
}

export function TrustScoreBadge({
  score,
  tier,
  isGhostJob = false,
  compact = false,
  className = "",
}: TrustScoreBadgeProps) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

  // If flagged as ghost job, force GHOST_JOB_AFFILIATE styling
  const effectiveTier = isGhostJob ? "GHOST_JOB_AFFILIATE" : tier;

  let tierConfig = {
    label: `Verified Employer (${normalizedScore})`,
    compactLabel: `${normalizedScore}`,
    icon: ShieldCheck,
    classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  };

  switch (effectiveTier) {
    case "HIGH_TRUST":
      tierConfig = {
        label: `Verified Employer (${normalizedScore})`,
        compactLabel: `${normalizedScore}`,
        icon: ShieldCheck,
        classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      };
      break;
    case "MODERATE_TRUST":
      tierConfig = {
        label: `Staffing Partner (${normalizedScore})`,
        compactLabel: `${normalizedScore}`,
        icon: Building2,
        classes: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
      };
      break;
    case "SUSPICIOUS":
      tierConfig = {
        label: `Suspicious Role (${normalizedScore})`,
        compactLabel: `${normalizedScore}`,
        icon: AlertTriangle,
        classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      };
      break;
    case "GHOST_JOB_AFFILIATE":
      tierConfig = {
        label: `Ghost Job / Affiliate (${normalizedScore})`,
        compactLabel: `${normalizedScore}`,
        icon: AlertOctagon,
        classes: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      };
      break;
  }

  const IconComponent = tierConfig.icon;

  return (
    <span
      className={`badge badge-sm badge-outline inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-sans text-[11px] font-medium border ${tierConfig.classes} ${className}`}
      title={`Trust Score: ${normalizedScore}/100 - Tier: ${effectiveTier.replace(/_/g, " ")}`}
    >
      <IconComponent className="h-3 w-3 shrink-0 stroke-[2]" />
      <span>{compact ? tierConfig.compactLabel : tierConfig.label}</span>
    </span>
  );
}
