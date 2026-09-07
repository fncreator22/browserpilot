"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Sparkles, 
  ArrowRight, 
  SlidersHorizontal, 
  Globe, 
  Shield, 
  Layers, 
  CheckCircle2, 
  Search,
  Bot,
  Briefcase,
  Radio,
  Clock,
  Building,
  MapPin,
  Target,
  ChevronDown,
  ChevronUp,
  X,
  Square,
  AlertTriangle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { parseAllowedDomains } from "@/schemas/jobs";
import { PromptEnhancer } from "@/components/prompt/prompt-enhancer";
import { isOpportunityDiscoveryIntent, parseSearchIntent } from "@/lib/scraper/intentParser";
import { toast } from "sonner";

export interface OpportunitySearchResultPayload {
  searchId: string;
  status: "COMPLETE" | "PARTIAL" | "NO_RESULTS" | "UNAUTHORIZED" | "FAILED" | string;
  query: string;
  intent?: any;
  canonicalIntent?: any;
  requestedCount?: number;
  verifiedCount?: number;
  results: any[];
  partial?: boolean;
  explanation?: string;
  diagnostics?: {
    requestedCount?: number;
    validResultCount?: number;
    rejectedResultCount?: number;
    stoppingReason?: string;
    totalRounds?: number;
    rejectionReasons?: string[];
    duplicateCount?: number;
  };
  correctionState?: any;
  sourceSummary?: {
    toolsExecuted?: string[];
    memoriesRetrieved?: number;
    durationMs?: number;
  };
  personalization?: {
    applied: boolean;
    memoriesUsed?: Array<{ category: string; key: string; value: string }>;
    summary?: string;
    overrideNotice?: string;
  };
  metadata: {
    totalUniqueOpportunities?: number;
    returnedCount?: number;
    durationMs?: number;
    providersAttempted?: number;
    providersSucceeded?: number;
    telemetry?: any;
    explanation?: string;
  };
  errorCode?: string;
  error?: string;
}

interface TaskInputProps {
  initialPrompt?: string;
  isCompact?: boolean;
  hasSearchHistory?: boolean;
  onOpportunitySearchResult?: (result: OpportunitySearchResultPayload | null) => void;
  onSearchingChange?: (isSearching: boolean) => void;
  onExecutionQueued?: (executionId: string, query: string) => void;
}

const PRESET_TEMPLATES = [
  {
    label: "Remote AI Internships (2026 Batch)",
    icon: Briefcase,
    goal: "Find remote AI and Machine Learning internships for 2026 graduates in India and US at high-growth startups.",
    domains: "linkedin.com, workatastartup.com, indeed.com",
    steps: 10,
  },
  {
    label: "YC Startup Full Stack Roles",
    icon: Layers,
    goal: "Discover entry-level full stack and frontend engineering opportunities at Y Combinator companies with React and TypeScript.",
    domains: "workatastartup.com, linkedin.com",
    steps: 10,
  },
  {
    label: "Hacker News AI Extraction",
    icon: Search,
    goal: "Navigate to news.ycombinator.com, find the top 5 articles discussing Artificial Intelligence or LLMs, extract their titles, authors, point scores, and outbound link URLs into a structured table.",
    domains: "news.ycombinator.com",
    steps: 8,
  },
  {
    label: "SaaS Pricing Comparison",
    icon: Layers,
    goal: "Inspect pricing pages for popular developer tools, compare monthly vs annual discounts, and extract feature matrices for the Pro and Team tiers.",
    domains: "github.com, vercel.com",
    steps: 12,
  },
];

