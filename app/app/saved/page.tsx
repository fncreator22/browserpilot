"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Bookmark, 
  Briefcase, 
  MapPin, 
  ExternalLink, 
  ArrowUpRight, 
  Trash2, 
  Compass, 
  Sparkles,
  Layers,
  Search,
  CheckCircle2,
  Building,
  DollarSign,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUIState } from "@/components/providers/ui-state-provider";
import { getAtsSourceInfo, getVerificationCornerBadge } from "@/components/result/job-dossier-deck";

interface SavedOpportunityRecord {
  savedId: string;
  savedAt: string;
  notes?: string | null;
  opportunity: {
    id: string;
    canonicalHash: string;
    title: string;
    companyName: string;
    location?: string;
    workMode?: string;
    opportunityType?: string;
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string;
    description?: string;
    requirements?: string[];
    skills?: string[];
    primaryApplyUrl?: string;
    sourceListings?: Array<{
      sourcePlatform: string;
      sourceUrl: string;
      verificationStatus?: string;
    }>;
  };
}

export type PipelineStage = "SAVED" | "APPLIED" | "INTERVIEWING" | "OFFER";

export const STAGE_CONFIG: Record<PipelineStage, { label: string; activeClass: string; inactiveClass: string }> = {
  SAVED: {
    label: "Saved",
    activeClass: "bg-slate-200 text-slate-900 border-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600",
    inactiveClass: "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground",
  },
  APPLIED: {
    label: "Applied",
    activeClass: "bg-blue-100 text-blue-900 border-blue-400 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-700",
    inactiveClass: "bg-muted/40 text-muted-foreground border-border/60 hover:text-blue-600",
  },
  INTERVIEWING: {
    label: "Interviewing",
    activeClass: "bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700",
    inactiveClass: "bg-muted/40 text-muted-foreground border-border/60 hover:text-amber-600",
  },
  OFFER: {
    label: "Offer",
    activeClass: "bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700",
    inactiveClass: "bg-muted/40 text-muted-foreground border-border/60 hover:text-emerald-600",
  },
};

export function getRecordStage(notes?: string | null): PipelineStage {
  if (!notes) return "SAVED";
  try {
    const parsed = JSON.parse(notes);
    if (parsed && parsed.stage && ["SAVED", "APPLIED", "INTERVIEWING", "OFFER"].includes(parsed.stage)) {
      return parsed.stage;
    }
  } catch {
    if (["SAVED", "APPLIED", "INTERVIEWING", "OFFER"].includes(notes)) {
      return notes as PipelineStage;
    }
  }
  return "SAVED";
}

