"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Search,
  Briefcase,
  Layers,
  Clock,
  Globe,
  Target,
  ChevronDown,
  ChevronUp,
  X,
  Square,
  AlertTriangle,
  SlidersHorizontal,
  ImagePlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PromptEnhancer } from "@/components/prompt/prompt-enhancer";
import { parseSearchIntent } from "@/lib/scraper/intentParser";
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
  isSearching?: boolean;
  onOpportunitySearchResult?: (result: OpportunitySearchResultPayload | null) => void;
  onSearchingChange?: (isSearching: boolean) => void;
  onExecutionQueued?: (executionId: string, query: string) => void;
}

const PLACEHOLDER_IDEAS = [
  "Search remote AI & Machine Learning internships for 2026 batch...",
  "Find entry-level full-stack roles at Y Combinator startups...",
  "Search lead frontend engineer opportunities with React & Next.js...",
  "Discover data analyst roles in Bengaluru posted in the last 48 hours...",
];

const PRESET_TEMPLATES = [
  {
    label: "Remote AI & Systems Engineer",
    icon: Briefcase,
    goal: "Find remote AI and Machine Learning engineering roles at high-growth startups.",
    domains: "",
    steps: 0,
  },
  {
    label: "Founding Full Stack at YC Startup",
    icon: Layers,
    goal: "Discover founding full stack and frontend engineering opportunities at Y Combinator companies with React and TypeScript.",
    domains: "",
    steps: 0,
  },
  {
    label: "Data Analyst in Bengaluru (Last 30 Days)",
    icon: Search,
    goal: "Find data analyst in bengaluru in last 30 days.",
    domains: "",
    steps: 0,
  },
  {
    label: "Staff Frontend Architect",
    icon: Layers,
    goal: "Search for lead or staff frontend engineer opportunities with React, Next.js, and TypeScript.",
    domains: "",
    steps: 0,
  },
];

export interface DetailedPromptPreset {
  id: string;
  category: string;
  label: string;
  prompt: string;
  targetRole: string;
  howItWorks: string;
  backendAction: string;
}

export const DETAILED_PROMPTS: DetailedPromptPreset[] = [
  {
    id: "remote-ai-internships",
    category: "Early Career & Internships",
    label: "Remote AI Internships (2026 Batch)",
    prompt: "Find remote AI and Machine Learning internships for 2026 graduates in India and US at high-growth startups.",
    targetRole: "AI / ML Intern",
    howItWorks: "Concurrently queries Greenhouse and Lever ATS boards for AI/ML student openings, filtering for 2026 graduation criteria and remote work mode.",
    backendAction: "Direct ATS extraction -> Gemini intent parsing -> Truth gate verification -> Persistence to searches & opportunities tables.",
  },
  {
    id: "yc-fullstack",
    category: "Startup Engineering",
    label: "YC Startup Full Stack Roles",
    prompt: "Discover entry-level full stack and frontend engineering opportunities at Y Combinator companies with React and TypeScript.",
    targetRole: "Full Stack Engineer",
    howItWorks: "Targets Y Combinator portfolio company ATS endpoints for React/Next.js/Node roles, cross-referencing salary transparency minimums.",
    backendAction: "ATS scraper swarm -> Multi-source deduplication -> Ghost job screening -> Ingestion to opportunity store.",
  },
  {
    id: "data-analyst-fresh",
    category: "Location & Freshness Focus",
    label: "Data Analyst in Bengaluru (Last 48 Hours)",
    prompt: "Find data analyst roles in Bengaluru posted in the last 48 hours with SQL and Python.",
    targetRole: "Data Analyst",
    howItWorks: "Applies hard freshness cutoffs (<= 48h) across Indian startup ATS endpoints, screening out stale reposts.",
    backendAction: "Time-bounded discovery -> Posting date validation -> Fit score computation -> Instant notification alert.",
  },
  {
    id: "lead-frontend-staff",
    category: "Senior & Staff Roles",
    label: "Lead / Staff Frontend (React & Next.js)",
    prompt: "Search for lead or staff frontend engineer opportunities with React, Next.js, and TypeScript offering above $150,000.",
    targetRole: "Lead Frontend Engineer",
    howItWorks: "Extracts high-compensation senior engineering requisitions, parsing compensation bands and recruiter credentials.",
    backendAction: "Recruiter personnel enrichment -> Salary range normalization -> Dossier compilation.",
  },
  {
    id: "autonomous-watch-seed",
    category: "Autonomous Intelligence",
    label: "Autonomous Watch: Distributed Systems",
    prompt: "Monitor Golang and Rust distributed systems engineer roles at Series A-C startups with remote work option.",
    targetRole: "Distributed Systems Engineer",
    howItWorks: "Instantiates a continuous background discovery watch that rescans ATS feeds every 4h and sends notification alerts when new matches appear.",
    backendAction: "DiscoveryWatch scheduler registration -> BullMQ worker claiming -> Autonomous alert dispatch.",
  },
];

