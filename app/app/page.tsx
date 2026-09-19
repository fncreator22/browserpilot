"use client";

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { 
  Compass, 
  Sparkles, 
  Briefcase, 
  X, 
  Eye, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCw, 
  Search, 
  Radio, 
  Globe, 
  ShieldCheck, 
  ArrowRight, 
  MapPin,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskInput, type OpportunitySearchResultPayload } from "@/components/agent/task-input";
import { JobDossierDeck } from "@/components/result/job-dossier-deck";
import { SearchProgress } from "@/components/discovery/search-progress";
import { SearchStatusBanner } from "@/components/discovery/search-status-banner";
import { SearchRefinements } from "@/components/discovery/search-refinements";
import { CompactExecutionPill } from "@/components/discovery/compact-execution-pill";
import { PersonalizationIndicator } from "@/components/discovery/personalization-indicator";
import { SearchAccessGateModal } from "@/components/auth/search-access-gate-modal";
import { useUIState } from "@/components/providers/ui-state-provider";
import { usePuter } from "@/hooks/usePuter";
import { toast } from "sonner";

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "Recently";
  }
}

function DiscoverContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const searchIdParam = searchParams.get("searchId");
  const { openProfileModal } = useUIState();
  const { signIn: puterSignIn, isAuthenticating: isPuterAuthenticating } = usePuter();

  const { setActiveSearch } = useUIState();
  const [opportunityData, setOpportunityData] = useState<OpportunitySearchResultPayload | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isHydratingSearch, setIsHydratingSearch] = useState(false);
  const [activeExecutionId, setActiveExecutionId] = useState<string | undefined>(undefined);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [searchHistory, setSearchHistory] = useState<Array<{ id: string; rawQuery: string; totalFound: number; createdAt: string }>>([]);
  const [hasCheckedHistory, setHasCheckedHistory] = useState(false);
  const [showAccessGate, setShowAccessGate] = useState(false);
  const searchCacheRef = useRef<Map<string, OpportunitySearchResultPayload>>(new Map());

  // Automatic one-time warning pop-up if user is not connected to Puter or BYOK API key
  useEffect(() => {
    let isMounted = true;
    async function checkProviderConnection() {
      if (typeof window === "undefined") return;
      const isDismissed = sessionStorage.getItem("browserpilot_access_gate_dismissed") === "true";
      const hasPuter = Boolean(localStorage.getItem("puter.auth.token.v2") || (window as any).puter?.authToken);
      const hasGemini = Boolean(localStorage.getItem("browserpilot_gemini_key"));
      const hasDeepseek = Boolean(localStorage.getItem("browserpilot_deepseek_key"));

      if (hasPuter || hasGemini || hasDeepseek) {
        return;
      }

      try {
        const res = await fetch("/api/account/providers");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.providers) && data.providers.some((p: any) => p.status === "ACTIVE" || p.isActive)) {
            return;
          }
        }
      } catch {}

      if (isMounted && !isDismissed) {
        setShowAccessGate(true);
      }
    }

    checkProviderConnection();

    const handleProviderUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ provider?: string; disconnected?: boolean; removed?: boolean }>;
      if (customEvent.detail?.disconnected || customEvent.detail?.removed) {
        sessionStorage.removeItem("browserpilot_access_gate_dismissed");
        checkProviderConnection();
      } else {
        setShowAccessGate(false);
      }
    };
    window.addEventListener("browserai:provider-updated", handleProviderUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("browserai:provider-updated", handleProviderUpdate);
    };
  }, []);

  useEffect(() => {
    setActiveSearch(isSearching, activeQuery);
  }, [isSearching, activeQuery, setActiveSearch]);

  const refreshSearchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/search/history?limit=6");
      if (res.ok) {
        const raw = await res.text();
        const histData = raw && raw.trim().length > 0 ? JSON.parse(raw) : null;
        if (histData?.history) {
          setSearchHistory(histData.history);
          setHasCheckedHistory(true);
        }
      }
    } catch {
      setHasCheckedHistory(true);
    }
  }, []);

  // Load a prior search instantaneously with in-memory cache and input pre-population
  const loadSearchById = useCallback(async (targetSearchId: string, directQuery?: string) => {
    try {
      if (directQuery) {
        setActiveQuery(directQuery);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("browserai:set-prompt", { detail: { prompt: directQuery } }));
        }
      }
      setIsSearching(false);

      // Check fast in-memory cache
      if (searchCacheRef.current.has(targetSearchId)) {
        const cached = searchCacheRef.current.get(targetSearchId)!;
        setOpportunityData(cached);
        setActiveQuery(cached.query || directQuery || "");
        setIsHydratingSearch(false);
        if (typeof window !== "undefined") {
          const newUrl = `/app?searchId=${targetSearchId}`;
          if (window.location.pathname + window.location.search !== newUrl) {
            window.history.pushState(null, "", newUrl);
          }
        }
        return;
      }
      
      setIsHydratingSearch(true);
      const histRes = await fetch(`/api/search/history/${targetSearchId}`);
      if (!histRes.ok) {
        setIsHydratingSearch(false);
        return;
      }
      const rawHist = await histRes.text();
      const histData = rawHist && rawHist.trim().length > 0 ? JSON.parse(rawHist) : null;
      if (histData?.search) {
        if (histData.search.status === "RUNNING" || histData.search.status === "QUEUED") {
          setActiveQuery(histData.search.rawQuery);
          setActiveExecutionId(histData.search.id);
          setIsSearching(true);
          setIsHydratingSearch(false);
          return;
        }

        const verifiedCount = (histData.search.results || []).length;
        const rawStatus = histData.search.status === "COMPLETED" ? "COMPLETE" : histData.search.status;
        const status = (verifiedCount === 0 && (rawStatus === "COMPLETE" || rawStatus === "COMPLETED"))
          ? "NO_RESULTS"
          : rawStatus;

        const canonicalIntent = histData.search.canonicalIntent || {
          role: histData.search.parsedRole || undefined,
          roles: histData.search.parsedRole ? [histData.search.parsedRole] : [],
          skills: histData.search.parsedSkills || [],
          location: histData.search.parsedLocation || undefined,
          locations: histData.search.parsedLocation ? [histData.search.parsedLocation] : [],
          workMode: histData.search.parsedWorkMode || undefined,
          workModes: histData.search.parsedWorkMode ? [histData.search.parsedWorkMode] : [],
          targetGradYear: histData.search.targetGradYear || undefined,
        };

        const dynamicRequestedCount = histData.search.requestedCount || Math.max(verifiedCount, 15);

        const formattedPayload: OpportunitySearchResultPayload = {
          searchId: histData.search.id,
          status,
          query: histData.search.rawQuery,
          results: histData.search.results || [],
          verifiedCount,
          requestedCount: dynamicRequestedCount,
          canonicalIntent,
          intent: canonicalIntent,
          diagnostics: {
            requestedCount: dynamicRequestedCount,
            validResultCount: verifiedCount,
            rejectedResultCount: 0,
            stoppingReason: verifiedCount === 0 ? "NO_PROGRESS" : "TARGET_SATISFIED",
          },
          explanation: verifiedCount > 0
            ? `Restored search conversation for "${histData.search.rawQuery}".`
            : `No verified opportunities found for "${histData.search.rawQuery}".`,
          metadata: {
            totalUniqueOpportunities: verifiedCount,
            returnedCount: verifiedCount,
            durationMs: 0,
            providersAttempted: 3,
            providersSucceeded: 3,
            explanation: verifiedCount > 0 ? "Restored search conversation." : "No verified opportunities found.",
          },
        };

        searchCacheRef.current.set(targetSearchId, formattedPayload);
        setOpportunityData(formattedPayload);
        setActiveQuery(histData.search.rawQuery);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("browserai:set-prompt", { detail: { prompt: histData.search.rawQuery } }));
          const newUrl = `/app?searchId=${targetSearchId}`;
          if (window.location.pathname + window.location.search !== newUrl) {
            window.history.pushState(null, "", newUrl);
          }
        }
      }
    } catch (err) {
      console.warn("[AppPage] Failed to load search by id:", err);
    } finally {
      setIsHydratingSearch(false);
    }
  }, []);

  // Listen for instant search hydration custom events from sidebar
  useEffect(() => {
    const handleLoadSearchEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ searchId: string; rawQuery?: string }>;
      if (customEvent.detail?.searchId) {
        loadSearchById(customEvent.detail.searchId, customEvent.detail.rawQuery);
      }
    };
    window.addEventListener("browserai:load-search", handleLoadSearchEvent);
    return () => window.removeEventListener("browserai:load-search", handleLoadSearchEvent);
  }, [loadSearchById]);

  // Reactive watcher for searchIdParam URL changes
  useEffect(() => {
    if (searchIdParam && (!opportunityData || opportunityData.searchId !== searchIdParam)) {
      loadSearchById(searchIdParam);
    }
  }, [searchIdParam, loadSearchById, opportunityData]);

  // Active search recovery and search history lookup (TASK-067 & Quality Pass Round 1)
  useEffect(() => {
    let cancelled = false;
    async function initDiscover() {
      try {
        await refreshSearchHistory();

        const cancelledExecutionId = typeof window !== "undefined"
          ? sessionStorage.getItem("browserai:cancelled_execution")
          : null;

        const res = await fetch("/api/search/active");
        if (!res.ok) return;
        const rawActive = await res.text();
        const data = rawActive && rawActive.trim().length > 0 ? JSON.parse(rawActive) : null;
        if (cancelled || !data) return;

        if (data.active && data.query) {
          if (cancelledExecutionId && (data.executionId === cancelledExecutionId || data.searchId === cancelledExecutionId)) {
            return;
          }
          setActiveQuery(data.query);
          if (data.executionId) setActiveExecutionId(data.executionId);
          setIsSearching(true);
        }
      } catch {
        // Non-fatal active search check
      }
    }
    initDiscover();
    return () => {
      cancelled = true;
    };
  }, [refreshSearchHistory]);

  const handleBookmarkChange = (opportunityId: string, isSaved: boolean) => {
    if (!opportunityData) return;
    setOpportunityData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        results: prev.results.map((r) =>
          r.id === opportunityId ? { ...r, saved: isSaved } : r
        ),
      };
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("browserai:bookmark-updated", { detail: { opportunityId, isSaved } }));
    }
  };

  const handleResetDiscovery = () => {
    setOpportunityData(null);
    setActiveQuery("");
    if (typeof window !== "undefined") {
      if (window.location.pathname + window.location.search !== "/app") {
        window.history.replaceState(null, "", "/app");
      }
    }
  };

  const handleSearchResult = useCallback((result: OpportunitySearchResultPayload | null) => {
    if (!result) {
      setOpportunityData(null);
      setIsSearching(false);
      setActiveExecutionId(undefined);
      return;
    }
    if (
      result.status === "UNAUTHORIZED" ||
      result.status === "AUTH_OR_KEY_REQUIRED"
    ) {
      setOpportunityData(null);
      setIsSearching(false);
      setActiveExecutionId(undefined);
      return;
    }
    setOpportunityData(result);
    setIsSearching(false);
    setActiveExecutionId(undefined);
    if (result?.query) {
      setActiveQuery(result.query);
      if (typeof window !== "undefined") {
        const targetUrl = `/app?q=${encodeURIComponent(result.query)}`;
        if (window.location.pathname + window.location.search !== targetUrl) {
          window.history.replaceState(null, "", targetUrl);
        }
        window.dispatchEvent(new CustomEvent("browserai:search-completed"));
      }
    }
    refreshSearchHistory();
  }, [refreshSearchHistory]);

  const handleSearchError = useCallback(() => {
    setIsSearching(false);
    setActiveExecutionId(undefined);
    setOpportunityData(null);
  }, []);

  const handleCancelActiveSearch = useCallback(async () => {
    const execId = activeExecutionId;
    setIsSearching(false);
    setActiveExecutionId(undefined);
    setOpportunityData(null);

    if (typeof window !== "undefined") {
      if (execId) {
        sessionStorage.setItem("browserai:cancelled_execution", execId);
      }
      if (window.location.search) {
        window.history.replaceState(null, "", "/app");
      }
      window.dispatchEvent(new CustomEvent("browserai:search-cancelled", { detail: { executionId: execId } }));
    }

    if (execId) {
      try {
        await fetch("/api/search/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ executionId: execId }),
        });
      } catch {}
    } else {
      try {
        await fetch("/api/search/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cancelActive: true }),
        });
      } catch {}
    }
    const { showDeduplicatedCancelToast } = await import("@/lib/utils/toastDebounce");
    showDeduplicatedCancelToast("Search execution was cancelled.");
  }, [activeExecutionId]);

  const executeDiscoverySearch = useCallback(async (queryText: string, allowFallback: boolean = true) => {
    if (!queryText || !queryText.trim()) return;
    const cleanText = queryText.trim();
    setActiveQuery(cleanText);
    setIsSearching(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: cleanText,
          allowDeterministicFallback: allowFallback,
        }),
      });
      let data: any = null;
      try {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          data = JSON.parse(text);
        }
      } catch {
        data = null;
      }
      if (data && data.status === "QUEUED" && data.executionId) {
        setActiveExecutionId(data.executionId);
        setActiveQuery(cleanText);
        setIsSearching(true);
      } else if (data) {
        handleSearchResult(data);
      } else {
        setIsSearching(false);
      }
    } catch {
      setIsSearching(false);
    }
  }, [handleSearchResult]);

  const handleRefineSearch = (refinementText: string) => {
    executeDiscoverySearch(refinementText, true);
  };

  const handleRunFallbackScraper = async () => {
    const q = opportunityData?.query || activeQuery;
    if (!q) return;
    executeDiscoverySearch(q, true);
  };

  return (
    <div className="flex-1 flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-6 pb-32 md:pb-12 sm:px-6 space-y-6">
        {/* CASE 1: INITIAL STATE (Claude / ChatGPT / Nothing OS Pristine First Impressions) */}
        <AnimatePresence mode="wait">
          {!opportunityData && !isSearching && !isHydratingSearch ? (
            <motion.div
              key="intake-hero"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="min-h-[calc(100vh-14rem)] flex flex-col justify-center items-center text-center max-w-3xl mx-auto px-4 py-8"
            >
              <div className="space-y-6 w-full">
              {/* Centered Typography */}
              <div className="max-w-2xl mx-auto py-2">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-sans font-bold tracking-tight text-foreground">
                  Where should your career go next?
                </h1>
              </div>

              {/* Central AI Search Capsule */}
              <div className="w-full pt-2 text-left">
                <TaskInput
                  key="unified-task-input"
                  initialPrompt={activeQuery}
                  executionId={activeExecutionId}
                  hasSearchHistory={searchHistory.length > 0}
                  isSearching={isSearching}
                  onOpportunitySearchResult={handleSearchResult}
                  onSearchingChange={(searching) => setIsSearching(searching)}
                  onExecutionQueued={(execId, q) => {
                    setActiveExecutionId(execId);
                    setActiveQuery(q);
                    setIsSearching(true);
                  }}
                  onCancel={handleCancelActiveSearch}
                />
              </div>

              {/* Subtle Minimalist Recent Searches */}
              {searchHistory.length > 0 && (
                <div className="pt-2 flex items-center justify-center flex-wrap gap-2 text-xs font-sans text-muted-foreground">
                  <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80">
                    <Clock className="h-3 w-3" />
                    Recent:
                  </span>
                  {searchHistory.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveQuery(item.rawQuery);
                        loadSearchById(item.id, item.rawQuery);
                      }}
                      className="px-2.5 py-1 rounded-full bg-muted/50 hover:bg-muted border border-border/60 hover:border-border text-foreground text-[11px] transition-colors cursor-pointer max-w-[200px] truncate"
                      title={item.rawQuery}
                    >
                      {item.rawQuery}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
          ) : (
            /* CASE 2: ACTIVE SEARCHING OR RESULTS DECK (Notion Dashboard Style) */
            <motion.div
              key="results-deck"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
            {/* Natural Language Discovery Input */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="max-w-3xl mx-auto space-y-4"
            >
              <TaskInput
                key="unified-task-input-active"
                initialPrompt={activeQuery}
                executionId={activeExecutionId}
                hasSearchHistory={searchHistory.length > 0}
                isSearching={isSearching}
                onOpportunitySearchResult={handleSearchResult}
                onSearchingChange={(searching) => setIsSearching(searching)}
                onExecutionQueued={(execId, q) => {
                  setActiveExecutionId(execId);
                  setActiveQuery(q);
                  setIsSearching(true);
                }}
                onCancel={handleCancelActiveSearch}
              />
            </motion.div>

            {/* SEARCHING State: Quiet Execution Pill (No Noise) */}
            {isSearching && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center py-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <CompactExecutionPill isSearching={true} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelActiveSearch}
                    className="h-7 px-2.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                  >
                    Cancel
                  </Button>
                </div>
                {/* Background SSE Dispatcher for Streamed Completion (Zero Noise) */}
                <div className="hidden" aria-hidden="true">
                  <SearchProgress
                    executionId={activeExecutionId}
                    query={activeQuery || initialQuery || "Searching opportunities..."}
                    onComplete={handleSearchResult}
                    onError={handleSearchError}
                    onCancel={handleCancelActiveSearch}
                  />
                </div>
              </motion.div>
            )}

            {/* HYDRATING SEARCH State: Fast Visual Feedback */}
            {isHydratingSearch && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col items-center justify-center py-8 space-y-3"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/60 border border-border/80 px-3.5 py-1.5 rounded-full shadow-xs">
                  <RotateCw className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Loading verified candidates for &ldquo;{activeQuery}&rdquo;...</span>
                </div>
              </motion.div>
            )}

            {/* RESULTS Deck (COMPLETE, PARTIAL, NO_RESULTS, FAILED) */}
            <AnimatePresence mode="wait">
              {!isSearching && opportunityData && (
                <motion.div
                  key={opportunityData.searchId || "results-view"}
                  initial={{ opacity: 0, y: 25 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.4 }}
                  className="max-w-5xl mx-auto space-y-6 pt-2"
                >
                  {/* Top Header Summary with Compact Execution Pill */}
                  <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-border/60">
                    <div className="flex items-center gap-3">
                      <CompactExecutionPill isSearching={isSearching} searchResult={opportunityData} />
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-sm hidden sm:inline">
                        &ldquo;{opportunityData.query}&rdquo;
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetDiscovery}
                        className="h-8 px-3 font-mono text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Status Banner - Only rendered for non-complete or zero-result states, eliminating redundant banner */}
                  {(opportunityData.status !== "COMPLETE" || !opportunityData.results || opportunityData.results.length === 0) && (
                    <SearchStatusBanner
                      status={opportunityData.status}
                      requestedCount={opportunityData.requestedCount || opportunityData.canonicalIntent?.requestedCount || 10}
                      verifiedCount={opportunityData.verifiedCount ?? opportunityData.results?.length ?? 0}
                      explanation={opportunityData.explanation}
                      stoppingReason={opportunityData.diagnostics?.stoppingReason}
                      errorCode={opportunityData.errorCode}
                      onOpenProviders={() => openProfileModal("PROVIDERS")}
                      onConnectPuter={puterSignIn}
                      onRunFallbackScraper={handleRunFallbackScraper}
                      isPuterAuthenticating={isPuterAuthenticating}
                    />
                  )}

                  {/* Personalization Indicator (when active user memory applied) */}
                  {opportunityData.personalization?.applied && (
                    <PersonalizationIndicator personalization={opportunityData.personalization} />
                  )}

                  {/* Case 1: Results > 0 - Show Results Deck Immediately */}
                  {opportunityData.results?.length > 0 ? (
                    <div className="space-y-6">
                      <JobDossierDeck
                        jobs={opportunityData.results}
                        jobId={opportunityData.searchId}
                        onBookmarkChange={handleBookmarkChange}
                      />

                      {/* Section 13: Search Refinement Chips */}
                      <div className="pt-2">
                        <SearchRefinements
                          currentQuery={opportunityData.query || activeQuery}
                          onSelectRefinement={handleRefineSearch}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Case 2: Zero Results / Smart Broadening & Assisted Recovery Deck */
                    <div className="space-y-5">
                      {(() => {
                        const rawQ = opportunityData.query || activeQuery || "";
                        const strippedTimeQ = rawQ
                          .replace(/\b(?:posted\s+)?(?:in|within|for|past)\s+(?:the\s+)?(?:last|past)\s+\d+\s*(?:hours?|hrs?|days?|d|weeks?|w|months?|m)\b/gi, "")
                          .replace(/\b(?:posted\s+)?(?:today|yesterday|this week|this month)\b/gi, "")
                          .replace(/\s+/g, " ")
                          .trim();

                        const isRemoteQuery = /\bremote\b/i.test(rawQ);
                        const strippedLocationQ = strippedTimeQ
                          .replace(/\b(?:in|near|around|at)\s+[A-Za-z\s,]+(?=\s+posted|\s+in last|$)/i, "")
                          .replace(/\s+/g, " ")
                          .trim();

                        const query7Days = `${strippedTimeQ} in the last 7 days`;
                        const query30Days = `${strippedTimeQ} in the last 30 days`;
                        const queryRemote = isRemoteQuery ? strippedTimeQ : `${strippedTimeQ} remote`;
                        const queryAllLocations = strippedLocationQ.length > 3 ? `${strippedLocationQ} in the last 7 days` : null;

                        return (
                          <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-left">
                              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-foreground shrink-0 border border-border/70">
                                <Search className="h-6 w-6" />
                              </span>
                              <div className="space-y-1">
                                <h3 className="text-base sm:text-lg font-sans font-bold text-foreground">
                                  0 Verified Results for Exact Window
                                </h3>
                                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-sans">
                                  {opportunityData.explanation || `No verified listings matched your exact criteria in this immediate time window across searched sources.`}
                                </p>
                              </div>
                            </div>

                            {/* Smart Broadening Recommendations */}
                            <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3">
                              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                                <Sparkles className="h-3.5 w-3.5 text-foreground" />
                                <span>Recommended Smart Broadening (1-Click Search):</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleRefineSearch(query7Days)}
                                  className="h-auto p-3 text-left justify-start flex-col items-start border-border/80 hover:border-foreground/40 hover:bg-card transition-all cursor-pointer"
                                >
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                    <Clock className="h-3.5 w-3.5 text-foreground" />
                                    <span>Widen to Last 7 Days</span>
                                  </div>
                                  <span className="text-[11px] text-muted-foreground font-sans mt-0.5 line-clamp-1">
                                    Search: {query7Days}
                                  </span>
                                </Button>

                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleRefineSearch(query30Days)}
                                  className="h-auto p-3 text-left justify-start flex-col items-start border-border/80 hover:border-foreground/40 hover:bg-card transition-all cursor-pointer"
                                >
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                    <Clock className="h-3.5 w-3.5 text-foreground" />
                                    <span>Widen to Last 30 Days</span>
                                  </div>
                                  <span className="text-[11px] text-muted-foreground font-sans mt-0.5 line-clamp-1">
                                    Search: {query30Days}
                                  </span>
                                </Button>

                                {!isRemoteQuery && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => handleRefineSearch(queryRemote)}
                                    className="h-auto p-3 text-left justify-start flex-col items-start border-border/80 hover:border-foreground/40 hover:bg-card transition-all cursor-pointer"
                                  >
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                      <Globe className="h-3.5 w-3.5 text-foreground" />
                                      <span>Include Remote Roles</span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground font-sans mt-0.5 line-clamp-1">
                                      Search: {queryRemote}
                                    </span>
                                  </Button>
                                )}

                                {queryAllLocations && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => handleRefineSearch(queryAllLocations)}
                                    className="h-auto p-3 text-left justify-start flex-col items-start border-border/80 hover:border-foreground/40 hover:bg-card transition-all cursor-pointer"
                                  >
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                      <MapPin className="h-3.5 w-3.5 text-foreground" />
                                      <span>Search All Locations</span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground font-sans mt-0.5 line-clamp-1">
                                      Search: {queryAllLocations}
                                    </span>
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* 1-Click Clean Watch Link */}
                            <div className="pt-2 flex items-center justify-between flex-wrap gap-2 border-t border-border/40 text-xs">
                              <span className="text-muted-foreground font-sans">Want automated alerts when new roles match this query?</span>
                              <Link href={`/app/watch?q=${encodeURIComponent(opportunityData.query || activeQuery)}`}>
                                <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 cursor-pointer">
                                  <Eye className="h-3.5 w-3.5 text-foreground" />
                                  <span>Set Up Alert in Radar</span>
                                </Button>
                              </Link>
                            </div>

                            {/* Search Refinements */}
                            <SearchRefinements
                              currentQuery={opportunityData.query || activeQuery}
                              onSelectRefinement={handleRefineSearch}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
        </AnimatePresence>


        {/* Automatic 1-Time Provider Warning Access Gate Modal */}
        <SearchAccessGateModal
          isOpen={showAccessGate}
          onClose={() => {
            setShowAccessGate(false);
            sessionStorage.setItem("browserpilot_access_gate_dismissed", "true");
          }}
          onConnected={() => {
            setShowAccessGate(false);
            sessionStorage.setItem("browserpilot_access_gate_dismissed", "true");
          }}
          queryAttempted={activeQuery || undefined}
        />
      </main>
    </div>
  );
}

export default function AppPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs font-mono">Loading Workspace...</div>}>
      <DiscoverContent />
    </Suspense>
  );
}
