"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bot, 
  Sparkles, 
  ShieldCheck, 
  Terminal, 
  Lock, 
  Briefcase,
  Search,
  X,
  Radio,
  Sliders,
  History
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskInput, type OpportunitySearchResultPayload } from "@/components/agent/task-input";
import { AIProviderSelector } from "@/components/ui/ai-provider-selector";
import { JobDossierDeck } from "@/components/result/job-dossier-deck";
import { AutonomousWatchCard } from "@/components/discovery/autonomous-watch-card";

export default function AppPage() {
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
        {/* Header Title Bar */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Autonomous Task & Opportunity Hub
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Search multi-source job opportunities, configure autonomous watches, or launch sandboxed browser agents.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/app/history">
              <Button variant="outline" size="sm" className="h-8 px-3 font-mono text-xs gap-1.5 border-border/70 hover:bg-muted/40 cursor-pointer">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                Discovery History & Watches
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Primary Task Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-4xl mx-auto space-y-4"
        >
          {/* AI Provider & Token Status Bar */}
          <AIProviderSelector />

          <div className="flex items-center justify-between pt-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground font-mono flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Natural-Language Query Entry
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              Deterministic 0-Token Swarm Discovery
            </span>
          </div>

          <TaskInput
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
              <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-inner">
                    <Briefcase className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                      Opportunity Discovery Deck
                      <Badge variant="secondary" className="font-mono text-xs">
                        {opportunityData.results?.length || 0} Ranked Opportunities
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

              {/* 1-Click Autonomous Watch Banner */}
              <AutonomousWatchCard
                intent={opportunityData.intent || { role: "Software Engineer" }}
                query={opportunityData.query}
              />

              {/* Ranked Dossier Cards */}
              <JobDossierDeck
                jobs={opportunityData.results || []}
                jobId={opportunityData.searchId}
                swarmSummary={{
                  sourcesCount: opportunityData.metadata?.providersAttempted || 3,
                  totalFound: opportunityData.metadata?.totalDiscovered || opportunityData.results.length,
                  deduplicatedCount: opportunityData.metadata?.totalUniqueOpportunities || opportunityData.results.length,
                  tokenCost: "$0.00 (0 Tokens)",
                }}
                onBookmarkChange={handleBookmarkChange}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature Overview Grid (When no results are active) */}
        {!opportunityData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4"
          >
            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2 shadow-sm">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold">
                <Briefcase className="h-4 w-4" />
                Multi-Source Swarm
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Parallel deterministic harvesting across LinkedIn, Y Combinator, and Indeed with 3-tier deduplication and student relevance ranking.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2 shadow-sm">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold">
                <Radio className="h-4 w-4" />
                Autonomous Watch
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Convert any discovery query into a background watch. Receive proactive alerts only when brand new opportunities or reposts are found.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2 shadow-sm">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold">
                <Terminal className="h-4 w-4" />
                Playwright Verification
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Evidence verification captures live screenshot proofs of target employer career portals for full authenticity assurance.
              </p>
            </div>
          </motion.div>
        )}
      </main>

      <Footer />
    </div>
  );
}
