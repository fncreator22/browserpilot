"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  History, 
  Search, 
  Clock, 
  ArrowUpRight, 
  ExternalLink, 
  Trash2, 
  Bookmark, 
  Filter, 
  Sparkles, 
  Database,
  ArrowLeft,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

interface HistoryJob {
  id: string;
  prompt: string;
  status: string;
  summary?: string;
  tokensUsed?: number;
  totalDurationMs?: number;
  createdAt: string;
  completedAt?: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryJob[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/jobs/history?limit=50&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.history) {
        setHistory(data.history);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [searchQuery]);

  const filteredHistory = history.filter((job) => {
    if (statusFilter === "ALL") return true;
    return job.status === statusFilter;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-8">
        {/* Header Navigation & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link href="/app">
                <Button variant="ghost" size="sm" className="h-8 px-2 font-mono text-xs gap-1 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Workspace
                </Button>
              </Link>
              <span className="text-muted-foreground/60">/</span>
              <span className="text-xs font-mono font-medium text-foreground">Search History</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Database className="h-6 w-6 text-primary" />
              Workspace Search & Extraction History
            </h1>
            <p className="text-xs text-muted-foreground">
              Review and instantly replay past autonomous web extractions with zero additional token consumption.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/app">
              <Button size="sm" className="font-mono text-xs gap-1.5 shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
                New Extraction
              </Button>
            </Link>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border/80 shadow-xs">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by keyword, role, or website..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" /> Status:
            </span>
            <div className="flex items-center gap-1">
              {["ALL", "COMPLETED", "FAILED"].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className="h-7 text-xs font-mono px-2.5"
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* History Records Grid */}
        {isLoading && history.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-mono text-muted-foreground">Loading workspace records...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-20 text-center space-y-4 rounded-2xl border border-dashed border-border p-8 bg-card/40">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <History className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">No search history records found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery
                  ? "No searches matched your keyword filter. Try adjusting your query."
                  : "Searches and extractions you run from the workspace will be archived here for instant 1-click token-free access."}
              </p>
            </div>
            <Link href="/app">
              <Button size="sm" variant="outline" className="font-mono text-xs">
                Launch an Extraction
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredHistory.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-border/80 bg-card p-5 hover:border-primary/60 transition-all shadow-xs space-y-3 group"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono px-2 py-0.5 ${
                          job.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        }`}
                      >
                        {job.status === "COMPLETED" ? (
                          <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                        ) : (
                          <AlertCircle className="h-3 w-3 mr-1 inline" />
                        )}
                        {job.status}
                      </Badge>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        ID: {job.id.slice(0, 16)}...
                      </span>
                    </div>

                    <h2 className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors">
                      {job.prompt}
                    </h2>

                    {job.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {job.summary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/app/jobs/${job.id}`}>
                      <Button size="sm" className="h-8 font-mono text-xs gap-1">
                        View Result
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 text-[11px] font-mono text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                      {new Date(job.createdAt).toLocaleString()}
                    </span>
                    {job.totalDurationMs && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                        {Math.round((job.totalDurationMs / 1000) * 10) / 10}s runtime
                      </span>
                    )}
                    {job.tokensUsed !== undefined && (
                      <span className="flex items-center gap-1.5 text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                        {job.tokensUsed} tokens
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-emerald-500/80 bg-emerald-500/10 px-2 py-0.5 rounded font-mono">
                    Token-Free Replay Ready
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
