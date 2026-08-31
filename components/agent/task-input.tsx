"use client";

import { useState, useMemo } from "react";
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
  X
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
  status: string;
  query: string;
  intent: any;
  results: any[];
  metadata: any;
}

interface TaskInputProps {
  initialPrompt?: string;
  isCompact?: boolean;
  onOpportunitySearchResult?: (result: OpportunitySearchResultPayload | null) => void;
  onSearchingChange?: (isSearching: boolean) => void;
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
  onOpportunitySearchResult,
  onSearchingChange,
}: TaskInputProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [allowedDomains, setAllowedDomains] = useState("");
  const [maxSteps, setMaxSteps] = useState(15);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Real-time deterministic intent detection and parsing
  const isJobDiscovery = useMemo(() => isOpportunityDiscoveryIntent(prompt), [prompt]);
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
  const [customFreshness, setCustomFreshness] = useState<number | null>(null);
  const [customWorkMode, setCustomWorkMode] = useState<string | null>(null);
  const [customOppType, setCustomOppType] = useState<string | null>(null);
  const [customMinScore, setCustomMinScore] = useState<number | null>(null);

  const effectiveFreshnessHours = customFreshness !== null ? customFreshness : parsedIntent?.freshnessWindowHours;
  const effectiveWorkMode = customWorkMode || parsedIntent?.workMode || "ANY";
  const effectiveOppType = customOppType || parsedIntent?.opportunityType || "ANY";
  const effectiveMinScore = customMinScore !== null ? customMinScore : (parsedIntent?.minimumMatchScore || 70);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;

    setIsSubmitting(true);
    if (onSearchingChange) onSearchingChange(true);
    setSubmitError(null);

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
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to execute opportunity discovery search.");
        }

        if (onOpportunitySearchResult) {
          onOpportunitySearchResult(data);
        }

        toast.success("Opportunities Discovered!", {
          description: `Found ${data.metadata?.totalUniqueOpportunities || data.results?.length || 0} unique opportunities across ${data.metadata?.providersAttempted || 3} sources.`,
        });
      } catch (err: unknown) {
        const msg = (err as Error).message || "An unexpected error occurred during opportunity search.";
        setSubmitError(msg);
        toast.error("Opportunity Search Error", { description: msg });
        if (onOpportunitySearchResult) {
          onOpportunitySearchResult(null);
        }
      } finally {
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
    <div className="w-full rounded-2xl border border-border/80 bg-card/60 p-4 sm:p-6 shadow-xl backdrop-blur-xl transition-all">
      <form id="task-input-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary">
              {isJobDiscovery ? <Briefcase className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            </div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Agent Goal & Discovery Query
            </label>
          </div>

          <div className="flex items-center gap-2">
            {isJobDiscovery ? (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-mono text-[10px] sm:text-xs flex items-center gap-1.5 shadow-sm">
                <Sparkles className="h-3 w-3" /> Job Discovery Mode
              </Badge>
            ) : (
              <span className="text-[11px] font-mono text-muted-foreground">
                General Browser Agent Mode
              </span>
            )}
          </div>
        </div>

        <div className="relative space-y-2">
          <Textarea
            id="task-goal"
            aria-label="Describe your web automation or job discovery query"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your request in natural language (e.g. 'I’m looking for software engineering internships in Hyderabad with React and Python. Prioritize recent postings.')"
            rows={isCompact ? 3 : 4}
            className="w-full resize-none rounded-xl border-border/70 bg-background/80 p-4 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary shadow-inner font-sans"
          />

          <PromptEnhancer
            currentPrompt={prompt}
            onApplyPrompt={(newP) => setPrompt(newP)}
            onExecutePrompt={(newP) => executeWithCustomPrompt(newP)}
          />
        </div>

        {submitError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 font-mono">
            Error: {submitError}
          </div>
        )}

        {/* Interpreted Search Intent Transparency & Refinement Controls */}
        {isJobDiscovery && parsedIntent && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-xs font-mono font-semibold text-foreground">
                  Interpreted Search Intent
                </span>
                {(customFreshness !== null || customWorkMode || customOppType || customMinScore !== null) && (
                  <Badge variant="outline" className="text-[10px] font-mono text-amber-500 border-amber-500/30 bg-amber-500/10">
                    Modified by User
                  </Badge>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowRefine(!showRefine)}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline cursor-pointer"
              >
                <SlidersHorizontal className="h-3 w-3" />
                {showRefine ? "Hide Criteria Refinements" : "Refine Search Criteria"}
                {showRefine ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {/* Readout of interpreted dimensions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-background/80 p-2 rounded border border-border/50">
                <span className="text-[10px] text-muted-foreground block uppercase">Role</span>
                <span className="text-foreground font-medium truncate block">
                  {parsedIntent.role || "Any role"}
                </span>
              </div>

              <div className="bg-background/80 p-2 rounded border border-border/50">
                <span className="text-[10px] text-muted-foreground block uppercase">Company</span>
                <span className="text-foreground font-medium truncate block">
                  {parsedIntent.companies && parsedIntent.companies.length > 0
                    ? parsedIntent.companies.join(", ")
                    : "All matching"}
                </span>
              </div>

              <div className="bg-background/80 p-2 rounded border border-border/50">
                <span className="text-[10px] text-muted-foreground block uppercase">Location</span>
                <span className="text-foreground font-medium truncate block">
                  {parsedIntent.location || "Any"}
                </span>
              </div>

              <div className="bg-background/80 p-2 rounded border border-border/50">
                <span className="text-[10px] text-muted-foreground block uppercase">Freshness</span>
                <span className={`font-medium truncate block ${effectiveFreshnessHours ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {effectiveFreshnessHours ? `Last ${effectiveFreshnessHours}h` : "Any time"}
                </span>
              </div>
            </div>

            {/* Progressive Disclosure Refinement Controls */}
            {showRefine && (
              <div className="pt-2 border-t border-border/40 space-y-3 font-mono text-xs">
                {/* Freshness Selector */}
                <div className="space-y-1.5">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">
                    Freshness Boundary Gating (Hard Constraint):
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
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">
                      Work Mode:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {["ANY", "REMOTE", "HYBRID", "ON_SITE"].map((m) => (
                        <button
                          type="button"
                          key={m}
                          onClick={() => setCustomWorkMode(m)}
                          className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer border ${
                            effectiveWorkMode === m
                              ? "bg-primary text-primary-foreground border-primary font-semibold"
                              : "bg-background text-muted-foreground border-border hover:text-foreground"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider block">
                      Minimum Match Score Gate:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[60, 70, 75, 80, 90].map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => setCustomMinScore(s)}
                          className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer border ${
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
                      className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                    >
                      <X className="h-3 w-3" />
                      Reset to Parsed Intent
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Preset Chips */}
        <div className="space-y-2">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block">
            Sample Discovery Queries:
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

        {/* Advanced Options Toggle (Only for general browser agent tasks) */}
        {!isJobDiscovery && (
          <div className="pt-2">
            <button
              type="button"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {showAdvanced ? "Hide Execution Constraints" : "Configure Constraints & Domain Lock"}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4 font-mono text-xs">
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
                    className="h-8 rounded-lg border-border/60 bg-background font-mono text-xs text-foreground placeholder:text-muted-foreground"
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
                    className="w-full cursor-pointer accent-primary"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit Dispatch Button */}
        <div className="pt-2 flex items-center justify-end">
          <Button
            type="submit"
            disabled={isSubmitting || !prompt.trim()}
            className="h-10 px-6 font-mono text-xs font-semibold gap-2 shadow-md hover:shadow-primary/20 transition-all cursor-pointer bg-primary text-primary-foreground"
          >
            {isSubmitting ? (
              <>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-background border-t-transparent animate-spin" />
                {isJobDiscovery ? "Searching Multi-Source Swarm..." : "Dispatching Agent..."}
              </>
            ) : isJobDiscovery ? (
              <>
                <Search className="h-3.5 w-3.5" />
                Search Opportunities
              </>
            ) : (
              <>
                Launch Autonomous Agent
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
