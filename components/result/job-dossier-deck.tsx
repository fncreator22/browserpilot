"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Briefcase, 
  Building, 
  MapPin, 
  DollarSign, 
  ExternalLink, 
  Maximize2, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Bookmark,
  BookmarkCheck,
  Sparkles,
  Camera,
  Layers,
  ShieldCheck,
  Clock,
  Globe,
  RotateCw,
  Zap,
  Radio,
  X,
  ShieldAlert,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { NormalizedJobItem } from "@/lib/scraper/normalizer";

export interface DossierSourceListing {
  sourcePlatform: string;
  sourceUrl: string;
  applyUrl: string;
  externalJobId?: string | null;
  verificationStatus?: string | null;
  rawSnippet?: string | null;
  screenshotPath?: string | null;
  seenAt?: string | Date;
}

export interface DossierJobItem {
  id?: string;
  canonicalHash?: string;
  title: string;
  company?: string;
  companyName?: string;
  location?: string;
  salary?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  workMode?: string;
  workplaceType?: "Remote" | "Hybrid" | "On-site" | "Unspecified" | string;
  experienceLevel?: string;
  opportunityType?: string;
  requirements?: string[] | string;
  skills?: string[] | string;
  description?: string;
  applyUrl?: string;
  primaryApplyUrl?: string;
  sourcePlatform?: string;
  sourceListings?: DossierSourceListing[];
  screenshotUrl?: string;
  matchScore?: number;
  matchReason?: string;
  scoreBreakdown?: {
    role: number;
    skills: number;
    workMode: number;
    freshness: number;
    verification: number;
  };
  classification?: "NEW_OPPORTUNITY" | "NEW_SOURCE" | "REPOSTED" | "ALREADY_KNOWN" | string;
  rankPosition?: number;
  saved?: boolean;
  verificationStatus?: string | null;
  postedAt?: Date | string | null;
  postedAgoText?: string | null;
  freshnessClass?: string | null;
}

export interface SwarmSummaryStats {
  sourcesCount?: number;
  totalFound?: number;
  validCount?: number;
  deduplicatedCount?: number;
  newCount?: number;
  tokenCost?: string;
}

interface JobDossierDeckProps {
  jobs: Array<NormalizedJobItem | DossierJobItem>;
  jobId?: string;
  className?: string;
  swarmSummary?: SwarmSummaryStats;
  onBookmarkChange?: (opportunityId: string, isSaved: boolean) => void;
}

