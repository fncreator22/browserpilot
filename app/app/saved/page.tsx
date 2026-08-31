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
  CheckCircle2
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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

export default function SavedOpportunitiesPage() {
  const [savedRecords, setSavedRecords] = useState<SavedOpportunityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchSavedOpportunities = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/opportunities/saved");
      if (res.ok) {
        const data = await res.json();
        setSavedRecords(data.saved || []);
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

  const handleRemoveBookmark = async (oppId: string, companyName: string, title: string) => {
    try {
      const res = await fetch(`/api/opportunities/${oppId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UNSAVE" }),
      });

      if (res.ok) {
        setSavedRecords(prev => prev.filter(r => r.opportunity.id !== oppId));
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

  const filteredRecords = savedRecords.filter(r => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const title = r.opportunity.title?.toLowerCase() || "";
    const comp = r.opportunity.companyName?.toLowerCase() || "";
    const loc = r.opportunity.location?.toLowerCase() || "";
    const skills = (r.opportunity.skills || []).join(" ").toLowerCase();
    return title.includes(term) || comp.includes(term) || loc.includes(term) || skills.includes(term);
  });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Workspace Navigation Bar */}
        <WorkspaceNav savedCount={savedRecords.length} showNewSearchButton />

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bookmark className="h-4 w-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Saved Opportunities
              </h1>
              <Badge variant="secondary" className="font-mono text-xs">
                {savedRecords.length} Saved
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Your curated shortlist of high-fit roles and verified employer listings.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/app">
              <Button size="sm" className="h-8 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs">
                <Compass className="h-3.5 w-3.5" />
                Find More Opportunities
              </Button>
            </Link>
          </div>
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
                className="w-full h-9 pl-9 pr-3 text-xs font-mono rounded-lg border border-border/70 bg-card text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary/50"
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
            {filteredRecords.map(({ savedId, savedAt, opportunity: opp }) => (
              <div
                key={savedId}
                className="rounded-xl border border-border/70 bg-card p-5 space-y-4 hover:border-primary/40 transition-all flex flex-col justify-between shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-snug">
                        {opp.title}
                      </h3>
                      <p className="text-xs font-semibold text-primary font-mono flex items-center gap-1.5">
                        {opp.companyName}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveBookmark(opp.id, opp.companyName, opp.title)}
                      className="text-muted-foreground hover:text-rose-500 transition-colors p-1 cursor-pointer"
                      title="Remove from saved"
                      aria-label="Remove bookmark"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Badges & Work Mode */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                    {opp.location && (
                      <Badge variant="outline" className="text-[10px] gap-1 bg-muted/20">
                        <MapPin className="h-2.5 w-2.5" />
                        {opp.location}
                      </Badge>
                    )}
                    {opp.workMode && (
                      <Badge variant="secondary" className="text-[10px]">
                        {opp.workMode}
                      </Badge>
                    )}
                    {opp.opportunityType && (
                      <Badge variant="outline" className="text-[10px]">
                        {opp.opportunityType}
                      </Badge>
                    )}
                  </div>

                  {/* Skills preview */}
                  {opp.skills && opp.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {opp.skills.slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="inline-block rounded px-1.5 py-0.5 text-[10px] font-mono bg-muted/40 text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Saved {new Date(savedAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2">
                    <Link href={`/app/opportunities/${opp.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 px-2 font-mono text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                        Details
                      </Button>
                    </Link>

                    {opp.primaryApplyUrl && (
                      <a
                        href={opp.primaryApplyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex"
                      >
                        <Button size="sm" className="h-7 px-2.5 font-mono text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs">
                          <span>Apply</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
              <Button size="sm" className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs">
                <Compass className="h-3.5 w-3.5" />
                Start Opportunity Discovery
              </Button>
            </Link>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
