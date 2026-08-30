"use client";

import { useState, useEffect } from "react";
import { 
  Eye, 
  Search, 
  RotateCw, 
  Building2, 
  Briefcase, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  PauseCircle, 
  Filter,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface AdminWatchItem {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
    role?: string;
  };
  enabled: boolean;
  roles: string[];
  skills: string[];
  locations: string[];
  companies: string[];
  workModes: string[];
  experienceLevels: string[];
  opportunityTypes: string[];
  preferredSources: string[];
  minimumMatchScore: number;
  scanIntervalHours: number;
  lastScannedAt?: string | null;
  nextScanAt?: string | null;
  updatedAt: string;
}

export default function AdminWatchesPage() {
  const [watches, setWatches] = useState<AdminWatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchWatches = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
      });
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const res = await fetch(`/api/admin/watches?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load watches (HTTP ${res.status})`);
      }
      const data = await res.json();
      setWatches(data.watches || []);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.total || 0);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load discovery watches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatches();
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchWatches();
  };

  // Client-side company filtering if selected
  const filteredWatches = watches.filter((w) => {
    if (companyFilter === "TARGETED") return w.companies.length > 0;
    if (companyFilter === "GENERIC") return w.companies.length === 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Eye className="h-6 w-6 text-emerald-400" />
            Discovery Watches & Company Targets
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            Audit user-configured swarm search parameters, target companies, and intervals
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchWatches}
          disabled={loading}
          className="font-mono text-xs gap-1.5 border-border/80 hover:border-emerald-500/40"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card/60 p-3.5 rounded-xl border border-border/70">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by user email, role, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-mono rounded-lg border border-border bg-muted/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <Button type="submit" size="sm" variant="outline" className="font-mono text-xs">
            Search
          </Button>
        </form>

        {/* Company Target Mode Filter */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-muted-foreground text-[11px]">Filter:</span>
          <Button
            size="sm"
            variant={companyFilter === "ALL" ? "secondary" : "ghost"}
            onClick={() => setCompanyFilter("ALL")}
            className="text-xs h-7 px-2.5"
          >
            All ({watches.length})
          </Button>
          <Button
            size="sm"
            variant={companyFilter === "TARGETED" ? "secondary" : "ghost"}
            onClick={() => setCompanyFilter("TARGETED")}
            className="text-xs h-7 px-2.5 text-purple-400"
          >
            Targeted Only ({watches.filter((w) => w.companies.length > 0).length})
          </Button>
          <Button
            size="sm"
            variant={companyFilter === "GENERIC" ? "secondary" : "ghost"}
            onClick={() => setCompanyFilter("GENERIC")}
            className="text-xs h-7 px-2.5"
          >
            Generic ({watches.filter((w) => w.companies.length === 0).length})
          </Button>
        </div>
      </div>

      {/* Watches Table */}
      <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground font-mono text-sm flex items-center justify-center gap-2">
            <RotateCw className="h-4 w-4 animate-spin text-emerald-400" />
            Loading watches...
          </div>
        ) : filteredWatches.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground font-mono text-sm">
            No discovery watches found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-muted/40 border-b border-border/70 text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">User / Tenant</th>
                  <th className="py-3 px-4">Target Companies</th>
                  <th className="py-3 px-4">Roles & Skills</th>
                  <th className="py-3 px-4">Location & Modes</th>
                  <th className="py-3 px-4">Interval</th>
                  <th className="py-3 px-4">Min Fit</th>
                  <th className="py-3 px-4">Next Scan</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredWatches.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/20 transition-colors">
                    {/* User */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{w.user.email}</div>
                      {w.user.name && (
                        <span className="text-[11px] text-muted-foreground">{w.user.name}</span>
                      )}
                    </td>

                    {/* Company Targets */}
                    <td className="py-3 px-4">
                      {w.companies && w.companies.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {w.companies.map((c, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[10px] bg-purple-500/10 text-purple-300 border-purple-500/30 flex items-center gap-1 font-semibold"
                            >
                              <Building2 className="h-2.5 w-2.5 text-purple-400" />
                              {c}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-[11px]">All Companies</span>
                      )}
                    </td>

                    {/* Roles & Skills */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-foreground truncate">
                        {w.roles.length > 0 ? w.roles.join(", ") : "All Software Roles"}
                      </div>
                      {w.skills.length > 0 && (
                        <div className="text-[11px] text-muted-foreground truncate">
                          Skills: {w.skills.join(", ")}
                        </div>
                      )}
                    </td>

                    {/* Locations & Work Modes */}
                    <td className="py-3 px-4">
                      <div className="text-foreground">
                        {w.locations.length > 0 ? w.locations.join(", ") : "Any Location"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {w.workModes.join(", ")}
                      </div>
                    </td>

                    {/* Interval */}
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="font-mono text-[11px] border-emerald-500/30 text-emerald-400">
                        {w.scanIntervalHours}h
                      </Badge>
                    </td>

                    {/* Minimum Match Score */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-foreground">{w.minimumMatchScore} pts</span>
                    </td>

                    {/* Next Scan */}
                    <td className="py-3 px-4 text-[11px] text-muted-foreground">
                      {w.nextScanAt ? (
                        <div>
                          <span>{new Date(w.nextScanAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="block text-[10px]">{new Date(w.nextScanAt).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-right">
                      {w.enabled ? (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
                          ACTIVE
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground text-[10px]">
                          PAUSED
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-3 border-t border-border/70 bg-muted/20 flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>Total Watches: {totalCount}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2 font-mono text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 px-2 font-mono text-xs"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