export default function SavedOpportunitiesPage() {
  const [savedRecords, setSavedRecords] = useState<SavedOpportunityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStageTab, setSelectedStageTab] = useState<string>("ALL");
  const { setSavedCount } = useUIState();

  const fetchSavedOpportunities = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/opportunities/saved");
      if (res.ok) {
        const data = await res.json();
        const records = data.savedOpportunities || data.saved || [];
        setSavedRecords(records);
        setSavedCount(records.length);
      }
    } catch {
      // Non-fatal
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedOpportunities();
  }, []);

  const handleUpdateStage = async (oppId: string, companyName: string, title: string, nextStage: PipelineStage) => {
    try {
      const res = await fetch(`/api/opportunities/${oppId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: JSON.stringify({ stage: nextStage }) }),
      });

      if (res.ok) {
        setSavedRecords(prev =>
          prev.map(r => {
            if (r.opportunity.id === oppId) {
              return {
                ...r,
                notes: JSON.stringify({ stage: nextStage }),
              };
            }
            return r;
          })
        );
        toast.success(`Pipeline Stage: ${STAGE_CONFIG[nextStage].label}`, {
          description: `Updated status for ${title} at ${companyName}`,
        });
      } else {
        throw new Error("Failed to update stage");
      }
    } catch (err: unknown) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  const handleRemoveBookmark = async (oppId: string, companyName: string, title: string) => {
    try {
      const res = await fetch(`/api/opportunities/${oppId}/save`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSavedRecords(prev => {
          const next = prev.filter(r => r.opportunity.id !== oppId);
          setSavedCount(next.length);
          return next;
        });
        toast.success("Bookmark Removed", {
          description: `Removed ${title} at ${companyName} from your saved list.`,
        });
      } else {
        throw new Error("Failed to remove bookmark");
      }
    } catch (err: unknown) {
      toast.error("Error", { description: (err as Error).message });
    }
  };

  const stageCounts = {
    ALL: savedRecords.length,
    SAVED: savedRecords.filter(r => getRecordStage(r.notes) === "SAVED").length,
    APPLIED: savedRecords.filter(r => getRecordStage(r.notes) === "APPLIED").length,
    INTERVIEWING: savedRecords.filter(r => getRecordStage(r.notes) === "INTERVIEWING").length,
    OFFER: savedRecords.filter(r => getRecordStage(r.notes) === "OFFER").length,
  };

  const filteredRecords = savedRecords.filter(r => {
    const stage = getRecordStage(r.notes);
    if (selectedStageTab !== "ALL" && stage !== selectedStageTab) {
      return false;
    }
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const title = r.opportunity.title?.toLowerCase() || "";
    const comp = r.opportunity.companyName?.toLowerCase() || "";
    const loc = r.opportunity.location?.toLowerCase() || "";
    const skills = (r.opportunity.skills || []).join(" ").toLowerCase();
    return title.includes(term) || comp.includes(term) || loc.includes(term) || skills.includes(term);
  });

  return (
    <div className="flex-1 flex flex-col antialiased selection:bg-emerald-500/20 selection:text-emerald-600">
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 pb-32 sm:px-6 space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-sans font-bold tracking-tight text-foreground">
              Saved Opportunities
            </h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {savedRecords.length} Saved
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/app">
              <Button size="sm" className="h-8 px-3.5 font-sans font-medium text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs">
                <Compass className="h-3.5 w-3.5" />
                <span>Find More Opportunities</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Pipeline Stage Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-border/40">
          {[
            { id: "ALL", label: "All Opportunities", count: stageCounts.ALL },
            { id: "SAVED", label: "Saved", count: stageCounts.SAVED },
            { id: "APPLIED", label: "Applied", count: stageCounts.APPLIED },
            { id: "INTERVIEWING", label: "Interviewing", count: stageCounts.INTERVIEWING },
            { id: "OFFER", label: "Offer", count: stageCounts.OFFER },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedStageTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer border ${
                selectedStageTab === tab.id
                  ? "bg-primary text-primary-foreground border-primary shadow-marble-1 font-semibold"
                  : "bg-card text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedStageTab === tab.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filter / Search Bar */}
        {savedRecords.length > 0 && (
          <div className="flex items-center justify-between gap-4 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter saved roles, companies, skills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-9 pr-3 text-xs font-mono rounded-lg border border-border/70 bg-card text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}

        {/* Opportunities List */}
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs font-mono text-muted-foreground">Loading saved opportunities...</p>
          </div>
        ) : filteredRecords.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRecords.map(({ savedId, savedAt, notes, opportunity: opp }) => {
              const ats = getAtsSourceInfo(opp.sourceListings?.[0]?.sourcePlatform, opp.primaryApplyUrl, opp.sourceListings);

              return (
                <div
                  key={savedId}
                  className="rounded-2xl border border-border bg-card p-5 space-y-3.5 hover:border-primary/40 transition-all flex flex-col justify-between shadow-marble-1 hover:shadow-marble-2"
                >
                  <div className="space-y-3">
                    {/* Top Row: ATS Chip + Verification Badge + Remove Action */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border ${ats.className}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${ats.dotColor}`} aria-hidden="true" />
                          {ats.name}
                        </span>
                        {getVerificationCornerBadge(opp.sourceListings?.[0]?.verificationStatus)}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveBookmark(opp.id, opp.companyName, opp.title)}
                        className="text-muted-foreground hover:text-rose-600 transition-colors p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer rounded-md focus-visible:ring-2 focus-visible:ring-primary"
                        title="Remove from saved"
                        aria-label="Remove bookmark"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Title & Company */}
                    <div className="space-y-1">
                      <Link href={`/app/opportunities/${opp.id}`} className="group">
                        <h3 className="font-sans text-base font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                          {opp.title}
                        </h3>
                      </Link>
                      <p className="text-xs font-semibold text-foreground/80 font-sans flex items-center gap-1.5">
                        <Building className="h-3 w-3 text-primary shrink-0" aria-hidden="true" />
                        {opp.companyName}
                      </p>
                    </div>

                    {/* Fixed Predictable Metadata Slots */}
                    <div className="space-y-1.5 py-2 border-y border-border/40 text-xs font-mono text-muted-foreground">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" aria-hidden="true" />
                        <span className="truncate">{opp.location || "Location unlisted"} {opp.workMode && `• ${opp.workMode}`}</span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <DollarSign className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                        <span className="font-semibold text-foreground truncate">
                          {opp.salaryMin && opp.salaryMax 
                            ? `${opp.salaryCurrency || "$"}${Math.round(opp.salaryMin / 1000)}k - ${Math.round(opp.salaryMax / 1000)}k` 
                            : "Competitive / Unlisted"}
                        </span>
                      </div>
                    </div>

                    {/* Skills Preview */}
                    {opp.skills && opp.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {opp.skills.slice(0, 3).map((s) => (
                          <span
                            key={s}
                            className="inline-block rounded px-1.5 py-0.5 text-[10px] font-mono bg-muted/50 text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Pipeline Stage Progression Selector */}
                    <div className="pt-2.5 mt-2 border-t border-border/40 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                        <span>Application Stage</span>
                        <span className="font-semibold text-foreground">{STAGE_CONFIG[getRecordStage(notes)].label}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {(["SAVED", "APPLIED", "INTERVIEWING", "OFFER"] as PipelineStage[]).map((stage) => {
                          const currentStage = getRecordStage(notes);
                          const isCurrent = currentStage === stage;
                          return (
                            <button
                              key={stage}
                              type="button"
                              onClick={() => handleUpdateStage(opp.id, opp.companyName, opp.title, stage)}
                              className={`py-1 text-[10px] font-mono font-medium rounded-md border transition-all text-center cursor-pointer ${
                                isCurrent
                                  ? STAGE_CONFIG[stage].activeClass + " shadow-2xs font-bold ring-1 ring-primary/30"
                                  : STAGE_CONFIG[stage].inactiveClass
                              }`}
                              title={`Move to ${STAGE_CONFIG[stage].label}`}
                            >
                              {STAGE_CONFIG[stage].label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions: Strict Hierarchy */}
                  <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" aria-hidden="true" />
                      Saved {new Date(savedAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      <Link href={`/app/opportunities/${opp.id}`}>
                        <Button variant="outline" size="sm" className="h-9 min-h-[44px] sm:min-h-[32px] px-2.5 font-mono text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:ring-primary">
                          Dossier
                        </Button>
                      </Link>

                      {opp.primaryApplyUrl && (
                        <a
                          href={opp.primaryApplyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex"
                        >
                          <Button size="sm" className="h-9 min-h-[44px] sm:min-h-[32px] px-3 font-mono text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer rounded-lg shadow-marble-1 focus-visible:ring-2 focus-visible:ring-primary">
                            <span>Apply</span>
                            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="py-20 text-center space-y-4 max-w-md mx-auto rounded-2xl border border-dashed border-border/70 p-8 bg-card/40">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bookmark className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-foreground">No Saved Opportunities Yet</h2>
              <p className="text-xs text-muted-foreground">
                Bookmark interesting roles during your discovery searches or from autonomous watch notifications to track them here.
              </p>
            </div>
            <Link href="/app">
              <Button size="sm" className="font-sans font-semibold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer rounded-lg shadow-marble-1">
                <Compass className="h-3.5 w-3.5" />
                Start Opportunity Discovery
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
