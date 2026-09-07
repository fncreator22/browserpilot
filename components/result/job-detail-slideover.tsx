"use client";

import React, { useEffect } from "react";
import { 
  X, 
  Building, 
  MapPin, 
  Briefcase, 
  ExternalLink, 
  Bookmark, 
  BookmarkCheck, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  RotateCw, 
  Calendar,
  Share2,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUIState } from "@/components/providers/ui-state-provider";
import { getVerificationCornerBadge, type DossierJobItem } from "@/components/result/job-dossier-deck";
import { 
  humanizeStatus, 
  humanizeOpportunityType, 
  humanizeWorkMode 
} from "@/lib/utils/display-mappings";

interface JobDetailSlideOverProps {
  job: DossierJobItem | null;
  isOpen: boolean;
  onClose: () => void;
  isSaved?: boolean;
  isSaving?: boolean;
  onToggleSave?: () => void;
  onRevalidate?: () => void;
  isRevalidating?: boolean;
}

export function JobDetailSlideOver({
  job,
  isOpen,
  onClose,
  isSaved = false,
  isSaving = false,
  onToggleSave,
  onRevalidate,
  isRevalidating = false,
}: JobDetailSlideOverProps) {
  const { getConnectorMeta } = useUIState();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !job) return null;

  const effectivePlatform = job.sourcePlatform || job.sourceListings?.[0]?.sourcePlatform;
  const effectiveUrl = job.applyUrl || job.primaryApplyUrl || job.sourceListings?.[0]?.applyUrl;
  const conn = getConnectorMeta(effectivePlatform, effectiveUrl);
  const verificationBadge = getVerificationCornerBadge(job.verificationStatus);

  const parsedSkills = Array.isArray(job.skills) 
    ? job.skills 
    : typeof job.skills === "string" 
      ? JSON.parse(job.skills || "[]") 
      : [];

  const parsedRequirements = Array.isArray(job.requirements) 
    ? job.requirements 
    : typeof job.requirements === "string" 
      ? JSON.parse(job.requirements || "[]") 
      : [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      {/* Dimmed Backdrop Overlay */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300" 
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
        {/* Slide-over Panel (Full width on mobile, max-w-xl on desktop) */}
        <div className="w-screen max-w-full sm:max-w-lg md:max-w-xl bg-white shadow-2xl flex flex-col h-full border-l border-border animate-in slide-in-from-right duration-200">
          
          {/* Top Header Bar */}
          <div className="px-5 py-4 border-b border-border/70 flex items-center justify-between bg-slate-50/60 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-medium bg-[#E8EFEA] text-[#1F3D2E] border border-[#C3D5CA]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1F3D2E]" />
                {conn.displayName}
              </span>
              {verificationBadge}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-200/60 transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Title & Company Block */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground">
                <Building className="h-3.5 w-3.5 text-[#1F3D2E]" />
                <span className="font-semibold text-foreground text-sm">{job.companyName}</span>
                {job.postedAgoText && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {job.postedAgoText}
                    </span>
                  </>
                )}
              </div>

              <h2 id="slide-over-title" className="text-xl sm:text-2xl font-serif font-bold text-foreground leading-tight">
                {job.title}
              </h2>

              <div className="flex items-center gap-4 text-xs font-sans text-muted-foreground flex-wrap pt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 stroke-[1.75]" />
                  {job.location || "Remote / Unspecified"}
                </span>
                {job.workMode && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5 stroke-[1.75]" />
                    {humanizeWorkMode(job.workMode)}
                  </span>
                )}
                {job.opportunityType && (
                  <Badge variant="outline" className="font-sans text-[11px] py-0">
                    {humanizeOpportunityType(job.opportunityType)}
                  </Badge>
                )}
              </div>
            </div>

            {/* Match Relevance & Reasoning Card */}
            {typeof job.matchScore === "number" && (
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-sans font-semibold text-emerald-900 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 stroke-[1.75] text-emerald-700" />
                    Student relevance match
                  </span>
                  <span className="text-sm font-mono font-bold text-[#1F3D2E] bg-white border border-emerald-300 px-2 py-0.5 rounded-md">
                    {Math.round(job.matchScore)}% fit
                  </span>
                </div>
                {job.matchReason && (
                  <p className="text-xs font-sans text-emerald-950/80 leading-relaxed">
                    {job.matchReason}
                  </p>
                )}
              </div>
            )}

            {/* Verification & Source Integrity */}
            <div className="rounded-xl border border-border/70 bg-slate-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <h4 className="text-xs font-serif font-bold text-foreground">
                  Verification and source integrity
                </h4>
                {onRevalidate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRevalidate}
                    disabled={isRevalidating}
                    className="h-6 text-[11px] font-sans text-[#1F3D2E] hover:bg-[#1F3D2E]/10 px-2 cursor-pointer gap-1"
                  >
                    <RotateCw className={`h-3 w-3 stroke-[1.75] ${isRevalidating ? "animate-spin" : ""}`} />
                    {isRevalidating ? "Checking..." : "Revalidate"}
                  </Button>
                )}
              </div>

              <div className="space-y-1.5 text-xs font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Source Platform:</span>
                  <span className="font-medium text-foreground">{conn.displayName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-sans text-emerald-700 font-semibold">{humanizeStatus(job.verificationStatus)}</span>
                </div>
                {job.lastVerifiedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last Verified:</span>
                    <span className="font-mono text-muted-foreground">{new Date(job.lastVerifiedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Skills & Key Tools */}
            {parsedSkills.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-serif font-bold text-foreground">
                  Required and preferred skills
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {parsedSkills.map((skill: string, i: number) => (
                    <span 
                      key={i} 
                      className="px-2.5 py-1 rounded-md text-xs font-sans bg-slate-100 text-slate-800 border border-slate-200/80"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Key Requirements */}
            {parsedRequirements.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-serif font-bold text-foreground">
                  Key requirements
                </h4>
                <ul className="space-y-1.5 list-disc list-inside text-xs font-sans text-muted-foreground">
                  {parsedRequirements.map((req: string, i: number) => (
                    <li key={i} className="leading-relaxed text-slate-700">
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Job Description */}
            {job.description && (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <h4 className="text-xs font-serif font-bold text-foreground">
                  Role overview and description
                </h4>
                <div className="text-xs font-sans text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/40 p-4 rounded-xl border border-border/60">
                  {job.description}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom Footer: Action Bar */}
          <div className="p-4 border-t border-border/70 bg-white flex items-center justify-between gap-3 shrink-0">
            {onToggleSave && (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleSave}
                disabled={isSaving}
                className="h-10 px-4 font-sans text-xs gap-1.5 cursor-pointer border-border/80"
              >
                {isSaved ? (
                  <>
                    <BookmarkCheck className="h-4 w-4 text-[#1F3D2E]" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" />
                    <span>Save</span>
                  </>
                )}
              </Button>
            )}

            {effectiveUrl ? (
              <a
                href={effectiveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#1F3D2E] hover:bg-[#162D22] text-white font-sans font-semibold text-xs shadow-xs transition-colors"
              >
                <span>Apply on {conn.displayName}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <Button disabled className="flex-1 h-10 text-xs font-sans">
                Direct Apply Link Unavailable
              </Button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
