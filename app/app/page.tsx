"use client";

import { useState, useEffect, Suspense } from "react";
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
  RotateCw
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskInput, type OpportunitySearchResultPayload } from "@/components/agent/task-input";
import { JobDossierDeck } from "@/components/result/job-dossier-deck";
import { AutonomousWatchCard } from "@/components/discovery/autonomous-watch-card";
import { SearchProgress } from "@/components/discovery/search-progress";
import { InterpretedIntentCard } from "@/components/discovery/interpreted-intent-card";
import { SearchStatusBanner } from "@/components/discovery/search-status-banner";
import { SearchRefinements } from "@/components/discovery/search-refinements";
import { SearchDiagnosticsCard } from "@/components/discovery/search-diagnostics-card";
import { PersonalizationIndicator } from "@/components/discovery/personalization-indicator";

function DiscoverContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [opportunityData, setOpportunityData] = useState<OpportunitySearchResultPayload | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeQuery, setActiveQuery] = useState(initialQuery);

  // Active search recovery across page refreshes (TASK-067)
  useEffect(() => {
    let cancelled = false;
    async function checkActiveSearch() {
      try {
        const res = await fetch("/api/search/active");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.active && data.query) {
          setActiveQuery(data.query);
          setIsSearching(true);
        } else if (data.recent && data.searchId && !opportunityData) {
          const histRes = await fetch(`/api/search/history/${data.searchId}`);
          if (histRes.ok) {
            const histData = await histRes.json();
            if (!cancelled && histData.search) {
              setOpportunityData({
                searchId: histData.search.id,
                status: histData.search.status === "COMPLETED" ? "COMPLETE" : histData.search.status,
                query: histData.search.rawQuery,
                results: histData.search.results || [],
                verifiedCount: (histData.search.results || []).length,
                explanation: `Restored recent search for "${histData.search.rawQuery}".`,
                metadata: {
                  totalUniqueOpportunities: (histData.search.results || []).length,
                  returnedCount: (histData.search.results || []).length,
                  durationMs: 0,
                  providersAttempted: 3,
                  providersSucceeded: 3,
                  explanation: "Restored recent search.",
                },
              });
              setActiveQuery(histData.search.rawQuery);
            }
          }
        }
      } catch {
        // Non-fatal active search check
      }
    }
    checkActiveSearch();
    return () => {
      cancelled = true;
    };
  }, []);

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
  };

  const handleResetDiscovery = () => {
    setOpportunityData(null);
    setActiveQuery("");
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/app");
    }
  };

  const handleSearchResult = (result: OpportunitySearchResultPayload | null) => {
    setOpportunityData(result);
    if (result?.query) {
      setActiveQuery(result.query);
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/app?q=${encodeURIComponent(result.query)}`);
      }
    }
  };

  const handleRefineSearch = (refinementText: string) => {
    setActiveQuery(refinementText);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Workspace Navigation Bar */}
        <WorkspaceNav />

        {/* Header Title Bar */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60"
        >
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Compass className="h-4 w-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Discover Opportunities
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Autonomous opportunity search powered by the Intelligence Harness. Enter any natural-language role, location, or freshness request.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {opportunityData && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetDiscovery}
                className="h-8 px-3 font-mono text-xs gap-1.5 border-border/70 hover:bg-muted/40 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                + New Discovery
              </Button>
            )}
            <Link href="/app/watch">
              <Button variant="outline" size="sm" className="h-8 px-3 font-mono text-xs gap-1.5 border-border/70 hover:bg-muted/40 cursor-pointer">
                <Eye className="h-3.5 w-3.5 text-primary" />
                Configure Watch
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Primary Natural Language Discovery Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-4xl mx-auto space-y-4"
        >
          <TaskInput
            key={activeQuery ? `q-${activeQuery}` : "clean"}
            initialPrompt={activeQuery}
            onOpportunitySearchResult={handleSearchResult}
            onSearchingChange={(searching) => setIsSearching(searching)}
          />
        </motion.div>

        {/* SEARCHING State: Dynamic Execution Stage & Skeletons */}
        {isSearching && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <SearchProgress query={activeQuery || initialQuery || "Searching opportunities..."} />
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
              {/* Top Header Summary */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-inner">
                    <Briefcase className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                      Opportunity Results
                      <Badge variant="secondary" className="font-mono text-xs">
                        {opportunityData.verifiedCount ?? opportunityData.results?.length ?? 0} Verified
                      </Badge>
                      {opportunityData.status === "COMPLETE" && (
                        <Badge variant="outline" className="font-mono text-xs text-emerald-500 border-emerald-500/30 bg-emerald-500/10 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Complete
                        </Badge>
                      )}
                      {opportunityData.status === "PARTIAL" && (
                        <Badge variant="outline" className="font-mono text-xs text-amber-500 border-amber-500/30 bg-amber-500/10 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Partial
                        </Badge>
                      )}
                    </h2>
                    <p className="text-xs text-muted-foreground font-mono">
                      Query: &ldquo;{opportunityData.query}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetDiscovery}
                    className="h-8 px-3 font-mono text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear Results
                  </Button>
                </div>
              </div>

              {/* Status Banner: Explains COMPLETE, PARTIAL, NO_RESULTS, or UNAUTHORIZED */}
              <SearchStatusBanner
                status={opportunityData.status}
                requestedCount={opportunityData.requestedCount || opportunityData.canonicalIntent?.requestedCount || 10}
                verifiedCount={opportunityData.verifiedCount ?? opportunityData.results?.length ?? 0}
                explanation={opportunityData.explanation}
                stoppingReason={opportunityData.diagnostics?.stoppingReason}
                errorCode={opportunityData.errorCode}
              />

              {/* Personalization Indicator (when active user memory applied) */}
              {opportunityData.personalization?.applied && (
                <PersonalizationIndicator personalization={opportunityData.personalization} />
              )}

              {/* Section 8: Interpreted Search Transparency Card */}
              {(opportunityData.canonicalIntent || opportunityData.intent) && (
                <InterpretedIntentCard
                  intent={opportunityData.intent}
                  canonicalIntent={opportunityData.canonicalIntent}
                  requestedCount={opportunityData.requestedCount}
                />
              )}

              {/* Quality Gate & Search Execution Diagnostics */}
              <SearchDiagnosticsCard
                diagnostics={opportunityData.diagnostics}
                correctionState={opportunityData.correctionState}
                sourceSummary={opportunityData.sourceSummary}
                metadata={opportunityData.metadata}
              />

              {/* Section 13: Search Refinement Chips */}
              <SearchRefinements
                currentQuery={opportunityData.query || activeQuery}
                onSelectRefinement={handleRefineSearch}
              />

              {/* 1-Click Autonomous Watch Conversion Banner (if results found) */}
              {opportunityData.results?.length > 0 && (
                <AutonomousWatchCard
                  intent={opportunityData.canonicalIntent || opportunityData.intent || { role: "Software Engineer" }}
                  query={opportunityData.query}
                />
              )}

              {/* Ranked Dossier Deck */}
              {opportunityData.results?.length > 0 && (
                <JobDossierDeck
                  jobs={opportunityData.results}
                  jobId={opportunityData.searchId}
                  onBookmarkChange={handleBookmarkChange}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* IDLE State: Feature Overview Grid (When no search is active) */}
        {!isSearching && !opportunityData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4"
          >
            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold">
                <Briefcase className="h-4 w-4" />
                Natural-Language Search
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Describe the role, location, target companies, and date boundaries. The Intelligence Harness interprets constraints and targets exact counts.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold">
                <Layers className="h-4 w-4" />
                Evidence Verification
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every opportunity is verified against live ATS pages and Quality Gates. Stale, expired, or closed listings are rejected before ranking.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold">
                <Clock className="h-4 w-4" />
                Deterministic Freshness
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Strict time-bound search filters guarantee that opportunities are actively posted within your requested timeframe (e.g. last 15 days).
              </p>
            </div>
          </motion.div>
        )}
      </main>

      <Footer />
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
