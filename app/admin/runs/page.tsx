"use client";

import { useState, useEffect } from "react";
import { 
  Layers, 
  Search, 
  RotateCw, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Zap,
  ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface AdminRunItem {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
  triggerType: "SCHEDULED" | "MANUAL";
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  candidatesFound: number;
  newOpportunities: number;
  newSources: number;
  alreadyKnown: number;
  reposted: number;
  notificationsCreated: number;
  notificationsDeduplicated: number;
  providersAttempted?: string | null;
  providersFailed?: string | null;
  errorMessage?: string | null;
}

export default function AdminRunsPage() {
  const [runs, setRuns] = useState<AdminRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
      });
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }

      const res = await fetch(`/api/admin/runs?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load discovery runs (HTTP ${res.status})`);
      }
      const data = await res.json();
      setRuns(data.runs || []);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.total || 0);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load discovery runs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [page, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-6 w-6 text-amber-400" />
            Discovery Run Telemetry & Execution Log
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            Full telemetry audit of autonomous discovery cycles, deduplication, and notifications
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchRuns}
          disabled={loading}
          className="font-mono text-xs gap-1.5 border-border/80 hover:border-amber-500/40"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-amber-400" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-card/60 p-2.5 rounded-xl border border-border/70 font-mono text-xs overflow-x-auto">
        <span className="text-muted-foreground text-[11px] pl-1">Status:</span>
        <Button
          size="sm"
          variant={statusFilter === "ALL" ? "secondary" : "ghost"}
          onClick={() => { setStatusFilter("ALL"); setPage(1); }}
          className="text-xs h-7 px-3"
        >
          All Runs
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "SUCCESS" ? "secondary" : "ghost"}
          onClick={() => { setStatusFilter("SUCCESS"); setPage(1); }}
          className="text-xs h-7 px-3 text-emerald-400"
        >
          Success
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "PARTIAL_SUCCESS" ? "secondary" : "ghost"}
          onClick={() => { setStatusFilter("PARTIAL_SUCCESS"); setPage(1); }}
          className="text-xs h-7 px-3 text-amber-400"
        >
          Partial
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "FAILED" ? "secondary" : "ghost"}
          onClick={() => { setStatusFilter("FAILED"); setPage(1); }}
          className="text-xs h-7 px-3 text-rose-400"
        >
          Failed
        </Button>
      </div>

      {/* Runs Table */}
      <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground font-mono text-sm flex items-center justify-center gap-2">
            <RotateCw className="h-4 w-4 animate-spin text-amber-400" />
            Loading execution runs...
          </div>
        ) : runs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground font-mono text-sm">
            No discovery runs found for the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-muted/40 border-b border-border/70 text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Run ID / User</th>
                  <th className="py-3 px-4">Trigger</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Harvested</th>
                  <th className="py-3 px-4">Novelty (New / Sources / Reposts)</th>
                  <th className="py-3 px-4">Alerts Created</th>
                  <th className="py-3 px-4">Started At</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    {/* Run ID & User */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{r.user.email}</div>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[140px] block">
                        {r.id}
                      </span>
                    </td>

                    {/* Trigger Type */}
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {r.triggerType}
                      </Badge>
                    </td>

                    {/* Duration */}
                    <td className="py-3 px-4">
                      <span className="text-foreground">{r.durationMs ? `${r.durationMs}ms` : "—"}</span>
                    </td>

                    {/* Harvested */}
                    <td className="py-3 px-4 font-bold text-foreground">
                      {r.candidatesFound}
                    </td>

                    {/* Novelty Breakdown */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                          +{r.newOpportunities} opps
                        </Badge>
                        <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                          +{r.newSources} src
                        </Badge>
                        {r.reposted > 0 && (
                          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
                            {r.reposted} rep
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Alerts Created */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-foreground">{r.notificationsCreated}</span>
                        {r.notificationsDeduplicated > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            ({r.notificationsDeduplicated} deduped)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Started At */}
                    <td className="py-3 px-4 text-[11px] text-muted-foreground">
                      <div>
                        <span>{new Date(r.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span className="block text-[10px]">{new Date(r.startedAt).toLocaleDateString()}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-right">
                      {r.status === "SUCCESS" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
                          SUCCESS
                        </Badge>
                      ) : r.status === "PARTIAL_SUCCESS" ? (
                        <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px]">
                          PARTIAL
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px]">
                          FAILED
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
          <span>Total Runs: {totalCount}</span>
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
