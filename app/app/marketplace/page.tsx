"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  Search, 
  MapPin, 
  Building2, 
  Clock, 
  ExternalLink, 
  Bookmark, 
  CheckCircle2, 
  Sparkles, 
  Filter, 
  RotateCw, 
  Briefcase,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  DollarSign,
  UserCheck,
  X,
  Mail,
  Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUIState } from "@/components/providers/ui-state-provider";
import { CompanyAvatar } from "@/components/ui/company-avatar";

interface OpportunityItem {
  id: string;
  canonicalHash: string;
  title: string;
  companyName: string;
  location: string;
  workMode: string;
  experienceLevel: string;
  opportunityType: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  description: string;
  requirements?: string[];
  skills: string[];
  primaryApplyUrl: string;
  firstSeenAt: string;
  lastVerifiedAt: string;
  rawSnippet?: string | null;
  companyContacts?: Array<{
    id: string;
    fullName: string;
    roleTitle: string;
    department?: string | null;
    profileUrl?: string | null;
    email?: string | null;
    personalEmail?: string | null;
    phone?: string | null;
    isVerified?: boolean;
    sourcePlatform?: string;
  }>;
  status: string;
  isSaved?: boolean;
  freshness: {
    elapsedHours: number;
    decayScore: number;
    label: string;
    isFresh: boolean;
  };
  sources: {
    platform: string;
    applyUrl: string;
    verified: boolean;
  }[];
}

const CATEGORIES = [
  { id: "ALL", label: "All Opportunities" },
  { id: "AI_ML", label: "AI & Machine Learning" },
  { id: "INFRASTRUCTURE", label: "Cloud & Backend" },
  { id: "FRONTEND", label: "Frontend & Full Stack" },
  { id: "MARKETING", label: "Marketing & Growth" },
  { id: "SALES", label: "Sales & RevOps" },
  { id: "OPERATIONS", label: "Operations & Strategy" },
  { id: "FINANCE", label: "Finance & Accounting" },
  { id: "HEALTHCARE", label: "Healthcare & Biotech" },
  { id: "CUSTOMER_SUCCESS", label: "Customer Success" },
  { id: "LEGAL", label: "Legal & Compliance" },
  { id: "DESIGN", label: "Product & UI/UX Design" },
  { id: "FINTECH", label: "FinTech & Payments" },
];

const WORK_MODES = [
  { id: "ANY", label: "All Modes" },
  { id: "REMOTE", label: "Remote" },
  { id: "HYBRID", label: "Hybrid" },
  { id: "ON_SITE", label: "On-site" },
];

const EXPERIENCE_LEVELS = [
  { id: "ANY", label: "All Levels" },
  { id: "INTERN", label: "Internship" },
  { id: "ENTRY_LEVEL", label: "Entry Level" },
  { id: "MID", label: "Mid Level" },
  { id: "SENIOR", label: "Senior+" },
];

const FRESHNESS_WINDOWS = [
  { id: "0", label: "Any Time" },
  { id: "1", label: "Past 24 Hours" },
  { id: "3", label: "Past 3 Days" },
  { id: "7", label: "Past Week" },
];

