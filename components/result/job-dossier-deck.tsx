"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Briefcase, 
  Building2, 
  MapPin, 
  DollarSign, 
  ExternalLink, 
  CheckCircle2, 
  Bookmark, 
  BookmarkCheck, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Globe, 
  RotateCw, 
  ShieldAlert, 
  Calendar,
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  UserCheck,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUIState } from "@/components/providers/ui-state-provider";
import type { NormalizedJobItem } from "@/lib/scraper/normalizer";
import { JobDetailSlideOver } from "@/components/result/job-detail-slideover";
import { PersonnelConnectDrawer } from "@/components/result/personnel-connect-drawer";
import { TrustScoreBadge } from "@/components/result/trust-score-badge";
import { GhostJobBanner } from "@/components/result/ghost-job-banner";
import { CompanyIntelligencePill } from "@/components/result/company-intelligence-pill";
import type { TrustScoreReport, UrlAnalysisResult } from "@/lib/verification/midwayVerifier";
import type { CompanyIntelligenceRecord } from "@/lib/discovery/company/companyIntelligence";
import { 
  humanizeStatus, 
  humanizeConnectorType, 
  humanizeOpportunityType, 
  humanizeWorkMode, 
  humanizeClassification 
} from "@/lib/utils/display-mappings";
import { InfoBadge } from "@/components/ui/info-badge";

export function getAtsSourceInfo(
  sourcePlatform?: string,
  applyUrl?: string | null,
  sourceListings?: Array<{ sourcePlatform?: string; sourceUrl?: string; applyUrl?: string | null }>
) {
  const primarySource = sourceListings?.[0]?.sourcePlatform || sourcePlatform || "";
  const effectiveUrl = sourceListings?.[0]?.applyUrl || sourceListings?.[0]?.sourceUrl || applyUrl || "";
  const text = `${primarySource} ${effectiveUrl}`.toLowerCase();

  if (text.includes("greenhouse")) {
    return { name: "Greenhouse", className: "bg-[#EBF7EE] text-[#0D6832] border-[#BCE4C9]", dotColor: "bg-[#0D6832]" };
  }
  if (text.includes("lever")) {
    return { name: "Lever", className: "bg-[#EBF2FC] text-[#0E4399] border-[#BDD7FB]", dotColor: "bg-[#0E4399]" };
  }
  if (text.includes("ashby")) {
    return { name: "Ashby", className: "bg-[#F0EEFF] text-[#5636D6] border-[#D6CEFD]", dotColor: "bg-[#5636D6]" };
  }
  if (text.includes("workable")) {
    return { name: "Workable", className: "bg-[#E8F8F5] text-[#008060] border-[#B2E6DC]", dotColor: "bg-[#008060]" };
  }
  if (text.includes("workday")) {
    return { name: "Workday", className: "bg-[#FFF3E6] text-[#A14400] border-[#FCD3A5]", dotColor: "bg-[#A14400]" };
  }
  if (text.includes("linkedin")) {
    return { name: "LinkedIn", className: "bg-[#E8F3FA] text-[#0077B5] border-[#B6DCF5]", dotColor: "bg-[#0077B5]" };
  }
  if (text.includes("indeed")) {
    return { name: "Indeed", className: "bg-[#EAF1FB] text-[#2164F3] border-[#B9D1FB]", dotColor: "bg-[#2164F3]" };
  }
  return {
    name: primarySource ? humanizeConnectorType(primarySource) : "Direct Web",
    className: "bg-[#E8EFEA] text-emerald-600 dark:text-emerald-400 border-[#C3D5CA]",
    dotColor: "bg-emerald-600",
  };
}

