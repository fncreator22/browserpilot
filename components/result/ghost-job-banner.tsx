"use client";

import React from "react";
import { AlertOctagon, AlertTriangle, ShieldAlert } from "lucide-react";

export interface GhostJobBannerProps {
  advisoryTitle?: string;
  advisoryMessage?: string;
  actionRecommendation?: "APPLY_CONFIDENTLY" | "VERIFY_OFFICIAL_PORTAL" | "DO_NOT_REGISTER_AFFILIATE" | string;
  reasons?: string[];
  affiliateWarning?: string;
  className?: string;
}

export function GhostJobBanner({
  advisoryTitle = "Ghost Job / Affiliate Advisory",
  advisoryMessage,
  actionRecommendation,
  reasons = [],
  affiliateWarning,
  className = "",
}: GhostJobBannerProps) {
  return (
    <div
      className={`rounded-xl border border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 p-3.5 mb-3 backdrop-blur-sm text-xs font-sans text-rose-900 dark:text-rose-200 space-y-2 ${className}`}
      role="alert"
    >
      {/* Header with AlertOctagon */}
      <div className="flex items-center gap-2">
        <AlertOctagon className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 stroke-[2]" />
        <span className="font-semibold text-rose-800 dark:text-rose-300 text-xs">
          {advisoryTitle}
        </span>
      </div>

      {/* Advisory Message or Affiliate Warning */}
      {(advisoryMessage || affiliateWarning) && (
        <p className="text-[11px] text-rose-700/90 dark:text-rose-300/80 leading-relaxed">
          {affiliateWarning || advisoryMessage}
        </p>
      )}

      {/* Rejection / Flag Reasons */}
      {reasons && reasons.length > 0 && (
        <ul className="space-y-1 pl-1 text-[11px] text-rose-700 dark:text-rose-300/90">
          {reasons.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-1.5 leading-snug">
              <span className="text-rose-500 shrink-0 mt-0.5">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Action Recommendation Chip */}
      {actionRecommendation === "DO_NOT_REGISTER_AFFILIATE" ? (
        <div className="pt-1">
          <span className="badge badge-sm badge-outline inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30">
            <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400 shrink-0 stroke-[2]" />
            <span>Recommendation: Do NOT register on third-party aggregator portals</span>
          </span>
        </div>
      ) : actionRecommendation === "VERIFY_OFFICIAL_PORTAL" ? (
        <div className="pt-1">
          <span className="badge badge-sm badge-outline inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0 stroke-[2]" />
            <span>Recommendation: Verify and apply exclusively on company career page</span>
          </span>
        </div>
      ) : actionRecommendation ? (
        <div className="pt-1">
          <span className="badge badge-sm badge-outline inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30">
            <ShieldAlert className="h-3 w-3 text-rose-600 dark:text-rose-400 shrink-0 stroke-[2]" />
            <span>Recommendation: {actionRecommendation.replace(/_/g, " ")}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
