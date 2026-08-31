"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { 
  Compass, 
  Sparkles, 
  Briefcase, 
  X, 
  Eye, 
  Layers, 
  ShieldCheck, 
  History,
  Clock,
  MapPin,
  Building2,
  Filter,
  CheckCircle2
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

function DiscoverContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [opportunityData, setOpportunityData] = useState<OpportunitySearchResultPayload | null>(null);
  const [isSearching, setIsSearching] = useState(false);

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
              Search multi-source job platforms (LinkedIn, Indeed, Y Combinator) using natural language with deterministic ranking and freshness gating.
            </p>
          </div>

          <div className="flex items-center gap-2">
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
            initialPrompt={initialQuery}
            onOpportunitySearchResult={(result) => setOpportunityData(result)}
            onSearchingChange={(searching) => setIsSearching(searching)}
          />
        </motion.div>

        {/* Opportunity Discovery Results Deck */}
        <AnimatePresence mode="wait">
          {opportunityData && (
            <motion.div
              key={opportunityData.searchId || "results"}
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="max-w-5xl mx-auto space-y-6 pt-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-inner">
                    <Briefcase className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                      Opportunity Results
                      <Badge variant="secondary" className="font-mono text-xs">
                        {opportunityData.results?.length || 0} Ranked Roles
                      </Badge>
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
                    onClick={() => setOpportunityData(null)}
                    className="h-8 px-3 font-mono text-xs text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear Results
                  </Button>
                </div>
              </div>

              {/* 1-Click Autonomous Watch Conversion Banner */}
              <AutonomousWatchCard
                intent={opportunityData.intent || { role: "Software Engineer" }}
                query={opportunityData.query}
              />

              {/* Ranked Dossier Deck */}
              <JobDossierDeck
                jobs={opportunityData.results || []}
                jobId={opportunityData.searchId}
                onBookmarkChange={handleBookmarkChange}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature Overview Grid (When no search results are active) */}
        {!opportunityData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4"
          >
            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold">
                <Briefcase className="h-4 w-4" />
                Multi-Source Search
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Harvests listings across LinkedIn, Y Combinator, and Indeed in parallel with 3-tier deduplication and 100-point relevance scoring.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold">
                <Eye className="h-4 w-4" />
                Autonomous Monitoring
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Convert any discovery query into a background watch that runs on your schedule and sends proactive alerts for new listings.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2 shadow-xs">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold">
                <Clock className="h-4 w-4" />
                Deterministic Freshness
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Strict time-bound search filters (24h, 48h, 72h, 7d) guarantee stale listings are rejected upstream before ranking.
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