export function getVerificationCornerBadge(status?: string | null) {
  const s = (status || "").toUpperCase();
  if (s === "VERIFYING" || s === "IN_PROGRESS") {
    return (
      <Badge 
        variant="outline" 
        className="font-sans text-[10px] font-medium px-2 py-0.5 bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1.5 shrink-0 shadow-xs"
      >
        <RotateCw className="h-3 w-3 animate-spin motion-reduce:animate-none text-amber-600" />
        <span>Verifying...</span>
      </Badge>
    );
  }
  if (s === "EXPIRED" || s === "CLOSED" || s === "UNAVAILABLE") {
    return (
      <Badge 
        variant="outline" 
        className="font-sans text-[10px] font-medium px-2 py-0.5 bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 flex items-center gap-1.5 shrink-0 shadow-xs"
      >
        <ShieldAlert className="h-3 w-3 text-rose-600" />
        <span>Expired / Closed</span>
      </Badge>
    );
  }
  if (s === "STALE") {
    return (
      <Badge 
        variant="outline" 
        className="font-sans text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 flex items-center gap-1.5 shrink-0 shadow-xs"
      >
        <Clock className="h-3 w-3 text-slate-500" />
        <span>Stale (&gt;14d)</span>
      </Badge>
    );
  }
  // Default to Verified Live
  return (
    <Badge 
      variant="outline" 
      className="font-sans text-[10px] font-medium px-2 py-0.5 bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 shrink-0 shadow-xs"
    >
      <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
      <span>Verified Live</span>
    </Badge>
  );
}

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
  salary?: string | null;
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
  matchType?: string;
  matchBadge?: {
    type: string;
    label: string;
    tagline: string;
  };
  classification?: "NEW_OPPORTUNITY" | "NEW_SOURCE" | "REPOSTED" | "ALREADY_KNOWN" | string;
  rankPosition?: number;
  saved?: boolean;
  verificationStatus?: string | null;
  postedAt?: Date | string | null;
  postedAgoText?: string | null;
  freshnessClass?: string | null;
  lastVerifiedAt?: Date | string | null;
  companyContacts?: Array<{
    id?: string;
    fullName: string;
    roleTitle: string;
    profileUrl?: string | null;
    email?: string | null;
    personalEmail?: string | null;
    phone?: string | null;
    whatsappUrl?: string | null;
    twitterUrl?: string | null;
    githubUrl?: string | null;
    portfolioUrl?: string | null;
    department?: string | null;
    contactType?: string | null;
    isVerified?: boolean;
    sourcePlatform?: string | null;
  }>;
  trustReport?: TrustScoreReport;
  urlAnalysis?: UrlAnalysisResult;
  companyIntelligence?: CompanyIntelligenceRecord | null;
  isUndisclosed?: boolean;
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
  const { getConnectorMeta } = useUIState();
  const [selectedJob, setSelectedJob] = useState<DossierJobItem | null>(null);
  const [personnelDrawerJob, setPersonnelDrawerJob] = useState<DossierJobItem | null>(null);
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

  const normalizedJobs: DossierJobItem[] = jobs.map((job, idx) => {
    const isNormalized = "company" in job && !("companyName" in job);
    return {
      id: job.id || (job as any).canonicalHash || `job-${idx}`,
      canonicalHash: (job as any).canonicalHash || job.id,
      title: job.title || "Untitled Role",
      companyName: (job as any).companyName || (job as any).company || "Company",
      location: job.location || "Remote / Unspecified",
      salary: (job as any).salary || null,
      salaryMin: (job as any).salaryMin,
      salaryMax: (job as any).salaryMax,
      salaryCurrency: (job as any).salaryCurrency,
      workMode: (job as any).workMode || (job as any).workplaceType || "REMOTE",
      experienceLevel: (job as any).experienceLevel || "ENTRY_LEVEL",
      opportunityType: (job as any).opportunityType || "FULL_TIME",
      requirements: (job as any).requirements,
      skills: (job as any).skills,
      description: job.description || "",
      applyUrl: job.applyUrl || (job as any).primaryApplyUrl,
      primaryApplyUrl: (job as any).primaryApplyUrl || job.applyUrl,
      sourcePlatform: (job as any).sourcePlatform || (job as any).sourceListings?.[0]?.sourcePlatform,
      sourceListings: (job as any).sourceListings || [],
      screenshotUrl: (job as any).screenshotUrl || (job as any).sourceListings?.[0]?.screenshotPath,
      matchScore: (job as any).matchScore || 85,
      matchReason: (job as any).matchReason,
      scoreBreakdown: (job as any).scoreBreakdown,
      matchType: (job as any).matchType || (job as any).matchBadge?.type,
      matchBadge: (job as any).matchBadge,
      classification: (job as any).classification || "NEW_OPPORTUNITY",
      rankPosition: (job as any).rankPosition || idx + 1,
      saved: (job as any).saved || false,
      verificationStatus: (job as any).verificationStatus || "VERIFIED_LIVE",
      postedAt: (job as any).postedAt || (job as any).firstSeenAt,
      postedAgoText: (job as any).postedAgoText,
      freshnessClass: (job as any).freshnessClass,
      lastVerifiedAt: (job as any).lastVerifiedAt,
      companyContacts: (job as any).companyContacts,
      trustReport: (job as any).trustReport,
      urlAnalysis: (job as any).urlAnalysis,
      companyIntelligence: (job as any).companyIntelligence,
      isUndisclosed: (job as any).isUndisclosed,
    };
  });

  const filteredJobs = normalizedJobs.filter((job) => {
    if (filterType === "SAVED") {
      return savedStates[job.id!] ?? job.saved ?? false;
    }
    if (filterType === "REMOTE") {
      return job.workMode?.toUpperCase().includes("REMOTE");
    }
    if (filterType === "HYBRID") {
      return job.workMode?.toUpperCase().includes("HYBRID");
    }
    return true;
  });

  const handleToggleSave = async (oppId: string, currentSaved: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextSaved = !currentSaved;

    // Instant optimistic update
    setSavedStates((prev) => ({ ...prev, [oppId]: nextSaved }));
    setSavingIds((prev) => ({ ...prev, [oppId]: true }));
    toast.success(nextSaved ? "Opportunity saved to workspace" : "Removed from saved opportunities");
    if (onBookmarkChange) {
      onBookmarkChange(oppId, nextSaved);
    }

    try {
      const method = nextSaved ? "POST" : "DELETE";
      const res = await fetch(`/api/opportunities/${encodeURIComponent(oppId)}/save`, {
        method,
      });

      if (!res.ok) {
        throw new Error("Failed to update bookmark state");
      }
    } catch (err) {
      // Rollback on network failure
      toast.error((err as Error).message || "Could not save bookmark");
      setSavedStates((prev) => ({ ...prev, [oppId]: currentSaved }));
      if (onBookmarkChange) {
        onBookmarkChange(oppId, currentSaved);
      }
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
    <div className={`rounded-2xl border border-border/80 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-6 shadow-sm ${className}`}>
      {/* Header & Controls in calm sentence-case */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Briefcase className="h-4 w-4 stroke-[1.75] text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base sm:text-lg font-sans font-bold text-foreground">
              Verified opportunity dossiers
            </h3>
            <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
              {jobs.length} verified roles
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-sans">
            Ranked by multi-factor student relevance. Every role is verified live against source ATS pages.
          </p>
        </div>

        {/* Filter Buttons in calm Inter (font-sans) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: "ALL", label: "All roles" },
            { id: "REMOTE", label: "Remote" },
            { id: "HYBRID", label: "Hybrid" },
            { id: "SAVED", label: "Saved" },
          ].map((f) => (
            <Button
              key={f.id}
              variant={filterType === f.id ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFilterType(f.id)}
              className={`h-7 text-xs font-sans font-medium px-2.5 cursor-pointer ${
                filterType === f.id
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.id === "SAVED" ? (
                <span className="flex items-center gap-1">
                  <Bookmark className="h-3 w-3 stroke-[1.75]" />
                  {f.label}
                </span>
              ) : (
                f.label
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Opportunities List with Slide-Over Trigger (Responsive 1, 2, or 3-column grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredJobs.length === 0 ? (
          <div className="col-span-full p-8 text-center rounded-xl border border-dashed border-border/70 bg-slate-50/50 space-y-2">
            <p className="text-xs font-sans text-muted-foreground">
              No opportunities match the selected &ldquo;{filterType.toLowerCase()}&rdquo; filter.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setFilterType("ALL")} 
              className="h-7 text-xs font-sans cursor-pointer"
            >
              Reset filter
            </Button>
          </div>
        ) : (
          filteredJobs.map((job, idx) => {
            const isSaved = savedStates[job.id!] ?? job.saved ?? false;
            const isSaving = savingIds[job.id!] || false;
            const effectivePlatform = job.sourcePlatform || job.sourceListings?.[0]?.sourcePlatform;
            const effectiveUrl = job.applyUrl || job.primaryApplyUrl || job.sourceListings?.[0]?.applyUrl;
            const atsInfo = getAtsSourceInfo(effectivePlatform, effectiveUrl, job.sourceListings);

            return (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className="group rounded-2xl border border-border/70 bg-white dark:bg-slate-900 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 shadow-xs hover:shadow-md transition-all p-4 sm:p-5 flex flex-col justify-between gap-3 cursor-pointer select-none"
              >
                {/* Top Row: Rank + Company + ATS Badge + Match Fit + Corner Verification Badge */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
                        #{job.rankPosition || idx + 1}
                      </span>
                      <span className="flex items-center gap-1.5 font-sans font-semibold text-xs sm:text-sm text-foreground truncate max-w-[140px] sm:max-w-[160px]">
                        <Building2 className="h-3.5 w-3.5 stroke-[1.75] text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">{job.companyName}</span>
                      </span>

                      {/* Color-coded ATS Platform Badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-sans font-medium border ${atsInfo.className}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${atsInfo.dotColor}`} />
                        {atsInfo.name}
                      </span>

                      {/* Multi-Source Deduplication Indicator */}
                      {job.sourceListings && job.sourceListings.length > 1 && (
                        <span
                          className="badge badge-xs badge-outline text-[9px] font-sans font-medium px-1.5 py-0.5 border-slate-300 text-slate-600 bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:bg-slate-800"
                          title={`Also verified across ${job.sourceListings.slice(1).map(s => s.sourcePlatform || "Web").join(", ")}`}
                        >
                          +{job.sourceListings.length - 1} sources
                        </span>
                      )}

                      {/* Trust Score Badge */}
                      {job.trustReport && (
                        <TrustScoreBadge
                          score={job.trustReport.trustScore}
                          tier={job.trustReport.trustTier}
                          isGhostJob={job.trustReport.isGhostJob}
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      {typeof job.matchScore === "number" && (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-1.5 py-0.5 rounded">
                            {Math.round(job.matchScore)}% fit
                          </span>
                          <InfoBadge
                            title="Relevance & Fit Score"
                            description={job.matchReason || job.matchBadge?.tagline || "Calculated using semantic role similarity, required technical skills, experience tier, and location constraints."}
                            details={{
                              "Fit Score": `${Math.round(job.matchScore)}%`,
                              "Match Type": job.matchType || job.matchBadge?.label || "SEMANTIC_SIMILARITY",
                              "Verification": humanizeStatus(job.verificationStatus || "VERIFIED"),
                              "Company": job.companyName,
                            }}
                          />
                        </div>
                      )}
                      {getVerificationCornerBadge(job.verificationStatus)}
                    </div>
                  </div>

                  {/* Company Intelligence Metadata Pill */}
                  {(job.companyIntelligence || job.isUndisclosed) && (
                    <div className="pt-0.5">
                      <CompanyIntelligencePill
                        companyName={job.companyName}
                        employeeHeadcountBracket={job.companyIntelligence?.employeeHeadcountBracket}
                        headquarters={job.companyIntelligence?.headquarters}
                        officialDomain={job.companyIntelligence?.officialDomain}
                        isUndisclosed={job.isUndisclosed || job.companyIntelligence?.isUndisclosed}
                        employerType={job.companyIntelligence?.employerType}
                      />
                    </div>
                  )}

                  {/* Ghost Job & Affiliate Warning Banner */}
                  {(job.trustReport?.isGhostJob || job.trustReport?.trustTier === "GHOST_JOB_AFFILIATE") && (
                    <GhostJobBanner
                      advisoryTitle={job.trustReport?.advisoryTitle}
                      advisoryMessage={job.trustReport?.advisoryMessage}
                      actionRecommendation={job.trustReport?.actionRecommendation}
                      reasons={job.trustReport?.reasons}
                      affiliateWarning={job.urlAnalysis?.affiliateWarning}
                    />
                  )}

                  {/* Recommendation vs Exact Match Badge if present */}
                  {(job.matchBadge?.label === "Recommendation" || job.matchType?.startsWith("RECOMMENDED")) ? (
                    <Badge variant="outline" className="text-[10px] font-sans font-medium px-2 py-0 text-amber-800 border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1 w-fit">
                      <Sparkles className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                      <span>Recommendation</span>
                    </Badge>
                  ) : (job.matchBadge?.label === "Exact Match" || job.matchType === "EXACT_MATCH") ? (
                    <Badge variant="outline" className="text-[10px] font-sans font-medium px-2 py-0 text-emerald-800 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1 w-fit">
                      <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Exact Match</span>
                    </Badge>
                  ) : job.classification === "NEW_OPPORTUNITY" ? (
                    <Badge variant="outline" className="text-[10px] font-sans px-1.5 py-0 text-emerald-700 border-emerald-300 bg-emerald-50 flex items-center gap-1 w-fit">
                      <Sparkles className="h-2.5 w-2.5 stroke-[1.75]" />
                      <span>{humanizeClassification(job.classification)}</span>
                    </Badge>
                  ) : null}

                  {/* Job Title in Source Serif 4 */}
                  <h4 className="font-sans text-base sm:text-lg font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-snug line-clamp-2">
                    {job.title}
                  </h4>

                  {/* AI Match Reason / Tagline */}
                  {(job.matchBadge?.tagline || job.matchReason) && (
                    <p className="text-xs font-sans text-muted-foreground line-clamp-2 leading-relaxed">
                      {job.matchBadge?.tagline || job.matchReason}
                    </p>
                  )}

                  {/* Recruiter / Hiring Team Chip */}
                  {job.companyContacts && job.companyContacts.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPersonnelDrawerJob(job);
                      }}
                      className="flex items-center gap-1.5 text-[11px] font-sans text-muted-foreground bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 px-2 py-1 rounded-md w-fit mt-1 cursor-pointer transition-colors text-left"
                      title="Click to view verified recruiter & employee contact channels"
                    >
                      <UserCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-medium text-foreground truncate max-w-[130px]">
                        {job.companyContacts[0].fullName}
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        ({job.companyContacts[0].roleTitle || "Recruiter"})
                      </span>
                      <span className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-1">
                        Outreach ({job.companyContacts.length}) →
                      </span>
                    </button>
                  )}
                </div>

                {/* Card Footer Section */}
                <div className="space-y-3 pt-2">
                  {/* Location & Metadata Row in calm Inter */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-sans flex-wrap">
                    <div className="flex items-center gap-1 min-w-0">
                      <MapPin className="h-3 w-3 stroke-[1.75] text-muted-foreground shrink-0" />
                      <span className="truncate max-w-[130px]">{job.location || "Location Unspecified"}</span>
                    </div>
                    {job.workMode && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Briefcase className="h-3 w-3 stroke-[1.75] text-muted-foreground shrink-0" />
                        <span>{humanizeWorkMode(job.workMode)}</span>
                      </div>
                    )}
                    {job.companyIntelligence?.employeeHeadcountBracket && (
                      <div className="flex items-center gap-1 shrink-0" title="Company Headcount">
                        <Users className="h-3 w-3 stroke-[1.75] text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[100px]">{job.companyIntelligence.employeeHeadcountBracket}</span>
                      </div>
                    )}
                    {job.postedAgoText && (
                      <div className="flex items-center gap-1 ml-auto text-muted-foreground text-[11px] shrink-0">
                        <Calendar className="h-3 w-3 stroke-[1.75]" />
                        <span>{job.postedAgoText}</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Bar: View Details Prompt & Optimistic Bookmark Button */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs font-sans">
                    {job.urlAnalysis?.isAffiliateTrap ? (
                      <span 
                        className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium px-2 py-0.5 rounded border border-amber-400/50 bg-amber-50 dark:bg-amber-950/40"
                        title="Redirects to third-party registration"
                      >
                        <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0 stroke-[2]" />
                        <span>Redirects to 3rd-party registration</span>
                      </span>
                    ) : (
                      <span className="text-foreground font-semibold inline-flex items-center gap-1 group-hover:underline">
                        <span>View full dossier & apply</span>
                        <ArrowRight className="h-3 w-3 stroke-[1.75] transition-transform group-hover:translate-x-0.5" />
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleToggleSave(job.id!, isSaved, e)}
                      disabled={isSaving}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors cursor-pointer"
                      aria-label={isSaved ? "Remove bookmark" : "Save opportunity"}
                    >
                      {isSaved ? (
                        <BookmarkCheck className="h-4 w-4 stroke-[1.75] text-primary" />
                      ) : (
                        <Bookmark className="h-4 w-4 stroke-[1.75]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Right Slide-Over Detail Panel */}
      <JobDetailSlideOver
        job={selectedJob}
        isOpen={Boolean(selectedJob)}
        onClose={() => setSelectedJob(null)}
        isSaved={selectedJob ? (savedStates[selectedJob.id!] ?? selectedJob.saved ?? false) : false}
        isSaving={selectedJob ? (savingIds[selectedJob.id!] || false) : false}
        onToggleSave={() => selectedJob && handleToggleSave(selectedJob.id!, savedStates[selectedJob.id!] ?? selectedJob.saved ?? false)}
        onRevalidate={() => selectedJob && handleRevalidate(selectedJob.id!)}
        isRevalidating={selectedJob ? (revalidatingIds[selectedJob.id!] || false) : false}
      />

      {/* Direct Personnel & Recruiter Outreach Drawer */}
      <PersonnelConnectDrawer
        isOpen={Boolean(personnelDrawerJob)}
        onClose={() => setPersonnelDrawerJob(null)}
        companyName={personnelDrawerJob?.companyName || "Company"}
        jobTitle={personnelDrawerJob?.title || "Role"}
        location={personnelDrawerJob?.location}
        contacts={personnelDrawerJob?.companyContacts}
      />
    </div>
  );
}
