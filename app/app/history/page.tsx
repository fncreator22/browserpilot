"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

import { 
  History, 
  Search, 
  Clock, 
  ArrowUpRight, 
  ExternalLink, 
  Briefcase, 
  MapPin, 
  RotateCw, 
  Trash2, 
  Eye, 
  X, 
  Compass, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  Plus
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JobDossierDeck, type DossierJobItem } from "@/components/result/job-dossier-deck";
import { toast } from "sonner";

interface SearchHistoryItem {
  id: string;
  rawQuery: string;
  intentType: string;
  parsedRole?: string | null;
  parsedSkills?: string[] | null;
  parsedLocation?: string | null;
  parsedWorkMode?: string | null;
  targetGradYear?: number | null;
  totalFound: number;
  status: string;
  createdAt: string;
}

interface HistoricalSessionDetail {
  id: string;
  rawQuery: string;
  intentType: string;
  status: string;
  createdAt: string;
  totalFound: number;
  results: DossierJobItem[];
}

function HistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyTab = searchParams.get("tab");

  // Backward compatibility redirect for legacy tab parameters
  useEffect(() => {
    if (legacyTab === "WATCH") {
      router.replace("/app/watch");
    } else if (legacyTab === "SAVED") {
      router.replace("/app/saved");
    } else if (legacyTab === "ALERTS") {
      router.replace("/app/notifications");
    }
  }, [legacyTab, router]);

  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [viewingSession, setViewingSession] = useState<HistoricalSessionDetail | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  const fetchSearchHistory = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/search/history");
      if (res.ok) {
        const data = await res.json();
        if (data.history) setSearchHistory(data.history);
      }
    } catch {
      // Non-fatal
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSearchHistory();
  }, []);

  const handleInspectSession = async (sessionId: string) => {
    try {
      setIsLoadingSession(true);
      const res = await fetch(`/api/search/history/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setViewingSession(data);
      } else {
        toast.error("Failed to load historical session details");
      }
    } catch {
      toast.error("Session inspection error");
    } finally {
      setIsLoadingSession(false);
    }
  };

  const filteredHistory = searchHistory.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const q = item.rawQuery?.toLowerCase() || "";
    const r = item.parsedRole?.toLowerCase() || "";
    const l = item.parsedLocation?.toLowerCase() || "";
    const s = (item.parsedSkills || []).join(" ").toLowerCase();
    return q.includes(term) || r.includes(term) || l.includes(term) || s.includes(term);
  });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Workspace Navigation Bar */}
        <WorkspaceNav showNewSearchButton />

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <History className="h-4 w-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Search History
              </h1>
              <Badge variant="secondary" className="font-mono text-xs">
                {searchHistory.length} Sessions
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Review previous natural-language discovery sessions, replay queries, and inspect past candidate pools.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/app">
              <Button size="sm" className="h-8 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs">
                <Plus className="h-3.5 w-3.5" />
                Start New Discovery
              </Button>
            </Link>
          </div>
        </div>

        {/* Filter Input */}
        {searchHistory.length > 0 && (
          <div className="flex items-center justify-between gap-4 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search queries, roles, skills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs font-mono rounded-lg border border-border/70 bg-card text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary/50"
              />
            </div>
          </div>
        )}

        {/* History List */}
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs font-mono text-muted-foreground">Loading discovery history...</p>
          </div>
        ) : filteredHistory.length > 0 ? (
          <div className="space-y-3 max-w-5xl">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border/70 bg-card p-4 sm:p-5 hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono text-[10px] bg-muted/30">
                      {item.intentType || "DISCOVERY"}
                    </Badge>
                    <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {item.totalFound} Found
                    </Badge>
                  </div>

                  <h3 className="text-sm font-semibold text-foreground">
                    &ldquo;{item.rawQuery}&rdquo;
                  </h3>

                  {/* Parsed attributes */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                    {item.parsedRole && (
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                        {item.parsedRole}
                      </Badge>
                    )}
                    {item.parsedLocation && (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {item.parsedLocation}
                      </span>
                    )}
                    {item.parsedSkills && item.parsedSkills.length > 0 && (
                      <span>Skills: {item.parsedSkills.slice(0, 3).join(", ")}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInspectSession(item.id)}
                    className="h-8 font-mono text-xs gap-1.5 border-border/70 hover:bg-muted/40 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    Review
                  </Button>

                  <Link href={`/app?q=${encodeURIComponent(item.rawQuery)}`}>
                    <Button
                      size="sm"
                      className="h-8 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      Re-run
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="py-20 text-center space-y-4 max-w-md mx-auto rounded-2xl border border-dashed border-border/70 p-8 bg-card/40">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <History className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-foreground">No Search History Yet</h2>
              <p className="text-xs text-muted-foreground">
                Run natural-language opportunity searches on Discover to see past queries, results, and sessions recorded here.
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

        {/* Historical Session Results Inspection Modal */}
        {viewingSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="relative w-full max-w-5xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border/60">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      Session #{viewingSession.id.slice(-6)}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">
                      {new Date(viewingSession.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-foreground">
                    &ldquo;{viewingSession.rawQuery}&rdquo;
                  </h2>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewingSession(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Dossier deck of historical results */}
              {viewingSession.results && viewingSession.results.length > 0 ? (
                <JobDossierDeck
                  jobs={viewingSession.results}
                  jobId={viewingSession.id}
                />
              ) : (
                <div className="py-12 text-center text-xs font-mono text-muted-foreground">
                  No cached opportunity results found in this session snapshot.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-mono">Loading History...</div>}>
      <HistoryContent />
    </Suspense>
  );
}