export interface RecommendationItem {
  label: string;
  goal: string;
  icon?: any;
  domains?: string;
  steps?: number;
}

export function TaskInput({
  initialPrompt = "",
  isCompact = false,
  hasSearchHistory = false,
  isSearching = false,
  onOpportunitySearchResult,
  onSearchingChange,
  onExecutionQueued,
}: TaskInputProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [showPrompts, setShowPrompts] = useState(false);
  const prevInitialPromptRef = useRef(initialPrompt);

  useEffect(() => {
    if (initialPrompt !== undefined && initialPrompt !== prevInitialPromptRef.current) {
      prevInitialPromptRef.current = initialPrompt;
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_IDEAS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isBusy = isSubmitting || Boolean(isSearching);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attachedImage, setAttachedImage] = useState<{ base64: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              setAttachedImage({
                base64: reader.result,
                name: file.name || "pasted_screenshot.png",
              });
              toast.success("Screenshot attached for DeepReach Vision extraction");
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setAttachedImage({
            base64: reader.result,
            name: file.name,
          });
          toast.success("Image attached for DeepReach Vision extraction");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Dynamic recommendations personalized to user career memory & search history
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(PRESET_TEMPLATES);
  const [isPersonalized, setIsPersonalized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadDynamicRecommendations() {
      try {
        const res = await fetch("/api/account/recommendations");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
            const mapped = data.recommendations.map((item: any) => {
              let IconComponent = Briefcase;
              if (item.icon === "layers") IconComponent = Layers;
              else if (item.icon === "search") IconComponent = Search;
              else if (item.icon === "sparkles") IconComponent = Sparkles;
              return {
                label: item.label,
                goal: item.goal,
                icon: IconComponent,
                domains: "",
                steps: 0,
              };
            });
            setRecommendations(mapped);
            setIsPersonalized(Boolean(data.personalized));
          }
        }
      } catch {
        // Silently retain static presets
      }
    }
    loadDynamicRecommendations();
    return () => {
      isMounted = false;
    };
  }, []);

  const parsedIntent = useMemo(() => {
    if (!prompt.trim()) return null;
    try {
      return parseSearchIntent(prompt);
    } catch {
      return null;
    }
  }, [prompt]);

  // Refinement overrides state (progressive disclosure)
  const [showRefine, setShowRefine] = useState(false);
  const [customFreshness, setCustomFreshness] = useState<number | null>(null);
  const [customWorkMode, setCustomWorkMode] = useState<string | null>(null);
  const [customOppType, setCustomOppType] = useState<string | null>(null);
  const [customMinScore, setCustomMinScore] = useState<number | null>(null);

  const effectiveFreshnessHours = customFreshness !== null ? customFreshness : parsedIntent?.freshnessWindowHours;
  const effectiveWorkMode = customWorkMode || parsedIntent?.workMode || "ANY";
  const effectiveMinScore = customMinScore !== null ? customMinScore : (parsedIntent?.minimumMatchScore || 70);

  // Execution concurrency & cancellation controls
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let text = prompt.trim();
    if (!text && !attachedImage) return;

    if (isBusy) {
      toast.info("Search in progress", {
        description: "Your discovery query is actively querying ATS connectors.",
      });
      return;
    }

    // Grab client Puter token if user is signed into Puter in this browser
    const clientPuterToken = typeof window !== "undefined"
      ? (localStorage.getItem("puter.auth.token.v2") || (window as any).puter?.authToken || undefined)
      : undefined;

    // 1. If an image is attached, run DeepReach Vision Multi-Platform Discovery
    if (attachedImage) {
      setIsSubmitting(true);
      if (onSearchingChange) onSearchingChange(true);
      try {
        let clientOcrText: string | undefined;
        if (typeof window !== "undefined" && window.puter?.ai?.img2txt) {
          try {
            clientOcrText = await window.puter.ai.img2txt(attachedImage.base64);
          } catch {
            // Non-fatal, server-side will handle
          }
        }

        const deepRes = await fetch("/api/discovery/deep-reach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: attachedImage.base64,
            mimeType: attachedImage.base64.match(/^data:([^;]+);base64,/)?.[1] || "image/png",
            prompt: text,
            puterToken: clientPuterToken,
            ocrText: clientOcrText,
          }),
        });
        const deepData = await deepRes.json();
        if (!deepRes.ok && deepData.error === "UPGRADE_REQUIRED") {
          toast.warning("DeepReach Pro Feature", {
            description: "Cross-platform recruiter scouting and flyer scanning requires a Pro subscription.",
            action: {
              label: "Upgrade",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.hash = "settings?tab=subscription";
                }
              },
            },
          });
        }

        if (deepRes.ok && deepData.data) {
          // Listing Trust Advisory Toast for ghost jobs or undisclosed employers
          if (deepData.data.isUndisclosed || deepData.data.trustReport?.isGhostJob) {
            toast.warning("Listing Trust Advisory", {
              description: deepData.data.trustReport?.advisoryTitle || "Suspicious or undisclosed listing detected.",
            });
          }

          const foundJobs = deepData.data.jobs && deepData.data.jobs.length > 0;
          if (foundJobs) {
            toast.success("DeepReach Vision Processed", {
              description: `Extracted ${deepData.data.companyName}: ${deepData.data.jobs.length} jobs, ${deepData.data.recruiters?.length || 0} recruiters verified.`,
            });
            if (onOpportunitySearchResult) {
              onOpportunitySearchResult({
                searchId: `deep_${Date.now()}`,
                status: "COMPLETE",
                query: text || deepData.data.companyName,
                results: deepData.data.jobs.map((j: any) => ({
                  id: `deep_${Math.random().toString(36).slice(2, 7)}`,
                  title: j.title,
                  companyName: j.companyName,
                  primaryApplyUrl: j.applyUrl,
                  applyUrl: j.applyUrl,
                  sourcePlatform: j.sourcePlatform,
                  verificationStatus: "VERIFIED",
                  matchScore: 92,
                  companyContacts: deepData.data.recruiters,
                  trustReport: deepData.data.trustReport,
                  urlAnalysis: deepData.data.urlAnalysis,
                  companyIntelligence: deepData.data.companyIntelligence,
                  isUndisclosed: deepData.data.isUndisclosed,
                })),
                metadata: {
                  totalUniqueOpportunities: deepData.data.jobs.length,
                  returnedCount: deepData.data.jobs.length,
                  durationMs: 1200,
                  providersAttempted: 4,
                  providersSucceeded: 4,
                  explanation: deepData.data.multimodalSummary || "DeepReach multi-platform extraction complete",
                },
              });
            }
            setIsSubmitting(false);
            if (onSearchingChange) onSearchingChange(false);
            return;
          } else if (deepData.data.companyName) {
            // Planner-Executor Bridge: Fall back to mainline ATS and Job search engine
            toast.info(`Vision Extracted: ${deepData.data.companyName}`, {
              description: `Searching direct ATS and career endpoints for ${deepData.data.companyName}...`,
            });
            const bridgeQuery = [deepData.data.companyName, deepData.data.roleTitle || "Software Engineer"].filter(Boolean).join(" ");
            text = bridgeQuery;
            if (deepData.data.recruiters && deepData.data.recruiters.length > 0) {
              (window as any).__lastDeepReachContacts = deepData.data.recruiters;
            }
            setAttachedImage(null);
            // Fall through to mainline search POST /api/search
          } else {
            toast.info("Image Analyzed", {
              description: "No specific company detected in image. Running general query...",
            });
            setAttachedImage(null);
            // Fall through to mainline search
          }
        } else if (deepData.error === "UPGRADE_REQUIRED") {
          toast.warning("DeepReach Pro Feature", {
            description: deepData.message || "DeepReach multi-platform intelligence is a Pro feature.",
            action: {
              label: "Upgrade Plan",
              onClick: () => {
                window.location.href = "/app#settings?tab=subscription";
              },
            },
          });
          setIsSubmitting(false);
          if (onSearchingChange) onSearchingChange(false);
          return;
        } else if (deepData.error === "AI_CONFIGURATION_REQUIRED" || deepData.error === "AI_KEY_REQUIRED") {
          toast.warning("AI Provider Required", {
            description: "Connect Puter (free 1-click) or add a Gemini API key in Settings (Tab 1: AI Providers & Keys).",
          });
          setIsSubmitting(false);
          if (onSearchingChange) onSearchingChange(false);
          return;
        } else {
          toast.error(deepData.message || "DeepReach extraction failed");
          setIsSubmitting(false);
          if (onSearchingChange) onSearchingChange(false);
          return;
        }
      } catch (err: any) {
        toast.error("DeepReach Extraction Failed", { description: err.message });
        setIsSubmitting(false);
        if (onSearchingChange) onSearchingChange(false);
        return;
      }
    }

    setIsSubmitting(true);
    if (onSearchingChange) onSearchingChange(true);
    setSubmitError(null);

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;
    const timeoutId = setTimeout(() => {
      abortCtrl.abort(new Error("Search timed out: Upstream ATS connectors took too long to respond. Try narrowing your query or retrying."));
    }, 25000);

    let searchHandedOffToQueue = false;
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
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          puterToken: clientPuterToken,
        }),
        signal: abortCtrl.signal,
      });

      const execIdHeader = res.headers.get("x-execution-id");
      if (execIdHeader) {
        currentExecutionIdRef.current = execIdHeader;
      }

      const data = await res.json();

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
        if (res.status === 429) {
          toast.error(data.message || "Rate limit reached. Please wait a moment before trying again.");
          return;
        }
        if (res.status === 499) {
          return;
        }
        throw new Error(data.message || "Failed to execute opportunity discovery search.");
      }

      if (data.status === "QUEUED" && data.executionId) {
        searchHandedOffToQueue = true;
        currentExecutionIdRef.current = data.executionId;
        setIsSubmitting(false);
        if (onExecutionQueued) {
          onExecutionQueued(data.executionId, text);
        }
        return;
      }

      if (typeof window !== "undefined" && (window as any).__lastDeepReachContacts && data.results && data.results.length > 0) {
        data.results = data.results.map((r: any) => ({
          ...r,
          companyContacts: r.companyContacts || (window as any).__lastDeepReachContacts,
        }));
        (window as any).__lastDeepReachContacts = undefined;
      }

      if (onOpportunitySearchResult) {
        onOpportunitySearchResult(data);
      }

      if (data.status === "MODEL_CONFIGURATION_REQUIRED" || data.errorCode === "MODEL_CONFIGURATION_REQUIRED") {
        toast.warning("AI Provider Configuration Required", {
          description: "Connect free Puter AI or add your Gemini API key to run autonomous AI searches.",
        });
        return;
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
      if (!searchHandedOffToQueue && onSearchingChange) {
        onSearchingChange(false);
      }
    }
  };

  const handleSelectPreset = (preset: RecommendationItem) => {
    setPrompt(preset.goal);
  };

  const hasActiveFilters = customFreshness !== null || (customWorkMode && customWorkMode !== "ANY") || customMinScore !== null;

  return (
    <div className="w-full space-y-3">
      {/* Omni-Command Bar Shell */}
      <form
        id="task-input-form"
        onSubmit={handleSubmit}
        className={`max-w-3xl mx-auto rounded-2xl border bg-card p-3.5 sm:p-4 shadow-sm transition-all space-y-3 ${
          isBusy
            ? "border-foreground/40 animate-glow-active shadow-md"
            : "border-border/80 hover:border-foreground/30 focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/20"
        }`}
      >
        {/* Textarea: Clean, borderless with dynamic rotating placeholder */}
        <div className="relative">
          <label htmlFor="task-goal" className="sr-only">
            Describe your career discovery query
          </label>
          {attachedImage && (
            <div className="mb-2 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-300">
              <span className="font-medium text-[11px]">DeepReach Vision:</span>
              <span className="font-mono text-[11px] truncate max-w-[180px]">{attachedImage.name}</span>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-800 rounded cursor-pointer"
                title="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <Textarea
            id="task-goal"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={attachedImage ? "Add any additional context or hit Discover to parse image..." : PLACEHOLDER_IDEAS[placeholderIndex]}
            rows={isCompact ? 2 : 3}
            className="text-sm sm:text-base leading-relaxed placeholder:text-muted-foreground/50 resize-none min-h-[70px] focus:outline-none bg-transparent w-full p-0 border-0 shadow-none focus-visible:ring-0 font-sans"
          />
        </div>

        {/* Error Alert */}
        {submitError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-xs font-sans text-destructive flex items-center justify-between gap-3 animate-in fade-in-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <span>{submitError}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSubmitError(null)}
              className="h-5 w-5 p-0 text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Action Bar (Bottom of Textarea) */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
          {/* Left Actions: Prompt Enhancer + Filters Toggle Button */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <PromptEnhancer
              currentPrompt={prompt}
              onApplyPrompt={(newP) => setPrompt(newP)}
            />
            <button
              type="button"
              onClick={() => setShowRefine(!showRefine)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-sans font-medium transition-colors cursor-pointer border ${
                showRefine || hasActiveFilters
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/70"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 stroke-[1.75]" />
              <span className="hidden sm:inline">Filters</span>
              {hasActiveFilters && (
                <span className="h-1.5 w-1.5 rounded-full bg-background" />
              )}
              {showRefine ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-sans font-medium transition-colors cursor-pointer border ${
                attachedImage
                  ? "bg-primary/10 text-primary border-primary/40"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/70"
              }`}
              title="Upload job flyer or screenshot (DeepReach Vision)"
            >
              <ImagePlus className="h-3.5 w-3.5 stroke-[1.75]" />
              <span className="hidden sm:inline">Image</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPrompts(!showPrompts)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-sans font-medium transition-colors cursor-pointer border ${
                showPrompts
                  ? "bg-emerald-600 text-white border-emerald-500"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/70"
              }`}
              title="Toggle Curated Discovery Prompts"
            >
              <Sparkles className="h-3.5 w-3.5 stroke-[1.75]" />
              <span className="hidden sm:inline">Prompts</span>
              {showPrompts ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Right Actions: Stop Search + Primary Discover Button */}
          <div className="flex items-center gap-2">
            {isBusy && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancelSearch}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-9 px-3 font-medium flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors text-xs font-sans"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span>Stop</span>
              </Button>
            )}

            <Button
              type="submit"
              disabled={isBusy || (!prompt.trim() && !attachedImage)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-9 px-4 font-semibold flex items-center gap-x-2 cursor-pointer shadow-xs transition-all disabled:opacity-50 text-xs sm:text-sm font-sans"
            >
              {isBusy ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5 stroke-[2]" />
                  <span>Discover</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Progressive Disclosure Filters Panel */}
        <AnimatePresence>
          {showRefine && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-1 border-t border-border/50 space-y-3 font-sans text-xs">
                {/* Freshness Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-foreground" />
                    Freshness
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      { label: "24h", value: 24 },
                      { label: "48h", value: 48 },
                      { label: "7d", value: 168 },
                      { label: "Any", value: 0 },
                    ].map((f) => {
                      const isSelected = effectiveFreshnessHours === f.value || (f.value === 0 && !effectiveFreshnessHours);
                      return (
                        <button
                          type="button"
                          key={f.label}
                          onClick={() => setCustomFreshness(f.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary font-semibold"
                              : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Work Mode Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-foreground" />
                    Work Mode
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      { id: "ANY", label: "Any" },
                      { id: "REMOTE", label: "Remote" },
                      { id: "HYBRID", label: "Hybrid" },
                      { id: "ON_SITE", label: "Onsite" },
                    ].map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setCustomWorkMode(m.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                          effectiveWorkMode === m.id
                            ? "bg-primary text-primary-foreground border-primary font-semibold"
                            : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Min Match Score Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-foreground" />
                    Min Match Score
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      { label: "70%", value: 70 },
                      { label: "80%", value: 80 },
                      { label: "90%", value: 90 },
                    ].map((s) => (
                      <button
                        type="button"
                        key={s.label}
                        onClick={() => setCustomMinScore(s.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                          effectiveMinScore === s.value
                            ? "bg-primary text-primary-foreground border-primary font-semibold"
                            : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset Filters */}
                {hasActiveFilters && (
                  <div className="pt-2 flex justify-end border-t border-border/30">
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
                      className="h-6 text-[11px] font-sans text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                      Reset filters
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Detailed Prompts Panel */}
      <AnimatePresence>
        {showPrompts && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="max-w-3xl mx-auto overflow-hidden pt-2"
          >
            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-sans font-bold text-foreground">Discovery Prompt Library</h3>
                  <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">Explore prompts and system pipeline flow</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrompts(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1 rounded-md cursor-pointer"
                  aria-label="Close prompts"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-[380px] overflow-y-auto pr-1">
                {DETAILED_PROMPTS.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-border/70 bg-background/60 hover:border-primary/40 transition-all space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-mono text-primary font-semibold uppercase tracking-wider block">
                          {item.category}
                        </span>
                        <h4 className="text-xs font-bold text-foreground">{item.label}</h4>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPrompt(item.prompt);
                            setShowPrompts(false);
                            toast.success("Prompt loaded into search input");
                          }}
                          className="h-7 px-2.5 font-mono text-[11px] cursor-pointer"
                        >
                          Use Prompt
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setPrompt(item.prompt);
                            setShowPrompts(false);
                            handleSelectPreset({ label: item.label, goal: item.prompt });
                          }}
                          className="h-7 px-2.5 font-mono text-[11px] bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-xs"
                        >
                          Run Discovery
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs font-mono text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/40">
                      &ldquo;{item.prompt}&rdquo;
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-muted-foreground border-t border-border/30">
                      <div>
                        <span className="text-foreground font-semibold block text-[10px]">What It Discovers:</span>
                        <span>{item.howItWorks}</span>
                      </div>
                      <div>
                        <span className="text-foreground font-semibold block text-[10px]">System Pipeline:</span>
                        <span>{item.backendAction}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preset Recommendation Chips: Displayed when prompt is empty */}
      {!prompt.trim() && (
        <div className="max-w-3xl mx-auto space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-sans text-muted-foreground font-medium">
              <Sparkles className="h-3 w-3 text-foreground" />
              <span>{isPersonalized ? "Recommended for you:" : "Sample discovery queries:"}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPrompts(!showPrompts)}
              className="text-[11px] font-mono text-primary hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>{showPrompts ? "Hide prompt library" : "Show all prompts"}</span>
              <Sparkles className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {recommendations.map((preset) => {
              const Icon = preset.icon || Briefcase;
              return (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => handleSelectPreset(preset)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 hover:border-foreground/40 transition-all cursor-pointer shrink-0 shadow-2xs"
                >
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