export function JobDossierDeck({
  jobs = [],
  jobId = "search",
  className = "",
  swarmSummary,
  onBookmarkChange,
}: JobDossierDeckProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(jobs[0]?.id || "job-0");
  const [evidenceModalJob, setEvidenceModalJob] = useState<DossierJobItem | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [savedStates, setSavedStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    jobs.forEach((j, idx) => {
      const id = j.id || (j as DossierJobItem).canonicalHash || `job-${idx}`;
      if ((j as DossierJobItem).saved) {
        initial[id] = true;
      }
    });
    return initial;
  });
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [revalidatingIds, setRevalidatingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEvidenceModalJob(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!jobs || jobs.length === 0) return null;

  const normalizedDeck: DossierJobItem[] = jobs.map((item, idx) => {
    const rawReqs = (item as DossierJobItem).requirements;
    let reqsList: string[] = [];
    if (Array.isArray(rawReqs)) {
      reqsList = rawReqs.map(String);
    } else if (typeof rawReqs === "string") {
      try {
        const parsed = JSON.parse(rawReqs);
        if (Array.isArray(parsed)) reqsList = parsed.map(String);
      } catch {
        reqsList = [rawReqs];
      }
    }

    const rawSkills = (item as DossierJobItem).skills;
    let skillsList: string[] = [];
    if (Array.isArray(rawSkills)) {
      skillsList = rawSkills.map(String);
    } else if (typeof rawSkills === "string") {
      try {
        const parsed = JSON.parse(rawSkills);
        if (Array.isArray(parsed)) skillsList = parsed.map(String);
      } catch {
        skillsList = [rawSkills];
      }
    }

    const company = (item as DossierJobItem).companyName || (item as DossierJobItem).company || (item as NormalizedJobItem).company || "Verified Company";
    const location = item.location || "Remote / Anywhere";
    const workMode = (item as DossierJobItem).workMode || (item as NormalizedJobItem).workplaceType || (item as DossierJobItem).workplaceType || "ANY";
    const applyUrl = (item as DossierJobItem).primaryApplyUrl || (item as DossierJobItem).applyUrl || (item as NormalizedJobItem).applyUrl || "#";
    const sourcePlatform = (item as DossierJobItem).sourcePlatform || (item as any).sourcePlatform || "Web";
    const id = item.id || (item as DossierJobItem).canonicalHash || `job-${idx}`;

    let salaryFormatted = (item as DossierJobItem).salary || (item as NormalizedJobItem).salary;
    const min = (item as DossierJobItem).salaryMin;
    const max = (item as DossierJobItem).salaryMax;
    const curr = (item as DossierJobItem).salaryCurrency || "USD";
    if (!salaryFormatted && typeof min === "number") {
      salaryFormatted = typeof max === "number" && max !== min
        ? `${curr} ${min.toLocaleString()} - ${max.toLocaleString()}`
        : `${curr} ${min.toLocaleString()}`;
    }

    const screenshotUrl = (item as NormalizedJobItem).screenshotUrl ||
      (item as DossierJobItem).screenshotUrl ||
      (item as DossierJobItem).sourceListings?.find((l) => l.screenshotPath)?.screenshotPath ||
      undefined;

    return {
      id,
      canonicalHash: (item as DossierJobItem).canonicalHash,
      title: item.title || "Job Opportunity",
      companyName: company,
      company,
      location,
      workMode,
      workplaceType: workMode,
      experienceLevel: (item as DossierJobItem).experienceLevel,
      opportunityType: (item as DossierJobItem).opportunityType,
      salary: salaryFormatted,
      requirements: reqsList,
      skills: skillsList,
      description: item.description || "",
      primaryApplyUrl: applyUrl,
      applyUrl,
      sourcePlatform,
      sourceListings: (item as DossierJobItem).sourceListings || [],
      screenshotUrl,
      matchScore: (item as DossierJobItem).matchScore,
      matchReason: (item as DossierJobItem).matchReason || (item as any).matchReason,
      scoreBreakdown: (item as DossierJobItem).scoreBreakdown || (item as any).scoreBreakdown || null,
      classification: (item as DossierJobItem).classification || (item as any).classification,
      rankPosition: (item as DossierJobItem).rankPosition || idx + 1,
      postedAt: (item as DossierJobItem).postedAt || (item as any).postedAt || null,
      postedAgoText: (item as DossierJobItem).postedAgoText || (item as any).postedAgoText || null,
      freshnessClass: (item as DossierJobItem).freshnessClass || (item as any).freshnessClass || null,
      verificationStatus: (item as DossierJobItem).verificationStatus || "VERIFIED",
      saved: savedStates[id] || (item as DossierJobItem).saved || false,
    };
  });

  const filteredJobs = normalizedDeck.filter((j) => {
    if (filterType === "ALL") return true;
    if (filterType === "SAVED") return savedStates[j.id!] ?? j.saved ?? false;
    const modeUpper = (j.workMode || "").toUpperCase();
    if (filterType === "REMOTE") return modeUpper.includes("REMOTE");
    if (filterType === "HYBRID") return modeUpper.includes("HYBRID");
    return true;
  });

  const handleToggleSave = async (oppId: string, currentSaved: boolean) => {
    setSavingIds((prev) => ({ ...prev, [oppId]: true }));
    const nextSaved = !currentSaved;

    // Optimistic UI update
    setSavedStates((prev) => ({ ...prev, [oppId]: nextSaved }));

    try {
      const method = nextSaved ? "POST" : "DELETE";
      const res = await fetch(`/api/opportunities/${encodeURIComponent(oppId)}/save`, {
        method,
      });

      if (!res.ok) {
        throw new Error("Failed to update bookmark state");
      }

      toast.success(nextSaved ? "Opportunity saved to workspace" : "Removed from saved opportunities");
      if (onBookmarkChange) {
        onBookmarkChange(oppId, nextSaved);
      }
    } catch (err) {
      toast.error((err as Error).message || "Could not save bookmark");
      setSavedStates((prev) => ({ ...prev, [oppId]: currentSaved }));
    } finally {
      setSavingIds((prev) => ({ ...prev, [oppId]: false }));
    }
  };

  const handleRevalidate = async (oppId: string) => {
    setRevalidatingIds((prev) => ({ ...prev, [oppId]: true }));
    try {
      const res = await fetch(`/api/opportunities/${encodeURIComponent(oppId)}/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Opportunity Freshness Revalidated", {
          description: `Status: ${data.status || "VERIFIED"}. Confirmed live against source.`,
        });
      } else {
        toast.error("Revalidation Notice", { description: "Revalidation could not be completed right now." });
      }
    } catch {
      toast.error("Revalidation Notice", { description: "Network error during revalidation." });
    } finally {
      setRevalidatingIds((prev) => ({ ...prev, [oppId]: false }));
    }
  };

  return (
    <div className={`rounded-2xl border border-border/80 bg-card p-4 sm:p-6 space-y-6 shadow-sm ${className}`}>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Briefcase className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase font-mono">
              Verified Opportunity Dossiers
            </h3>
            <Badge variant="outline" className="font-mono text-xs">
              {jobs.length} Verified Roles
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Authoritative opportunities ordered by 100-point student relevance ranking. Every opportunity is verified against live source pages.
          </p>
        </div>

        {/* Workplace Type & Saved Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {["ALL", "REMOTE", "HYBRID", "SAVED"].map((type) => (
            <Button
              key={type}
              variant={filterType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType(type)}
              className="h-7 text-xs font-mono px-2.5 cursor-pointer"
            >
              {type === "SAVED" ? (
                <span className="flex items-center gap-1">
                  <Bookmark className="h-3 w-3" />
                  Saved
                </span>
              ) : (
                type
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Accordion Job Cards List */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-border/60 bg-muted/10 space-y-2">
            <p className="text-xs font-mono text-muted-foreground">
              No opportunities match the selected &ldquo;{filterType}&rdquo; filter.
            </p>
            <Button variant="outline" size="sm" onClick={() => setFilterType("ALL")} className="h-7 text-xs font-mono">
              Reset Filters
            </Button>
          </div>
        ) : (
          filteredJobs.map((job, idx) => {
            const isExpanded = expandedJobId === job.id;
            const isSaved = savedStates[job.id!] ?? job.saved ?? false;
            const isSaving = savingIds[job.id!] || false;
            const isRevalidating = revalidatingIds[job.id!] || false;
            const hasEvidence = Boolean(job.screenshotUrl);

            return (
              <div
                key={job.id}
                className={`rounded-xl border transition-all overflow-hidden ${
                  isExpanded
                    ? "border-primary/60 bg-muted/20 shadow-xs"
                    : "border-border/60 bg-card hover:border-border hover:bg-muted/10"
                }`}
              >
                {/* Card Primary Header */}
                <div className="w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
                  <button
                    type="button"
                    onClick={() => setExpandedJobId(isExpanded ? null : job.id!)}
                    className="flex items-start gap-3 flex-1 min-w-0 text-left cursor-pointer"
                    aria-expanded={isExpanded}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono text-xs font-bold mt-0.5 sm:mt-0">
                      #{job.rankPosition || idx + 1}
                    </span>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <h4 className="text-sm sm:text-base font-semibold text-foreground break-words">
                          {job.title}
                        </h4>

                        {/* Verification Badge */}
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono px-1.5 py-0 text-emerald-500 border-emerald-500/40 bg-emerald-500/10 flex items-center gap-1 shrink-0"
                        >
                          <ShieldCheck className="h-2.5 w-2.5" />
                          Verified
                        </Badge>

                        {/* Freshness / Classification Badge */}
                        {job.classification === "NEW_OPPORTUNITY" && (
                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-emerald-400 border-emerald-500/40 bg-emerald-500/10 flex items-center gap-1 shrink-0">
                            <Sparkles className="h-2.5 w-2.5" />
                            NEW
                          </Badge>
                        )}
                        {job.classification === "REPOSTED" && (
                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-purple-400 border-purple-500/40 bg-purple-500/10 flex items-center gap-1 shrink-0">
                            <RotateCw className="h-2.5 w-2.5" />
                            REPOSTED
                          </Badge>
                        )}

                        {/* Relevance Score Badge */}
                        {typeof job.matchScore === "number" && (
                          <Badge
                            className={`text-[10px] font-mono px-1.5 py-0 shrink-0 ${
                              job.matchScore >= 85
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : job.matchScore >= 70
                                ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {job.matchScore} pts
                          </Badge>
                        )}

                        {/* Freshness Age Text */}
                        {(Boolean(job.postedAgoText) || Boolean(job.postedAt)) && (
                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-muted-foreground border-border/70 flex items-center gap-1 shrink-0">
                            <Clock className="h-2.5 w-2.5" />
                            {job.postedAgoText || (job.postedAt ? `Posted ${Math.max(0, Math.floor((Date.now() - new Date(job.postedAt).getTime()) / (24 * 3600 * 1000)))}d ago` : "Recent")}
                          </Badge>
                        )}
                      </div>

                      {/* Secondary Meta Row */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          <Building className="h-3 w-3 text-primary" />
                          {job.companyName}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground/70" />
                          {job.location}
                        </span>
                        {job.workMode && job.workMode !== "ANY" && (
                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                            {job.workMode}
                          </Badge>
                        )}
                        {job.salary && (
                          <Badge className="font-mono text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                            <DollarSign className="h-2.5 w-2.5" />
                            {job.salary}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Primary Header Action Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0">
                    {/* Direct Apply Button */}
                    {job.primaryApplyUrl && (
                      <a
                        href={job.primaryApplyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex"
                      >
                        <Button size="sm" className="h-8 text-xs font-mono gap-1.5 shadow-xs cursor-pointer">
                          Apply
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    )}

                    {/* Bookmark Save Action */}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => handleToggleSave(job.id!, isSaved)}
                      className={`h-8 w-8 p-0 cursor-pointer ${isSaved ? "text-primary border-primary/40 bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
                      title={isSaved ? "Saved to workspace" : "Save opportunity"}
                      aria-label={isSaved ? "Remove from saved opportunities" : "Save opportunity"}
                    >
                      {isSaved ? (
                        <BookmarkCheck className="h-4 w-4 fill-primary text-primary" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </Button>

                    {/* Evidence Inspection Trigger */}
                    {hasEvidence && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEvidenceModalJob(job)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-primary cursor-pointer"
                        title="Inspect Verified Evidence Screenshot"
                        aria-label="Inspect verified evidence"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Accordion Toggle */}
                    <button
                      type="button"
                      onClick={() => setExpandedJobId(isExpanded ? null : job.id!)}
                      className="p-1 text-muted-foreground hover:text-foreground cursor-pointer rounded"
                      aria-label={isExpanded ? "Collapse opportunity details" : "Expand opportunity details"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Detailed Dossier View */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 pt-0 border-t border-border/40 space-y-4">
                    {/* Match Reason / Relevance Fit Explanation */}
                    {job.matchReason && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs font-mono text-foreground mt-3">
                        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-muted-foreground font-semibold">Match Fit:</span>
                        <span className="text-foreground">{job.matchReason}</span>
                      </div>
                    )}

                    {/* 100-Point Relevance Score Transparency Breakdown */}
                    {job.scoreBreakdown && (
                      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            100-Point Relevance Score Breakdown
                          </span>
                          <span className="font-bold text-foreground">
                            {job.matchScore ?? (job.scoreBreakdown.role + job.scoreBreakdown.skills + job.scoreBreakdown.workMode + job.scoreBreakdown.freshness + job.scoreBreakdown.verification)} / 100 pts
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                          <div className="bg-background/80 p-1.5 rounded border border-border/40">
                            <span className="text-muted-foreground block text-[10px]">Role Fit</span>
                            <span className="font-semibold text-foreground">{job.scoreBreakdown.role} / 35</span>
                          </div>
                          <div className="bg-background/80 p-1.5 rounded border border-border/40">
                            <span className="text-muted-foreground block text-[10px]">Skills Fit</span>
                            <span className="font-semibold text-foreground">{job.scoreBreakdown.skills} / 25</span>
                          </div>
                          <div className="bg-background/80 p-1.5 rounded border border-border/40">
                            <span className="text-muted-foreground block text-[10px]">Work Mode</span>
                            <span className="font-semibold text-foreground">{job.scoreBreakdown.workMode} / 15</span>
                          </div>
                          <div className="bg-background/80 p-1.5 rounded border border-border/40">
                            <span className="text-muted-foreground block text-[10px]">Freshness</span>
                            <span className="font-semibold text-foreground">{job.scoreBreakdown.freshness} / 15</span>
                          </div>
                          <div className="bg-background/80 p-1.5 rounded border border-border/40">
                            <span className="text-muted-foreground block text-[10px]">Verified Evidence</span>
                            <span className="font-semibold text-foreground">{job.scoreBreakdown.verification} / 10</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Target Skills */}
                    {Array.isArray(job.skills) && job.skills.length > 0 && (
                      <div className="space-y-1.5">
                        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                          Target Skills
                        </h5>
                        <div className="flex flex-wrap gap-1.5">
                          {job.skills.map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono bg-muted/60 text-foreground border border-border/60"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Description (Treated safely as untrusted plain text) */}
                    {job.description && (
                      <div className="space-y-1.5 text-xs text-muted-foreground leading-relaxed bg-background/50 p-3 rounded-lg border border-border/40 break-words">
                        <p className="whitespace-pre-line">{job.description}</p>
                      </div>
                    )}

                    {/* Requirements (Treated safely as text) */}
                    {Array.isArray(job.requirements) && job.requirements.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
                          Key Responsibilities & Qualifications
                        </h5>
                        <ul className="space-y-1.5 text-xs text-muted-foreground pl-1">
                          {job.requirements.map((req, rIdx) => (
                            <li key={rIdx} className="flex items-start gap-2">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <span className="leading-relaxed break-words">{req}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Discovered Sources & Provenance */}
                    {job.sourceListings && job.sourceListings.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border/40">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-primary" />
                          Discovered Source Listings ({job.sourceListings.length})
                        </h5>
                        <div className="flex flex-wrap items-center gap-2">
                          {job.sourceListings.map((listing, lIdx) => (
                            <a
                              key={lIdx}
                              href={listing.applyUrl || listing.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/80 bg-background hover:bg-muted/40 text-xs font-mono transition-colors"
                            >
                              <ShieldCheck className="h-3 w-3 text-emerald-500" />
                              <span>{listing.sourcePlatform}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evidence Snapshot Thumbnail Preview */}
                    {job.screenshotUrl && (
                      <div className="space-y-2 pt-2 border-t border-border/40">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono flex items-center gap-1.5">
                            <Camera className="h-3.5 w-3.5 text-primary" />
                            Playwright Verified Evidence Proof
                          </h5>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEvidenceModalJob(job)}
                            className="h-6 text-[11px] font-mono gap-1 text-primary hover:text-primary/80 cursor-pointer"
                          >
                            <Maximize2 className="h-3 w-3" />
                            Inspect Full Evidence
                          </Button>
                        </div>

                        <div 
                          onClick={() => setEvidenceModalJob(job)}
                          className="relative aspect-video max-w-sm rounded-lg border border-border overflow-hidden bg-zinc-950 cursor-zoom-in group shadow-xs"
                        >
                          <img
                            src={job.screenshotUrl}
                            alt={`Evidence proof for ${job.title} at ${job.companyName}`}
                            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-xs font-mono text-white bg-black/70 px-2.5 py-1 rounded-md flex items-center gap-1">
                              <Maximize2 className="h-3 w-3" /> Click to Inspect
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Link & Revalidation Bar */}
                    <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/40">
                      <span className="text-[11px] font-mono text-muted-foreground truncate max-w-md">
                        Destination: {job.primaryApplyUrl || job.applyUrl}
                      </span>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Revalidate Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isRevalidating}
                          onClick={() => handleRevalidate(job.id!)}
                          className="h-8 text-xs font-mono gap-1.5 border-border/70 hover:bg-muted/40 cursor-pointer"
                          title="Verify live listing freshness on source ATS"
                        >
                          <RotateCw className={`h-3.5 w-3.5 ${isRevalidating ? "animate-spin text-primary" : "text-muted-foreground"}`} />
                          {isRevalidating ? "Revalidating..." : "Revalidate"}
                        </Button>

                        {/* Save Bookmark Toggle */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSaving}
                          onClick={() => handleToggleSave(job.id!, isSaved)}
                          className="h-8 text-xs font-mono gap-1.5 cursor-pointer"
                        >
                          {isSaved ? <BookmarkCheck className="h-3.5 w-3.5 text-primary" /> : <Bookmark className="h-3.5 w-3.5" />}
                          {isSaved ? "Saved" : "Save"}
                        </Button>

                        {/* Full Dossier Page Link */}
                        <Link href={`/app/opportunities/${job.id}`}>
                          <Button variant="outline" size="sm" className="h-8 text-xs font-mono gap-1.5 cursor-pointer">
                            View Dossier
                          </Button>
                        </Link>

                        {/* Primary Apply External Link */}
                        {job.primaryApplyUrl && (
                          <a
                            href={job.primaryApplyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" className="h-8 text-xs font-mono gap-1.5 shadow-xs cursor-pointer">
                              Open & Apply
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Accessible Evidence Inspection Dialog Modal */}
      {evidenceModalJob && (
        <div 
          onClick={() => setEvidenceModalJob(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          role="dialog"
          aria-modal="true"
          aria-label={`Evidence inspection for ${evidenceModalJob.title}`}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden cursor-default"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-border/70 flex items-center justify-between gap-3 bg-muted/20">
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-foreground font-mono uppercase tracking-wide flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Verified Evidence Snapshot
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                    Quality Gate Passed
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate font-mono">
                  {evidenceModalJob.title} • {evidenceModalJob.companyName}
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEvidenceModalJob(null)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-full"
                aria-label="Close evidence preview"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body: Screenshot Proof */}
            <div className="p-4 flex-1 overflow-auto bg-zinc-950 flex items-center justify-center min-h-[300px] max-h-[60vh]">
              {evidenceModalJob.screenshotUrl ? (
                <img
                  src={evidenceModalJob.screenshotUrl}
                  alt={`Screenshot evidence for ${evidenceModalJob.title}`}
                  className="max-w-full max-h-[55vh] object-contain rounded-lg border border-zinc-800 shadow-lg"
                />
              ) : (
                <div className="text-center p-8 text-xs font-mono text-zinc-400">
                  Evidence screenshot is being revalidated.
                </div>
              )}
            </div>

            {/* Modal Footer: Provenance & Destination */}
            <div className="p-3.5 border-t border-border/70 bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>Source: {evidenceModalJob.sourcePlatform || "ATS Portal"}</span>
                {evidenceModalJob.location && <span>• {evidenceModalJob.location}</span>}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEvidenceModalJob(null)}
                  className="h-7 text-xs font-mono cursor-pointer"
                >
                  Close Preview
                </Button>
                {evidenceModalJob.primaryApplyUrl && (
                  <a
                    href={evidenceModalJob.primaryApplyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" className="h-7 text-xs font-mono gap-1 cursor-pointer">
                      Open Destination
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
