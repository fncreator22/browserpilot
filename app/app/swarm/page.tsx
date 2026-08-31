"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { 
  Layers, 
  Sparkles, 
  RotateCcw,
  Compass,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskInput, type OpportunitySearchResultPayload } from "@/components/agent/task-input";
import { JobDossierDeck } from "@/components/result/job-dossier-deck";

function SwarmContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [opportunityData, setOpportunityData] = useState<OpportunitySearchResultPayload | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleResetSwarm = () => {
    setOpportunityData(null);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/app/swarm");
    }
  };

  const handleSearchResult = (result: OpportunitySearchResultPayload | null) => {
    setOpportunityData(result);
    if (result?.query && typeof window !== "undefined") {
      window.history.replaceState(null, "", `/app/swarm?q=${encodeURIComponent(result.query)}`);
    }
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
                <Layers className="h-4 w-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Swarm Discovery
              </h1>
              <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30 bg-primary/5">
                Multi-Source
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Execute parallel multi-source discovery across LinkedIn, Indeed, YC, and job boards with company targeting and deterministic freshness gating.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {opportunityData && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetSwarm}
                className="h-8 px-3 font-mono text-xs gap-1.5 border-border/70 hover:bg-muted/40 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>+ New Swarm Discovery</span>
              </Button>
            )}
          </div>
        </motion.div>

        {/* Swarm Input & Execution Section */}
        <section aria-label="Swarm Discovery Search Form">
          <TaskInput
            initialPrompt={initialQuery}
            onOpportunitySearchResult={handleSearchResult}
            onSearchingChange={setIsSearching}
          />
        </section>

        {/* Results Area */}
        {opportunityData && opportunityData.results && opportunityData.results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-6 pt-4 border-t border-border/60"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <h2 className="text-lg font-bold tracking-tight">
                  Swarm Discovery Results ({opportunityData.results.length})
                </h2>
              </div>
            </div>

            <JobDossierDeck
              jobs={opportunityData.results}
              jobId={opportunityData.searchId}
              swarmSummary={{
                totalFound: opportunityData.results.length,
                validCount: opportunityData.results.length,
              }}
            />
          </motion.div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function SwarmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SwarmContent />
    </Suspense>
  );
}
