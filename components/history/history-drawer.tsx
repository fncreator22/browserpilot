"use client";

import { useState, useEffect } from "react";
import { 
  History, 
  Search, 
  Clock, 
  ChevronRight, 
  Sparkles, 
  Zap, 
  ExternalLink,
  X,
  Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface HistoryJob {
  id: string;
  prompt: string;
  status: string;
  summary?: string;
  tokensUsed?: number;
  totalDurationMs?: number;
  createdAt: string;
}

export function HistoryDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<HistoryJob[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/jobs/history?limit=25&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.history) {
        setHistory(data.history);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, searchQuery]);

  return (
    <>
      {/* Trigger Button in Navbar / Header */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="font-mono text-xs gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <History className="h-3.5 w-3.5" />
        <span>Search History</span>
      </Button>

      {/* Slide-over Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-card border-l border-border/80 shadow-2xl flex flex-col">
              {/* Drawer Header */}
              <div className="p-4 border-b border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm text-foreground">Workspace Search History</h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Search Filter Bar */}
              <div className="p-3 border-b border-border/40 bg-muted/20">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search past extractions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* History Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoading && history.length === 0 ? (
                  <div className="text-center py-10 text-xs text-muted-foreground font-mono">
                    Loading search records...
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-10 space-y-2 text-muted-foreground text-xs">
                    <p>No past search records found.</p>
                    <p className="text-[11px]">Searches you run will appear here for 1-click token-free replay.</p>
                  </div>
                ) : (
                  history.map((job) => (
                    <Link
                      key={job.id}
                      href={`/app/jobs/${job.id}`}
                      onClick={() => setIsOpen(false)}
                      className="block p-3 rounded-xl border border-border/60 bg-muted/20 hover:border-primary/60 hover:bg-muted/40 transition-all space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                          {job.prompt}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono shrink-0 ${
                            job.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          }`}
                        >
                          {job.status}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/30">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(job.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1 text-primary">
                          Re-open <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
