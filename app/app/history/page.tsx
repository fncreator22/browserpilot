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
  Plus,
  Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InfoBadge } from "@/components/ui/info-badge";
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

interface DiscoveryRunHistoryItem {
  id: string;
  triggerType: string;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  providersAttempted: number;
  providersSucceeded: number;
  providersFailed: number;
  candidatesFound: number;
  validCandidates: number;
  newOpportunities: number;
  notificationsCreated: number;
  errorMessage?: string | null;
  totalFound: number;
  results: DossierJobItem[];
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

  const [activeTab, setActiveTab] = useState<"SEARCHES" | "AUTONOMOUS_RUNS">("SEARCHES");
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [discoveryRuns, setDiscoveryRuns] = useState<DiscoveryRunHistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
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

  const fetchDiscoveryRuns = async () => {
    try {
      setIsLoadingRuns(true);
      const res = await fetch("/api/discovery/runs");
      if (res.ok) {
        const data = await res.json();
        if (data.runs) setDiscoveryRuns(data.runs);
      }
    } catch {
      // Non-fatal
    } finally {
      setIsLoadingRuns(false);
    }
  };

  useEffect(() => {
    fetchSearchHistory();
    fetchDiscoveryRuns();
  }, []);

  const handleInspectSession = async (sessionId: string) => {
    try {
      setIsLoadingSession(true);
      const res = await fetch(`/api/search/history/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setViewingSession(data.search || data);
      } else {
        toast.error("Failed to load historical session details");
      }
    } catch {
      toast.error("Session inspection error");
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/search/history/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSearchHistory((prev) => prev.filter((item) => item.id !== sessionId));
        toast.success("Search session removed from history");
        if (viewingSession?.id === sessionId) {
          setViewingSession(null);
        }
      } else {
        toast.error("Failed to delete search session");
      }
    } catch {
      toast.error("Error deleting session");
    }
  };

  const handleDeleteRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/discovery/runs/${runId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDiscoveryRuns((prev) => prev.filter((r) => r.id !== runId));
        toast.success("Discovery run removed from history");
        if (viewingSession?.id === runId) {
          setViewingSession(null);
        }
      } else {
        toast.error("Failed to delete discovery run");
      }
    } catch {
      toast.error("Error deleting discovery run");
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
    <div className="flex-1 flex flex-col antialiased selection:bg-emerald-500/20 selection:text-emerald-600">
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 pb-32 sm:px-6 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <History className="h-4 w-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-sans font-bold tracking-tight text-foreground">
                Search History
              </h1>
              <Badge variant="secondary" className="font-mono text-xs">
                {searchHistory.length} Sessions
              </Badge>
              <InfoBadge
                title="Search History Persistence"
                description="Past discovery queries and candidate pools are permanently persisted in PostgreSQL."
                details={{
                  "Storage Engine": "Supabase PostgreSQL (`SearchQuery` table)",
                  "Data Preserved": "Query string, parsed role/skills/location, match scores, full job listings",
                  "Replay Mode": "Instant client-side replay without re-scraping or token expenditure",
                  "Retention": "Retained indefinitely until explicitly deleted by the user",
                }}
                bullets={[
                  "Review past results anytime after logging out and returning",
                  "Click any session to inspect candidate details, claims, and verified citations",
                  "Export or delete individual search records on demand",
                ]}
                side="bottom"
              />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              <span className="hidden sm:inline">
                Review previous natural-language discovery sessions, replay queries, and inspect past candidate pools.
              </span>
              <span className="sm:hidden">
                Past searches and candidate pools.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/app">
              <Button size="sm" className="h-8 font-sans font-medium text-xs gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-xs">
                <Plus className="h-3.5 w-3.5" />
                Start New Discovery
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Switcher: Interactive Searches vs Autonomous Radar Scans */}
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("SEARCHES")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-sans font-medium transition-all cursor-pointer ${
              activeTab === "SEARCHES"
                ? "bg-primary text-primary-foreground shadow-marble-1 font-semibold"
                : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search Sessions</span>
            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-4">
              {searchHistory.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("AUTONOMOUS_RUNS")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-sans font-medium transition-all cursor-pointer ${
              activeTab === "AUTONOMOUS_RUNS"
                ? "bg-primary text-primary-foreground shadow-marble-1 font-semibold"
                : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Autonomous Radar Scans</span>
            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-4">
              {discoveryRuns.length}
            </Badge>
          </button>
        </div>

        {/* TAB 1: Search Sessions */}
        {activeTab === "SEARCHES" && (
          <div className="space-y-6">
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
                    className="rounded-2xl border border-border bg-card p-4 sm:p-5 hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-marble-1 hover:shadow-marble-2"
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
                        {Array.isArray(item.parsedSkills) && item.parsedSkills.length > 0 && (
                          <span>Skills: {item.parsedSkills.slice(0, 3).join(", ")}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInspectSession(item.id)}
                        className="h-8 font-mono text-xs gap-1.5 border-border/70 hover:bg-muted/40 cursor-pointer rounded-lg"
                      >
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        Review
                      </Button>

                      <Link href={`/app?q=${encodeURIComponent(item.rawQuery)}`}>
                        <Button
                          size="sm"
                          className="h-8 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer rounded-lg shadow-marble-1"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                          Re-run
                        </Button>
                      </Link>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSession(item.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer rounded-lg"
                        title="Delete session"
                        aria-label="Delete session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
                  <Button size="sm" className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer rounded-lg shadow-marble-1">
                    <Compass className="h-3.5 w-3.5" />
                    Start Opportunity Discovery
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Autonomous Radar Scans */}
        {activeTab === "AUTONOMOUS_RUNS" && (
          <div className="space-y-6">
            {isLoadingRuns ? (
              <div className="py-16 text-center space-y-3">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs font-mono text-muted-foreground">Loading autonomous radar history...</p>
              </div>
            ) : discoveryRuns.length > 0 ? (
              <div className="space-y-3 max-w-5xl">
                {discoveryRuns.map((run) => (
                  <div
                    key={run.id}
                    className="rounded-2xl border border-border bg-card p-4 sm:p-5 hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-marble-1 hover:shadow-marble-2"
                  >
                    <div className="space-y-2 max-w-2xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20">
                          {run.triggerType === "SCHEDULED" ? "SCHEDULED WATCH" : "ON-DEMAND SCAN"}
                        </Badge>
                        <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(run.startedAt).toLocaleString()}
                        </span>
                        {run.durationMs && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            ({(run.durationMs / 1000).toFixed(1)}s)
                          </span>
                        )}
                        <Badge
                          variant="secondary"
                          className={`font-mono text-[10px] ${
                            run.status === "SUCCESS"
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : run.status === "RUNNING"
                              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              : "bg-muted"
                          }`}
                        >
                          {run.status}
                        </Badge>
                      </div>

                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span>Autonomous Radar Scan</span>
                        <span className="text-xs font-mono text-muted-foreground font-normal">
                          #{run.id.slice(-6)}
                        </span>
                      </h3>

                      {/* Telemetry Stats */}
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground pt-1">
                        <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/60">
                          Connectors: {run.providersSucceeded}/{run.providersAttempted || run.providersSucceeded}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/60">
                          Evaluated: {run.candidatesFound}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold">
                          {run.newOpportunities || run.results.length} Discovered
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {run.results && run.results.length > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setViewingSession({
                              id: run.id,
                              rawQuery: `Autonomous Radar Scan (${run.triggerType === "SCHEDULED" ? "Scheduled Watch" : "Manual Trigger"})`,
                              intentType: "AUTONOMOUS_RADAR",
                              status: run.status,
                              createdAt: run.startedAt,
                              totalFound: run.results.length,
                              results: run.results,
                            })
                          }
                          className="h-8 font-sans font-medium text-xs gap-1.5 border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30 cursor-pointer rounded-lg shadow-marble-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Review Discovered Roles ({run.results.length})</span>
                        </Button>
                      ) : (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          0 novel roles
                        </span>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRun(run.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                        title="Delete run from history"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center space-y-3 bg-muted/20 rounded-2xl border border-dashed border-border/80">
                <Radio className="h-8 w-8 text-muted-foreground mx-auto" />
                <h3 className="text-sm font-semibold text-foreground">No Autonomous Radar scans yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Scans triggered automatically or via &ldquo;Scan Now&rdquo; in Autonomous Radar will record telemetry and discovered opportunities here.
                </p>
                <Link href="/app/watch">
                  <Button size="sm" className="h-8 font-sans text-xs gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer mt-2">
                    Go to Autonomous Radar
                  </Button>
                </Link>
              </div>
            )}
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
                      Session #{viewingSession.id ? viewingSession.id.slice(-6) : "ARCHIVE"}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">
                      {new Date(viewingSession.createdAt || Date.now()).toLocaleString()}
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