export function TaskInput({
  initialPrompt = "",
  isCompact = false,
  hasSearchHistory = false,
  onOpportunitySearchResult,
  onSearchingChange,
  onExecutionQueued,
}: TaskInputProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);

  useEffect(() => {
    if (initialPrompt !== undefined) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);
  const [allowedDomains, setAllowedDomains] = useState("");
  const [maxSteps, setMaxSteps] = useState(15);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Real-time deterministic intent detection and parsing (Defaults to career search when empty)
  const isJobDiscovery = useMemo(() => {
    if (!prompt.trim()) return true;
    return isOpportunityDiscoveryIntent(prompt);
  }, [prompt]);
  const parsedIntent = useMemo(() => {
    if (!isJobDiscovery || !prompt.trim()) return null;
    try {
      return parseSearchIntent(prompt);
    } catch {
      return null;
    }
  }, [isJobDiscovery, prompt]);

  // Refinement overrides state (progressive disclosure)
  const [showRefine, setShowRefine] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [customFreshness, setCustomFreshness] = useState<number | null>(null);
  const [customWorkMode, setCustomWorkMode] = useState<string | null>(null);
  const [customOppType, setCustomOppType] = useState<string | null>(null);
  const [customMinScore, setCustomMinScore] = useState<number | null>(null);

  const effectiveFreshnessHours = customFreshness !== null ? customFreshness : parsedIntent?.freshnessWindowHours;
  const effectiveWorkMode = customWorkMode || parsedIntent?.workMode || "ANY";
  const effectiveOppType = customOppType || parsedIntent?.opportunityType || "ANY";
  const effectiveMinScore = customMinScore !== null ? customMinScore : (parsedIntent?.minimumMatchScore || 70);

  // Execution concurrency & cancellation controls (TASK-067)
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentExecutionIdRef = useRef<string | null>(null);

  const handleCancelSearch = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const execId = currentExecutionIdRef.current;
    if (execId) {
      try {
        await fetch("/api/search/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ executionId: execId }),
        });
      } catch {}
    }
    setIsSubmitting(false);
    if (onSearchingChange) onSearchingChange(false);
    toast.info("Search Cancelled", { description: "Search execution was cancelled by user request." });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;

    // Idempotency: Prevent concurrent submit loops from rapid clicks with active user feedback
    if (isSubmitting) {
      toast.info("Search in progress", {
        description: "Your discovery query is actively querying ATS connectors.",
      });
      return;
    }

    setIsSubmitting(true);
    if (onSearchingChange) onSearchingChange(true);
    setSubmitError(null);

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;
    const timeoutId = setTimeout(() => {
      abortCtrl.abort(new Error("Search timed out: Upstream ATS connectors took too long to respond. Try narrowing your query or retrying."));
    }, 25000);

    // -------------------------------------------------------------------------
    // 1. ROUTING: Deterministic Opportunity Discovery vs General Browser Agent
    // -------------------------------------------------------------------------
    if (isOpportunityDiscoveryIntent(text)) {
      try {
        const filters: Record<string, any> = {};
        if (customFreshness !== null) {
          if (customFreshness > 0) {
            filters.freshnessWindowHours = customFreshness;
            filters.isExplicitFreshness = true;
          } else {
            filters.freshnessWindowHours = undefined;
            filters.isExplicitFreshness = false;
          }
        }
        if (customWorkMode && customWorkMode !== "ANY") {
          filters.workMode = customWorkMode;
        }
        if (customOppType && customOppType !== "ANY") {
          filters.opportunityType = customOppType;
        }
        if (customMinScore !== null) {
          filters.minimumMatchScore = customMinScore;
        }

        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            query: text,
            filters: Object.keys(filters).length > 0 ? filters : undefined
          }),
          signal: abortCtrl.signal,
        });

        const execIdHeader = res.headers.get("x-execution-id");
        if (execIdHeader) {
          currentExecutionIdRef.current = execIdHeader;
        }

        const data = await res.json();

        // Late response guard: ignore if cancelled
        if (abortCtrl.signal.aborted) {
          return;
        }

        if (!res.ok) {
          if (res.status === 401) {
            if (onOpportunitySearchResult) {
              onOpportunitySearchResult({
                searchId: "",
                status: "UNAUTHORIZED",
                query: text,
                errorCode: "UNAUTHORIZED",
                explanation: data.message || "Authentication required. Please sign in to search.",
                results: [],
                metadata: { totalUniqueOpportunities: 0, returnedCount: 0, durationMs: 0, providersAttempted: 0, providersSucceeded: 0, explanation: "" },
              });
            }
            throw new Error(data.message || "Authentication required to search opportunities. Please sign in.");
          }
          if (res.status === 499) {
            // User cancelled
            return;
          }
          throw new Error(data.message || "Failed to execute opportunity discovery search.");
        }

        if (data.status === "QUEUED" && data.executionId) {
          currentExecutionIdRef.current = data.executionId;
          setIsSubmitting(false);
          if (onExecutionQueued) {
            onExecutionQueued(data.executionId, text);
          }
          return;
        }

        if (onOpportunitySearchResult) {
          onOpportunitySearchResult(data);
        }

        const foundCount = data.metadata?.totalUniqueOpportunities ?? data.results?.length ?? 0;
        const sourceCount = data.metadata?.providersAttempted || 10;

        if (foundCount === 0) {
          toast.info("Search Complete", {
            description: `Search complete - no matches found across your ${sourceCount} sources.`,
          });
        } else {
          toast.success("Opportunities Discovered!", {
            description: `Found ${foundCount} unique opportunities across ${sourceCount} sources.`,
          });
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const isTimeout = abortCtrl.signal.aborted && ((err as Error).name === "AbortError" || (err as Error).message?.includes("timed out"));
        if (isTimeout) {
          const timeoutMsg = "Search timed out: Upstream ATS connectors took too long to respond. Try narrowing your query or retrying.";
          setSubmitError(timeoutMsg);
          toast.error("Opportunity Search Error", { description: timeoutMsg });
          if (onOpportunitySearchResult) {
            onOpportunitySearchResult(null);
          }
          return;
        }
        if (abortCtrl.signal.aborted) {
          // Ignored clean user cancellation
          return;
        }
        const msg = (err as Error).message || "An unexpected error occurred during opportunity search.";
        setSubmitError(msg);
        toast.error("Opportunity Search Error", { description: msg });
        if (onOpportunitySearchResult) {
          onOpportunitySearchResult(null);
        }
      } finally {
        clearTimeout(timeoutId);
        setIsSubmitting(false);
        if (onSearchingChange) onSearchingChange(false);
      }
      return;
    }

    // -------------------------------------------------------------------------
    // 2. ROUTING: General Playwright Browser Agent Flow
    // -------------------------------------------------------------------------
    try {
      const domainsList = parseAllowedDomains(allowedDomains);

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          allowedDomains: domainsList.length > 0 ? domainsList : undefined,
          maxStepsBudget: maxSteps,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to dispatch job to queue");
      }

      if (data.jobId) {
        try {
          sessionStorage.setItem(
            `browserpilot_dispatched_${data.jobId}`,
            JSON.stringify({
              id: data.jobId,
              prompt: text,
              allowedDomains: domainsList,
              maxStepsBudget: maxSteps,
              status: "QUEUED",
              progress: 0,
              createdAt: new Date().toISOString(),
            })
          );
        } catch {
          // Ignore storage quota errors
        }
        router.push(`/app/jobs/${data.jobId}`);
      }
    } catch (err: unknown) {
      setSubmitError((err as Error).message || "An unexpected error occurred while dispatching the task.");
      setIsSubmitting(false);
      if (onSearchingChange) onSearchingChange(false);
    }
  };

  const executeWithCustomPrompt = async (customPrompt: string) => {
    const text = customPrompt.trim();
    if (!text) return;
    setPrompt(text);
    // Submit with updated prompt
    setTimeout(() => {
      const form = document.getElementById("task-input-form") as HTMLFormElement;
      if (form) form.requestSubmit();
    }, 50);
  };

  const handleSelectPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setPrompt(preset.goal);
    setAllowedDomains(preset.domains);
    setMaxSteps(preset.steps);
  };

  return (
    <div className="w-full space-y-4">
      {/* 1. Purpose-Built Mobile Search Layout (Collapsed by default so opportunities are above the fold) */}
      <div className="block md:hidden">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border/80 bg-white p-3.5 shadow-sm space-y-3"
        >
          {/* Error Alert: Search error or timeout on mobile */}
          {submitError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs font-sans text-destructive flex items-center justify-between gap-2 animate-in fade-in-50">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                <span className="text-[11px] leading-tight">{submitError}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSubmitError(null)}
                className="h-5 w-5 p-0 text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Top Row: Search Input + Submit Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 stroke-[1.75] text-muted-foreground" />
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Search roles, companies, or skills..."
                className="pl-9 pr-3 h-10 rounded-xl bg-[#F6F6F4]/80 border-border/70 text-xs font-sans placeholder:text-muted-foreground/70"
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting || !prompt.trim()}
              className="h-10 px-3.5 rounded-xl bg-[#1F3D2E] hover:bg-[#162D22] text-white font-sans text-xs font-semibold shrink-0 cursor-pointer shadow-xs disabled:opacity-75 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <span>Scan</span>
              )}
            </Button>
          </div>

          {/* Quick Filter Pill Row */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setCustomWorkMode(customWorkMode === "REMOTE" ? null : "REMOTE")}
                className={`px-2.5 py-1 rounded-full text-[11px] font-sans transition-all shrink-0 cursor-pointer border ${
                  customWorkMode === "REMOTE"
                    ? "bg-[#1F3D2E] text-white border-[#1F3D2E]"
                    : "bg-slate-100 text-muted-foreground border-slate-200/80 hover:bg-slate-200"
                }`}
              >
                Remote
              </button>
              <button
                type="button"
                onClick={() => setCustomWorkMode(customWorkMode === "HYBRID" ? null : "HYBRID")}
                className={`px-2.5 py-1 rounded-full text-[11px] font-sans transition-all shrink-0 cursor-pointer border ${
                  customWorkMode === "HYBRID"
                    ? "bg-[#1F3D2E] text-white border-[#1F3D2E]"
                    : "bg-slate-100 text-muted-foreground border-slate-200/80 hover:bg-slate-200"
                }`}
              >
                Hybrid
              </button>
              <button
                type="button"
                onClick={() => setCustomOppType(customOppType === "INTERNSHIP" ? null : "INTERNSHIP")}
                className={`px-2.5 py-1 rounded-full text-[11px] font-sans transition-all shrink-0 cursor-pointer border ${
                  customOppType === "INTERNSHIP"
                    ? "bg-[#1F3D2E] text-white border-[#1F3D2E]"
                    : "bg-slate-100 text-muted-foreground border-slate-200/80 hover:bg-slate-200"
                }`}
              >
                Internships
              </button>
            </div>

            {/* Expand Full Filters Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
              className="flex items-center gap-1 text-[11px] font-sans font-medium text-[#1F3D2E] shrink-0 px-2 py-1 rounded-md hover:bg-[#1F3D2E]/10 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-3 w-3 stroke-[1.75]" />
              <span>{isMobileFiltersOpen ? "Hide" : "Filters"}</span>
              {isMobileFiltersOpen ? <ChevronUp className="h-3 w-3 stroke-[1.75]" /> : <ChevronDown className="h-3 w-3 stroke-[1.75]" />}
            </button>
          </div>

          {/* Expandable Mobile Filters (Collapsed by default) */}
          {isMobileFiltersOpen && (
            <div className="pt-2.5 border-t border-border/60 space-y-3 animate-in fade-in-50 duration-200">
              <div className="grid grid-cols-2 gap-2 text-xs font-sans">
                <div>
                  <label className="text-[10px] text-muted-foreground font-medium block mb-1">Freshness window</label>
                  <select
                    value={customFreshness || 168}
                    onChange={(e) => setCustomFreshness(parseInt(e.target.value, 10))}
                    className="w-full h-8 text-xs rounded-lg border border-border/70 bg-white px-2 font-sans"
                  >
                    <option value={24}>Last 24h</option>
                    <option value={48}>Last 48h</option>
                    <option value={72}>Last 3 days</option>
                    <option value={168}>This week (7d)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground font-medium block mb-1">Min match fit</label>
                  <select
                    value={customMinScore || 75}
                    onChange={(e) => setCustomMinScore(parseInt(e.target.value, 10))}
                    className="w-full h-8 text-xs rounded-lg border border-border/70 bg-white px-2 font-sans"
                  >
                    <option value={60}>60% minimum</option>
                    <option value={70}>70% minimum</option>
                    <option value={75}>75% standard</option>
                    <option value={85}>85% high match</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("open-profile-modal", { detail: { tab: "PROVIDERS" } })
                      );
                    }
                  }}
                  className="text-[11px] font-sans text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="h-3 w-3 stroke-[1.75] text-amber-500" />
                  <span>AI provider & keys</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* 2. Desktop Discovery Input Form (Elevated & Sentence Case) */}
      <div className="hidden md:block">
        <form
          id="task-input-form"
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border/80 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1F3D2E]/10 text-[#1F3D2E]">
                <Bot className="h-3.5 w-3.5 stroke-[1.75]" />
              </span>
              <label htmlFor="task-goal" className="text-sm font-serif font-bold text-foreground">
                Discovery and automation goal
              </label>
            </div>

            <div className="flex items-center gap-2">
              <div 
                className="group relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/70 text-[11px] font-sans transition-colors cursor-help bg-white shadow-2xs"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isJobDiscovery ? "bg-[#1F3D2E]" : "bg-amber-600 animate-pulse"}`} />
                <span className={isJobDiscovery ? "text-[#1F3D2E] font-medium" : "text-amber-800 font-medium"}>
                  {isJobDiscovery ? "Career Search (10 ATS Connectors)" : "General Browser Agent (Playwright)"}
                </span>
                <Info className="h-3 w-3 text-muted-foreground/70 group-hover:text-foreground" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 w-64 p-2 text-[11px] font-sans rounded-lg bg-slate-900 text-white shadow-lg pointer-events-none text-left">
                  {isJobDiscovery 
                    ? "Career Search queries 10 direct ATS connectors (Greenhouse, Lever, Ashby, etc.) with sub-second verified matching."
                    : "General Browser Agent executes an autonomous headless Playwright browser sandbox for arbitrary web tasks."}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("open-profile-modal", { detail: { tab: "PROVIDERS" } })
                    );
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border/70 bg-white hover:bg-muted/80 text-[11px] font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-2xs"
                title="Configure AI Engine, Puter, or BYOK Gemini Key"
              >
                <Sparkles className="h-3 w-3 stroke-[1.75] text-amber-500" />
                <span>AI Provider & Keys</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("open-profile-modal", { detail: { tab: "CONNECTORS" } })
                    );
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border/70 bg-white hover:bg-muted/80 text-[11px] font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-2xs"
                title="Configure Global Monitored Sources & Connectors"
              >
                <Radio className="h-3 w-3 stroke-[1.75] text-[#1F3D2E]" />
                <span>Sources & Connectors</span>
              </button>
            </div>
          </div>

          <div className="relative space-y-2">
            <Textarea
              id="task-goal"
              aria-label="Describe your web automation or job discovery query"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your request in natural language (e.g. 'I’m looking for software engineering internships in San Francisco with React and Python. Prioritize recent postings.')"
              rows={isCompact ? 3 : 4}
              className="w-full resize-none rounded-xl border-border bg-[#FBFBFA] p-3.5 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-[#1F3D2E] shadow-2xs font-sans"
            />

            <PromptEnhancer
              currentPrompt={prompt}
              onApplyPrompt={(newP) => setPrompt(newP)}
              onExecutePrompt={(newP) => executeWithCustomPrompt(newP)}
            />
          </div>

          {submitError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 font-sans">
              Error: {submitError}
            </div>
          )}

        {/* Interpreted Search Intent Transparency & Refinement Controls */}
        {isJobDiscovery && parsedIntent && (
          <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-sans font-semibold text-foreground">
                  Interpreted search criteria
                </span>
                {(customFreshness !== null || customWorkMode || customOppType || customMinScore !== null) && (
                  <Badge variant="outline" className="text-[10px] font-sans text-amber-600 border-amber-500/30 bg-amber-500/10">
                    Modified by User
                  </Badge>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowRefine(!showRefine)}
                className="inline-flex items-center gap-1 text-xs font-sans text-primary hover:underline cursor-pointer"
              >
                <SlidersHorizontal className="h-3 w-3" />
                {showRefine ? "Hide Criteria Refinements" : "Refine Search Criteria"}
                {showRefine ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {/* Readout of interpreted dimensions in font-sans */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
              <div className="bg-card p-2 rounded-md border border-border/60">
                <span className="text-[10px] text-muted-foreground font-sans block">Role {parsedIntent.requestedCount ? `(Target: ${parsedIntent.requestedCount})` : ""}</span>
                <span className="text-foreground font-medium truncate block">
                  {parsedIntent.role || "Any role"}
                </span>
              </div>

              <div className="bg-card p-2 rounded-md border border-border/60">
                <span className="text-[10px] text-muted-foreground font-sans block">Company</span>
                <span className="text-foreground font-medium truncate block">
                  {parsedIntent.companies && parsedIntent.companies.length > 0
                    ? parsedIntent.companies.join(", ")
                    : "All matching"}
                </span>
              </div>

              <div className="bg-card p-2 rounded-md border border-border/60">
                <span className="text-[10px] text-muted-foreground font-sans block">Location</span>
                <span className="text-foreground font-medium truncate block">
                  {parsedIntent.location || "Any"}
                </span>
              </div>

              <div className="bg-card p-2 rounded-md border border-border/60">
                <span className="text-[10px] text-muted-foreground font-sans block">Date window</span>
                <span className={`font-medium truncate block ${effectiveFreshnessHours ? "text-emerald-600 font-semibold" : "text-muted-foreground"}`}>
                  {effectiveFreshnessHours
                    ? (effectiveFreshnessHours >= 24 && effectiveFreshnessHours % 24 === 0
                        ? `Last ${effectiveFreshnessHours / 24}d (${effectiveFreshnessHours}h)`
                        : `Last ${effectiveFreshnessHours}h`)
                    : "Any time"}
                </span>
              </div>
            </div>

            {/* Progressive Disclosure Refinement Controls in font-sans */}
            {showRefine && (
              <div className="pt-2 border-t border-border/40 space-y-3 font-sans text-xs">
                {/* Freshness Selector */}
                <div className="space-y-1.5">
                  <span className="text-xs text-foreground font-sans font-medium block">
                    Freshness boundary gating (hard constraint):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Today (24h)", value: 24 },
                      { label: "Last 48h", value: 48 },
                      { label: "Last 72h (3d)", value: 72 },
                      { label: "Last 7 days", value: 168 },
                      { label: "Any time (No limit)", value: 0 },
                    ].map((f) => {
                      const isSelected = effectiveFreshnessHours === f.value || (f.value === 0 && !effectiveFreshnessHours);
                      return (
                        <button
                          type="button"
                          key={f.label}
                          onClick={() => setCustomFreshness(f.value)}
                          className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary font-semibold"
                              : "bg-background text-muted-foreground border-border hover:text-foreground"
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Work Mode & Min Match Score Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <span className="text-xs text-foreground font-sans font-medium block">
                      Work mode preference:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "ANY", label: "Any" },
                        { id: "REMOTE", label: "Remote" },
                        { id: "HYBRID", label: "Hybrid" },
                        { id: "ON_SITE", label: "On-site" },
                      ].map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => setCustomWorkMode(m.id)}
                          className={`px-2.5 py-1 rounded text-xs font-sans transition-colors cursor-pointer border ${
                            effectiveWorkMode === m.id
                              ? "bg-primary text-primary-foreground border-primary font-semibold"
                              : "bg-background text-muted-foreground border-border hover:text-foreground"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs text-foreground font-sans font-medium block">
                      Minimum match score gate:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[60, 70, 75, 80, 90].map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => setCustomMinScore(s)}
                          className={`px-2.5 py-1 rounded text-xs font-sans transition-colors cursor-pointer border ${
                            effectiveMinScore === s
                              ? "bg-primary text-primary-foreground border-primary font-semibold"
                              : "bg-background text-muted-foreground border-border hover:text-foreground"
                          }`}
                        >
                          {s} pts
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Reset Button */}
                {(customFreshness !== null || customWorkMode || customOppType || customMinScore !== null) && (
                  <div className="pt-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCustomFreshness(null);
                        setCustomWorkMode(null);
                        setCustomOppType(null);
                        setCustomMinScore(null);
                      }}
                      className="h-6 text-[11px] font-sans text-muted-foreground hover:text-foreground gap-1"
                    >
                      <X className="h-3 w-3" />
                      Reset to parsed intent
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Preset Chips (Shown ONLY when input is empty AND user has no prior search history) */}
        {!prompt.trim() && !hasSearchHistory && (
          <div className="space-y-2">
            <span className="text-xs font-sans text-muted-foreground font-medium block">
              Sample discovery queries:
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESET_TEMPLATES.map((preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    type="button"
                    key={preset.label}
                    onClick={() => handleSelectPreset(preset)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/50 px-2.5 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary hover:border-primary/40 transition-colors cursor-pointer"
                  >
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Advanced Options Toggle (Only for general browser agent tasks) */}
        {!isJobDiscovery && (
          <div className="pt-2">
            <button
              type="button"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-1.5 text-xs font-sans text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {showAdvanced ? "Hide Execution Constraints" : "Configure Constraints & Domain Lock"}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4 font-sans text-xs">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Globe className="h-3.5 w-3.5 text-primary" />
                    Allowed Domain Whitelist (Comma-separated)
                  </label>
                  <Input
                    id="allowed-domains"
                    type="text"
                    placeholder="e.g. news.ycombinator.com, github.com"
                    value={allowedDomains}
                    onChange={(e) => setAllowedDomains(e.target.value)}
                    className="h-8 rounded-lg border-border/60 bg-background font-sans text-xs text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Leave empty to permit all secure public domains.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    Maximum Browser Navigation Steps: {maxSteps}
                  </label>
                  <input
                    id="max-steps-slider"
                    type="range"
                    min="3"
                    max="30"
                    value={maxSteps}
                    onChange={(e) => setMaxSteps(parseInt(e.target.value, 10))}
                    className="w-full cursor-pointer accent-[#1F3D2E]"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Alert: Search error or timeout on desktop */}
        {submitError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-sans text-destructive flex items-center justify-between gap-3 animate-in fade-in-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <span>{submitError}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSubmitError(null)}
              className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Submit Dispatch Button (Standardized to #1F3D2E dark forest green & font-sans) */}
        <div className="pt-2 flex items-center justify-end gap-2">
          {isSubmitting && isJobDiscovery && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelSearch}
              className="h-10 px-4 font-sans text-xs font-semibold gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Stop Search
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || !prompt.trim()}
            className="h-10 px-6 font-sans font-semibold text-xs gap-2 shadow-xs transition-all cursor-pointer bg-[#1F3D2E] hover:bg-[#162D22] text-white disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                {isJobDiscovery ? "Searching Multi-Source Swarm..." : "Dispatching Agent..."}
              </>
            ) : isJobDiscovery ? (
              <>
                <Search className="h-3.5 w-3.5 stroke-[1.75]" />
                Search Opportunities
              </>
            ) : (
              <>
                Launch Autonomous Agent
                <ArrowRight className="h-3.5 w-3.5 stroke-[1.75]" />
              </>
            )}
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}