export default function JobMarketplacePage() {
  const { currency, savedCount, setSavedCount } = useUIState();
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedWorkMode, setSelectedWorkMode] = useState("ANY");
  const [selectedExperience, setSelectedExperience] = useState("ANY");
  const [selectedFreshness, setSelectedFreshness] = useState("0");
  const [sortBy, setSortBy] = useState("latest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<OpportunityItem | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [hideFilterBar, setHideFilterBar] = useState(false);

  // Auto-hiding filter bar on mobile downward scroll
  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (window.innerWidth < 768) {
        if (currentScrollY > lastScrollY && currentScrollY > 80) {
          setHideFilterBar(true);
        } else if (currentScrollY < lastScrollY) {
          setHideFilterBar(false);
        }
      } else {
        setHideFilterBar(false);
      }
      lastScrollY = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchMarketplace = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (selectedCategory !== "ALL") params.set("category", selectedCategory);
      if (selectedWorkMode !== "ANY") params.set("workMode", selectedWorkMode);
      if (selectedExperience !== "ANY") params.set("experienceLevel", selectedExperience);
      if (selectedFreshness !== "0") params.set("postedWithinDays", selectedFreshness);
      params.set("sort", sortBy);
      params.set("page", String(page));
      params.set("limit", "18");

      const res = await fetch(`/api/marketplace?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch marketplace jobs");
      const data = await res.json();
      if (data.success) {
        setOpportunities(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalCount(data.pagination?.total || 0);
      }
    } catch (err: any) {
      toast.error("Marketplace Notice", {
        description: err.message || "Failed to load live jobs.",
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, selectedCategory, selectedWorkMode, selectedExperience, selectedFreshness, sortBy, page]);

  useEffect(() => {
    fetchMarketplace();
  }, [fetchMarketplace]);

  const handleToggleSave = async (opp: OpportunityItem) => {
    setSavingId(opp.id);
    const wasSaved = opp.isSaved;

    try {
      const endpoint = wasSaved ? `/api/opportunities/saved?opportunityId=${opp.id}` : "/api/opportunities/saved";
      const method = wasSaved ? "DELETE" : "POST";
      const body = wasSaved ? undefined : JSON.stringify({ opportunityId: opp.id });

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (res.ok) {
        setOpportunities((prev) =>
          prev.map((item) => (item.id === opp.id ? { ...item, isSaved: !wasSaved } : item))
        );
        setSavedCount(wasSaved ? Math.max(0, savedCount - 1) : savedCount + 1);
        toast.success(wasSaved ? "Removed from Saved" : "Saved Opportunity", {
          description: wasSaved ? `${opp.title} unsaved.` : `${opp.title} at ${opp.companyName} bookmarked.`,
        });
      } else {
        toast.error("Action Failed", { description: "Could not update bookmark." });
      }
    } catch {
      toast.error("Network Error", { description: "Please verify connectivity." });
    } finally {
      setSavingId(null);
    }
  };

  const formatSalary = (min?: number | null, max?: number | null, origCurr = "USD") => {
    if (!min && !max) return null;
    const isINR = currency === "INR";
    const multiplier = isINR && origCurr === "USD" ? 85 : 1;
    const prefix = isINR ? "₹" : "$";

    const formatNum = (val: number) => {
      const scaled = val * multiplier;
      if (scaled >= 10000000) return `${(scaled / 10000000).toFixed(1)}Cr`;
      if (scaled >= 100000) return `${(scaled / 100000).toFixed(1)}L`;
      if (scaled >= 1000) return `${Math.round(scaled / 1000)}k`;
      return String(Math.round(scaled));
    };

    if (min && max) {
      return `${prefix}${formatNum(min)} - ${prefix}${formatNum(max)}`;
    }
    if (min) return `From ${prefix}${formatNum(min)}`;
    if (max) return `Up to ${prefix}${formatNum(max)}`;
    return null;
  };

  const activeFiltersCount = 
    (selectedWorkMode !== "ANY" ? 1 : 0) +
    (selectedExperience !== "ANY" ? 1 : 0) +
    (selectedFreshness !== "0" ? 1 : 0) +
    (selectedCategory !== "ALL" ? 1 : 0);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 font-sans">
      {/* Top Utility Header with auto-hide on mobile scroll */}
      <div 
        className={`border-b border-border bg-background/98 backdrop-blur-md sticky top-16 z-30 shadow-xs transition-transform duration-300 ease-in-out ${
          hideFilterBar ? "-translate-y-full sm:translate-y-0 opacity-0 sm:opacity-100 pointer-events-none sm:pointer-events-auto" : "translate-y-0 opacity-100"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 space-y-3">
          {/* Main Action Strip */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                  <Briefcase className="h-4 w-4 stroke-[2.2]" />
                </div>
                <div>
                  <h1 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                    Job Market
                    <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                      {totalCount} Verified Openings
                    </span>
                  </h1>
                </div>
              </div>

              {/* Mobile Filter Drawer Toggle Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="sm:hidden flex items-center gap-1.5 h-8 px-2.5 text-xs font-mono border-border bg-card hover:bg-muted"
                aria-label="Toggle filter options"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </div>

            {/* Inline Search Bar */}
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, tech stack, employer..."
                className="h-9 pl-9 pr-8 text-xs font-mono bg-background border-border/80 focus-visible:ring-primary/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Filter Section on Mobile, permanently visible on Desktop */}
          <div className={`space-y-3 transition-all duration-200 ${isFilterOpen ? "block" : "hidden sm:block"}`}>
            {/* Category Pills Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Faceted Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-[11px]">Mode:</span>
                  <select
                    value={selectedWorkMode}
                    onChange={(e) => {
                      setSelectedWorkMode(e.target.value);
                      setPage(1);
                    }}
                    className="h-7 px-2 text-xs rounded-md bg-background border border-border text-foreground cursor-pointer"
                  >
                    {WORK_MODES.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-[11px]">Level:</span>
                  <select
                    value={selectedExperience}
                    onChange={(e) => {
                      setSelectedExperience(e.target.value);
                      setPage(1);
                    }}
                    className="h-7 px-2 text-xs rounded-md bg-background border border-border text-foreground cursor-pointer"
                  >
                    {EXPERIENCE_LEVELS.map((exp) => (
                      <option key={exp.id} value={exp.id}>{exp.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-[11px]">Freshness:</span>
                  <select
                    value={selectedFreshness}
                    onChange={(e) => {
                      setSelectedFreshness(e.target.value);
                      setPage(1);
                    }}
                    className="h-7 px-2 text-xs rounded-md bg-background border border-border text-foreground cursor-pointer"
                  >
                    {FRESHNESS_WINDOWS.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-[11px]">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                  className="h-7 px-2 text-xs rounded-md bg-background border border-border text-foreground cursor-pointer"
                >
                  <option value="latest">Latest Verified</option>
                  <option value="salary">Highest Compensation</option>
                  <option value="oldest">First Discovered</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <RotateCw className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs font-mono text-muted-foreground">Indexing verified market opportunities...</p>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border rounded-2xl p-8 space-y-4 max-w-lg mx-auto bg-card/30">
            <Briefcase className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">No matching openings found</h3>
              <p className="text-xs text-muted-foreground font-mono">
                Try widening your filters, clearing the search query, or triggering an autonomous agent scan.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("ALL");
                  setSelectedWorkMode("ANY");
                  setSelectedExperience("ANY");
                  setSelectedFreshness("0");
                }}
                className="text-xs font-mono"
              >
                Reset Filters
              </Button>
              <Link href="/app">
                <Button size="sm" className="text-xs font-mono bg-primary hover:bg-primary/90">
                  Run Autonomous Discovery →
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Grid of Opportunities */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {opportunities.map((opp) => {
                const salaryStr = formatSalary(opp.salaryMin, opp.salaryMax, opp.salaryCurrency || "USD");

                return (
                  <div
                    key={opp.id}
                    className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/40 hover:shadow-marble-1 transition-all flex flex-col justify-between space-y-3"
                  >
                    {/* Header: Company Avatar, Name, Title, Save */}
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <CompanyAvatar companyName={opp.companyName} applyUrl={opp.primaryApplyUrl} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium truncate">
                              <span className="truncate font-semibold text-foreground">{opp.companyName}</span>
                              <span title="Verified ATS Source" className="inline-flex">
                                <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                              </span>
                            </div>
                            <h2 
                              className="text-sm font-bold text-foreground tracking-tight line-clamp-1 mt-0.5 cursor-pointer hover:text-primary transition-colors" 
                              title={opp.title}
                              onClick={() => setSelectedJob(opp)}
                            >
                              {opp.title}
                            </h2>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleSave(opp)}
                          disabled={savingId === opp.id}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                            opp.isSaved
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground"
                          }`}
                          title={opp.isSaved ? "Remove from saved" : "Bookmark opportunity"}
                        >
                          <Bookmark className={`h-3.5 w-3.5 ${opp.isSaved ? "fill-primary stroke-primary" : ""}`} />
                        </button>
                      </div>

                      {/* Description Snippet (TASK-001) */}
                      {opp.description && (
                        <p 
                          className="text-xs text-muted-foreground line-clamp-2 leading-relaxed pt-0.5 cursor-pointer hover:text-foreground/90 transition-colors"
                          title={opp.description}
                          onClick={() => setSelectedJob(opp)}
                        >
                          {opp.description}
                        </p>
                      )}

                      {/* Hiring Team Intelligence Pill */}
                      {opp.companyContacts && opp.companyContacts.length > 0 && (
                        <div 
                          className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 truncate cursor-pointer hover:bg-emerald-500/15 transition-colors"
                          onClick={() => setSelectedJob(opp)}
                          title={`Recruiter: ${opp.companyContacts[0].fullName}`}
                        >
                          <UserCheck className="h-3 w-3 shrink-0" />
                          <span className="truncate">Hiring Team: {opp.companyContacts[0].fullName} ({opp.companyContacts[0].roleTitle})</span>
                        </div>
                      )}

                      {/* Pills: Work Mode, Experience, Freshness */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/60">
                          {opp.workMode === "REMOTE" ? "Remote" : opp.workMode === "HYBRID" ? "Hybrid" : "On-site"}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/60">
                          {opp.experienceLevel === "INTERN"
                            ? "Intern"
                            : opp.experienceLevel === "ENTRY_LEVEL"
                            ? "Entry"
                            : opp.experienceLevel === "SENIOR"
                            ? "Senior"
                            : "Mid"}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                          opp.freshness.isFresh
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold"
                            : "bg-muted text-muted-foreground border-border/60"
                        }`}>
                          <Clock className="h-2.5 w-2.5" />
                          {opp.freshness.label}
                        </span>
                      </div>
                    </div>

                    {/* Location & Salary */}
                    <div className="space-y-1.5 pt-1 border-t border-border/40 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1 truncate text-[11px]">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{opp.location || "Remote / Unspecified"}</span>
                        </span>
                        {salaryStr && (
                          <span className="font-mono font-semibold text-foreground shrink-0 text-[11px] bg-primary/5 px-1.5 py-0.5 rounded border border-primary/20">
                            {salaryStr}
                          </span>
                        )}
                      </div>

                      {/* Skills Tags */}
                      {opp.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {opp.skills.slice(0, 3).map((skill, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground border border-border/40"
                            >
                              {skill}
                            </span>
                          ))}
                          {opp.skills.length > 3 && (
                            <span className="text-[10px] font-mono text-muted-foreground/80 self-center">
                              +{opp.skills.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer: Direct Apply Link & Details Drawer Trigger */}
                    <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground truncate">
                        {opp.sources[0]?.platform || "Direct ATS"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedJob(opp)}
                          className="h-7 px-2.5 text-xs font-mono border-border/80 hover:bg-muted/50 cursor-pointer"
                        >
                          Details
                        </Button>
                        <a
                          href={opp.primaryApplyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold font-mono transition-colors shadow-xs shrink-0"
                        >
                          Apply
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Strip */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between py-4 border-t border-border text-xs font-mono">
                <span className="text-muted-foreground">
                  Page {page} of {totalPages} ({totalCount} total openings)
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 text-xs font-mono gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 text-xs font-mono gap-1"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Job Detail Slideover Modal */}
        {selectedJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div 
              className="fixed inset-0"
              onClick={() => setSelectedJob(null)}
            />
            <div className="relative w-full max-w-xl h-full bg-background border-l border-border shadow-2xl z-10 flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-250">
              {/* Slideover Header */}
              <div className="p-5 border-b border-border/80 flex items-start justify-between gap-4 bg-muted/20">
                <div className="flex items-start gap-3 min-w-0">
                  <CompanyAvatar companyName={selectedJob.companyName} applyUrl={selectedJob.primaryApplyUrl} size="lg" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <span>{selectedJob.companyName}</span>
                      <span title="Verified ATS Source" className="inline-flex">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-foreground tracking-tight mt-0.5">
                      {selectedJob.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {selectedJob.location || "Remote / Unspecified"}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {selectedJob.freshness.label}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedJob(null)}
                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Slideover Scrollable Body */}
              <div className="p-5 space-y-5 overflow-y-auto flex-1 font-sans text-xs">
                {/* Meta Pills */}
                <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                  <span className="px-2.5 py-1 rounded-md bg-muted text-foreground border border-border">
                    {selectedJob.workMode}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-muted text-foreground border border-border">
                    {selectedJob.experienceLevel}
                  </span>
                  {selectedJob.salaryMin && (
                    <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 font-bold">
                      {formatSalary(selectedJob.salaryMin, selectedJob.salaryMax, selectedJob.salaryCurrency || "USD")}
                    </span>
                  )}
                </div>

                {/* Key Hiring Team & Recruiter Intelligence */}
                <div className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Hiring Team & Recruiter Intelligence
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                      Verified
                    </Badge>
                  </div>

                  {selectedJob.companyContacts && selectedJob.companyContacts.length > 0 ? (
                    <div className="space-y-2.5 pt-1">
                      {selectedJob.companyContacts.map((contact, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-card border border-border/70 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground text-xs">{contact.fullName}</span>
                            {contact.profileUrl && (
                              <a
                                href={contact.profileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-primary hover:underline flex items-center gap-1 font-mono"
                              >
                                Profile <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {contact.roleTitle} {contact.department ? `· ${contact.department}` : ""}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono text-muted-foreground">
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} className="hover:text-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                {contact.email}
                              </a>
                            )}
                            {contact.phone && (
                              <a href={`tel:${contact.phone}`} className="hover:text-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {contact.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      DeepReach scanner actively cross-references recruiter profiles and talent acquisition leads for {selectedJob.companyName}.
                    </p>
                  )}
                </div>

                {/* Job Description */}
                <div className="space-y-2">
                  <h3 className="font-bold text-xs text-foreground font-sans uppercase tracking-wider text-[11px]">
                    Role Description
                  </h3>
                  <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line bg-muted/20 p-3.5 rounded-xl border border-border/50">
                    {selectedJob.description || "No full description provided. Please visit the direct ATS application link below."}
                  </div>
                </div>

                {/* Skills & Tech Stack */}
                {selectedJob.skills && selectedJob.skills.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-bold text-xs text-foreground font-sans uppercase tracking-wider text-[11px]">
                      Required Skills & Stack
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJob.skills.map((skill, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-muted text-foreground border border-border font-mono text-[11px]">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Slideover Footer Actions */}
              <div className="p-4 border-t border-border/80 bg-muted/20 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleSave(selectedJob)}
                  className="font-mono text-xs gap-1.5"
                >
                  <Bookmark className={`h-3.5 w-3.5 ${selectedJob.isSaved ? "fill-primary stroke-primary" : ""}`} />
                  {selectedJob.isSaved ? "Saved" : "Save Job"}
                </Button>

                <a
                  href={selectedJob.primaryApplyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold font-mono text-xs shadow-xs"
                >
                  Apply on {selectedJob.sources[0]?.platform || "Official ATS"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
