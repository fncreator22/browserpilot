"use client";

import { useState } from "react";
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
  Radio
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

export function JobDossierDeck({ jobs = [], jobId = "search", className = "", swarmSummary, onBookmarkChange }: JobDossierDeckProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(jobs[0]?.id || "job-0");
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
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

    const company = (item as DossierJobItem).companyName || (item as NormalizedJobItem).company || "Company";
    const location = item.location || "Remote / Unspecified";
    const workMode = (item as DossierJobItem).workMode || (item as NormalizedJobItem).workplaceType || "Unspecified";
    const applyUrl = (item as DossierJobItem).primaryApplyUrl || item.applyUrl || "";
    const sourcePlatform = (item as DossierJobItem).sourcePlatform || (item as NormalizedJobItem).sourcePlatform || "Web";
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
      screenshotUrl: (item as NormalizedJobItem).screenshotUrl || (item as DossierJobItem).sourceListings?.find((l) => l.screenshotPath)?.screenshotPath || undefined,
      matchScore: (item as DossierJobItem).matchScore,
      matchReason: (item as DossierJobItem).matchReason || (item as any).matchReason,
      scoreBreakdown: (item as DossierJobItem).scoreBreakdown || (item as any).scoreBreakdown || null,
      classification: (item as DossierJobItem).classification || (item as any).classification,
      rankPosition: (item as DossierJobItem).rankPosition || idx + 1,
      postedAt: (item as DossierJobItem).postedAt || (item as any).postedAt || null,
      postedAgoText: (item as DossierJobItem).postedAgoText || (item as any).postedAgoText || null,
      freshnessClass: (item as DossierJobItem).freshnessClass || (item as any).freshnessClass || null,
      saved: savedStates[id] || (item as DossierJobItem).saved || false,
    };
  });

  const filteredJobs = normalizedDeck.filter((j) => {
    if (filterType === "ALL") return true;
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

  return (
    <div className={`rounded-2xl border border-border/80 bg-card p-6 space-y-6 shadow-md ${className}`}>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase font-mono">
              Verified Opportunity Dossier Deck
            </h3>
            <Badge variant="outline" className="font-mono text-xs">
              {jobs.length} Opportunities
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Multi-source deduplicated opportunities with student relevance ranking and direct application links.
          </p>
        </div>

        {/* Workplace Type Filters */}
        <div className="flex items-center gap-1.5">
          {["ALL", "REMOTE", "HYBRID"].map((type) => (
            <Button
              key={type}
              variant={filterType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType(type)}
              className="h-7 text-xs font-mono px-2.5"
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      {/* Optional Swarm Discovery Summary Bar */}
      {swarmSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/70 font-mono text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase">Sources Searched</span>
            <span className="text-foreground font-bold">{swarmSummary.sourcesCount ?? 3} Active</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase">Discovered</span>
            <span className="text-foreground font-bold">{swarmSummary.totalFound ?? jobs.length} Postings</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase">Deduplicated</span>
            <span className="text-primary font-bold">{swarmSummary.deduplicatedCount ?? 0} Merged</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase">LLM Overhead</span>
            <span className="text-emerald-500 font-bold">{swarmSummary.tokenCost ?? "0 Tokens"}</span>
          </div>
        </div>
      )}

      {/* Accordion Job Cards List */}
      <div className="space-y-3">
        {filteredJobs.map((job, idx) => {
          const isExpanded = expandedJobId === job.id;
          const isSaved = savedStates[job.id!] ?? job.saved ?? false;
          const isSaving = savingIds[job.id!] || false;

          return (
            <div
              key={job.id}
              className={`rounded-xl border transition-all overflow-hidden ${
                isExpanded
                  ? "border-primary/60 bg-muted/20 shadow-xs"
                  : "border-border/60 bg-card hover:border-border hover:bg-muted/10"
              }`}
            >
              {/* Card Header */}
              <div className="w-full p-4 flex items-center justify-between gap-4 select-none">
                <button
                  onClick={() => setExpandedJobId(isExpanded ? null : job.id!)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono text-xs font-semibold">
                    {job.rankPosition || idx + 1}
                  </span>

                  <div className="space-y-0.5 truncate flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground truncate">
                        {job.title}
                      </h4>
                      {job.classification === "NEW_OPPORTUNITY" && (
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-emerald-400 border-emerald-500/40 bg-emerald-500/10 flex items-center gap-1">
                          <Sparkles className="h-2.5 w-2.5" />
                          NEW
                        </Badge>
                      )}
                      {job.classification === "NEW_SOURCE" && (
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-sky-400 border-sky-500/40 bg-sky-500/10 flex items-center gap-1">
                          <Globe className="h-2.5 w-2.5" />
                          NEW SOURCE
                        </Badge>
                      )}
                      {job.classification === "REPOSTED" && (
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-purple-400 border-purple-500/40 bg-purple-500/10 flex items-center gap-1">
                          <RotateCw className="h-2.5 w-2.5" />
                          REPOSTED
                        </Badge>
                      )}
                      {typeof job.matchScore === "number" && (
                        <Badge
                          className={`text-[10px] font-mono px-1.5 py-0 ${
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
                      {(Boolean(job.postedAgoText) || Boolean(job.postedAt)) && (
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-emerald-400 border-emerald-500/30 bg-emerald-500/5 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {job.postedAgoText || (job.postedAt ? `Posted ${Math.max(0, Math.floor((Date.now() - new Date(job.postedAt).getTime()) / (24 * 3600 * 1000)))}d ago` : "Recent")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono truncate">
                      <span className="flex items-center gap-1">
                        <Building className="h-3 w-3 text-muted-foreground/70" />
                        {job.companyName}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground/70" />
                        {job.location}
                      </span>
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Bookmark Save Action Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => handleToggleSave(job.id!, isSaved)}
                    className={`h-8 w-8 p-0 ${isSaved ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"}`}
                    title={isSaved ? "Saved to workspace" : "Save opportunity"}
                  >
                    {isSaved ? (
                      <BookmarkCheck className="h-4 w-4 fill-primary" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </Button>

                  {job.workMode && job.workMode !== "Unspecified" && job.workMode !== "ANY" && (
                    <Badge variant="outline" className="text-[10px] font-mono hidden sm:inline-flex">
                      {job.workMode}
                    </Badge>
                  )}

                  <button
                    onClick={() => setExpandedJobId(isExpanded ? null : job.id!)}
                    className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
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
                <div className="p-5 pt-0 border-t border-border/40 space-y-4">
                  {/* Match Reason / Fit Explanation */}
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
                          100-Point Relevance Breakdown
                        </span>
                        <span className="font-bold text-foreground">
                          {job.matchScore ?? (job.scoreBreakdown.role + job.scoreBreakdown.skills + job.scoreBreakdown.workMode + job.scoreBreakdown.freshness + job.scoreBreakdown.verification)} / 100 pts
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                        <div className="bg-background/80 p-1.5 rounded border border-border/40">
                          <span className="text-muted-foreground block text-[10px]">Role</span>
                          <span className="font-semibold text-foreground">{job.scoreBreakdown.role} / 35</span>
                        </div>
                        <div className="bg-background/80 p-1.5 rounded border border-border/40">
                          <span className="text-muted-foreground block text-[10px]">Skills</span>
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
                          <span className="text-muted-foreground block text-[10px]">Verified</span>
                          <span className="font-semibold text-foreground">{job.scoreBreakdown.verification} / 10</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Meta Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="outline" className="font-mono text-xs gap-1 bg-background">
                      <Building className="h-3 w-3" />
                      {job.companyName}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs gap-1 bg-background">
                      <MapPin className="h-3 w-3" />
                      {job.location}
                    </Badge>
                    {job.salary && (
                      <Badge className="font-mono text-xs gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        <DollarSign className="h-3 w-3" />
                        {job.salary}
                      </Badge>
                    )}
                    {job.opportunityType && (
                      <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                        {job.opportunityType}
                      </Badge>
                    )}
                    {job.experienceLevel && (
                      <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                        {job.experienceLevel}
                      </Badge>
                    )}
                  </div>

                  {/* Skills tags */}
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

                  {/* Description / Summary */}
                  {job.description && (
                    <div className="space-y-1.5 text-xs text-muted-foreground leading-relaxed bg-background/50 p-3 rounded-lg border border-border/40">
                      <p>{job.description}</p>
                    </div>
                  )}

                  {/* Requirements */}
                  {Array.isArray(job.requirements) && job.requirements.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
                        Key Responsibilities & Qualifications
                      </h5>
                      <ul className="space-y-1.5 text-xs text-muted-foreground pl-1">
                        {job.requirements.map((req, rIdx) => (
                          <li key={rIdx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Multiple Discovery Sources */}
                  {job.sourceListings && job.sourceListings.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border/40">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        Discovered Sources ({job.sourceListings.length})
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

                  {/* Screenshot Viewport if available */}
                  {job.screenshotUrl && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-primary" />
                          Verified Page Snapshot
                        </h5>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLightboxImageUrl(job.screenshotUrl!)}
                          className="h-6 text-[11px] font-mono gap-1 text-muted-foreground"
                        >
                          <Maximize2 className="h-3 w-3" />
                          Zoom Fullscreen
                        </Button>
                      </div>

                      <div 
                        onClick={() => setLightboxImageUrl(job.screenshotUrl!)}
                        className="relative aspect-video max-w-lg rounded-lg border border-border overflow-hidden bg-zinc-950 cursor-zoom-in group"
                      >
                        <img
                          src={job.screenshotUrl}
                          alt={`${job.title} at ${job.companyName}`}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                      </div>
                    </div>
                  )}

                  {/* Action Link & Bookmark Row */}
                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-border/40">
                    <span className="text-[11px] font-mono text-muted-foreground truncate max-w-md">
                      {job.primaryApplyUrl || job.applyUrl}
                    </span>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSaving}
                        onClick={() => handleToggleSave(job.id!, isSaved)}
                        className="h-8 text-xs font-mono gap-1.5"
                      >
                        {isSaved ? <BookmarkCheck className="h-3.5 w-3.5 text-primary" /> : <Bookmark className="h-3.5 w-3.5" />}
                        {isSaved ? "Saved" : "Save"}
                      </Button>

                      <Link href={`/app/opportunities/${job.id}`}>
                        <Button variant="outline" size="sm" className="h-8 text-xs font-mono gap-1.5">
                          View Full Dossier
                        </Button>
                      </Link>

                      {job.primaryApplyUrl && (
                        <a
                          href={job.primaryApplyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" className="h-8 text-xs font-mono gap-1.5 shadow-xs">
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
        })}
      </div>

      {/* Lightbox Modal */}
      {lightboxImageUrl && (
        <div 
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[90vh]">
            <img
              src={lightboxImageUrl}
              alt="Full Resolution Viewport Snapshot"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain border border-zinc-800"
            />
            <p className="text-center text-zinc-400 font-mono text-xs mt-3">
              Click anywhere to close full preview
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
