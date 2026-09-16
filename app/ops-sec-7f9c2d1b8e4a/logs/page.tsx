"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Activity, 
  Terminal, 
  RefreshCw, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Play, 
  Pause, 
  ChevronRight, 
  Clock, 
  Cpu, 
  ShieldCheck, 
  Users, 
  Copy, 
  Check, 
  X,
  ExternalLink,
  Code
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { InfoBadge } from "@/components/ui/info-badge";
import { AdminPasswordModal } from "@/components/admin/admin-password-modal";
import { ADMIN_API_ROUTES } from "@/lib/admin/adminRoutes";
import { toast } from "sonner";

interface AuditLogItem {
  id: string;
  timestamp: string;
  actor: "USER" | "SYSTEM" | "WORKER" | "ADMIN";
  actionType: string;
  target: string;
  path: string;
  userId?: string | null;
  userEmail?: string | null;
  details?: Record<string, any>;
  ip?: string | null;
  userAgent?: string | null;
}

interface AuditStats {
  totalEvents: number;
  eventsPerMinute: number;
  actorBreakdown: {
    user: number;
    system: number;
    worker: number;
    admin: number;
  };
  actionBreakdown: Record<string, number>;
  activityTimeline: Array<{
    minute: string;
    count: number;
  }>;
}

export default function UniversalAuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Filter States
  const [actorFilter, setActorFilter] = useState<string>("ALL");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [pollInterval, setPollInterval] = useState<number>(5000); // 5s default
  const [isPaused, setIsPaused] = useState(false);

  // Prune Modal
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const fetchLogs = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (actorFilter !== "ALL") params.set("actor", actorFilter);
      if (actionFilter !== "ALL") params.set("actionType", actionFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("limit", "100");

      const res = await fetch(`${ADMIN_API_ROUTES.LOGS}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err: any) {
      if (!quiet) toast.error(`Failed to refresh audit logs: ${err.message}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [actorFilter, actionFilter, searchQuery]);

  // Initial load & Polling loop
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (isPaused || pollInterval <= 0) return;
    const interval = setInterval(() => {
      fetchLogs(true);
    }, pollInterval);
    return () => clearInterval(interval);
  }, [fetchLogs, isPaused, pollInterval]);

  // Execute purge
  const handlePurgeLogs = async (password: string) => {
    try {
      const res = await fetch(ADMIN_API_ROUTES.LOGS, {
        method: "DELETE",
        headers: {
          "x-admin-key": password,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to prune logs");
      }

      toast.success("Universal audit logs pruned and baseline reseeded.");
      fetchLogs();
    } catch (err: any) {
      toast.error(err.message || "Verification failed.");
      throw err;
    }
  };

  // Export logs to JSON
  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `browserpilot_audit_logs_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${logs.length} audit records.`);
  };

  const handleCopyPayload = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast.success("Payload copied to clipboard.");
  };

  // Actor badge styling
  const getActorBadge = (actor: string) => {
    switch (actor) {
      case "USER":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-mono">USER</Badge>;
      case "SYSTEM":
        return <Badge className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30 text-[10px] font-mono">SYSTEM</Badge>;
      case "WORKER":
        return <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30 text-[10px] font-mono">WORKER</Badge>;
      case "ADMIN":
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-mono">ADMIN</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] font-mono">{actor}</Badge>;
    }
  };

  // Max count for sparkline scaling
  const maxTimelineCount = useMemo(() => {
    if (!stats?.activityTimeline?.length) return 1;
    return Math.max(...stats.activityTimeline.map(t => t.count), 1);
  }, [stats]);

  return (
    <div className="flex-1 space-y-6 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Terminal className="h-4 w-4" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-sans font-bold tracking-tight text-foreground">
              Universal System & Interaction Audit Log
            </h1>
            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10">
              REAL-TIME
            </Badge>
            <InfoBadge
              title="Universal Audit Observatory"
              description="Complete telemetry stream recording every user click, navigation route, search execution, background task, and worker queue tick."
              details={{
                "Ingestion Engine": "UniversalAuditLogger (Ring-Buffer + Beacon Sync)",
                "Capacity": "3,000 in-memory entries with zero latency degradation",
                "Actors Tracked": "USER (clicks/navigation), SYSTEM (orchestration), WORKER (scrapers/cron), ADMIN (security operations)",
                "Compliance": "GDPR, CCPA, and SOC 2 Type II audit trail readiness",
              }}
              bullets={[
                "Sub-millisecond write performance without blocking user interaction threads",
                "Client-side beaconing automatically captures interactive button taps and route transitions",
                "Administrative purge operations strictly require timing-safe password verification",
              ]}
              side="bottom"
            />
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            Granular event registry for forensic tracking, user journey debugging, and worker observability.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Pause / Resume */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="h-8 text-xs font-mono gap-1.5"
          >
            {isPaused ? <Play className="h-3.5 w-3.5 text-emerald-600" /> : <Pause className="h-3.5 w-3.5 text-amber-500" />}
            {isPaused ? "Resume Feed" : "Pause"}
          </Button>

          {/* Manual Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs()}
            disabled={isRefreshing}
            className="h-8 text-xs font-mono gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
            Refresh
          </Button>

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            disabled={logs.length === 0}
            className="h-8 text-xs font-mono gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </Button>

          {/* Prune Logs */}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsPurgeModalOpen(true)}
            className="h-8 text-xs font-mono gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Prune Buffer
          </Button>
        </div>
      </div>

      {/* Real-time Telemetry Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card className="p-3.5 border-border/70 bg-card">
            <span className="text-[11px] font-mono text-muted-foreground uppercase block">Total Recorded</span>
            <div className="text-xl font-bold font-mono text-foreground mt-0.5">{stats.totalEvents.toLocaleString()}</div>
            <span className="text-[10px] font-mono text-muted-foreground">Ring buffer limit: 3,000</span>
          </Card>

          <Card className="p-3.5 border-border/70 bg-card">
            <span className="text-[11px] font-mono text-muted-foreground uppercase block">Velocity</span>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1.5">
              {stats.eventsPerMinute}
              <span className="text-xs font-normal text-muted-foreground">evt / min</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">Live rolling rate</span>
          </Card>

          <Card className="p-3.5 border-border/70 bg-card">
            <span className="text-[11px] font-mono text-muted-foreground uppercase block">User Interactivity</span>
            <div className="text-xl font-bold font-mono text-foreground mt-0.5">{stats.actorBreakdown.user}</div>
            <span className="text-[10px] font-mono text-muted-foreground">Clicks & navigation</span>
          </Card>

          <Card className="p-3.5 border-border/70 bg-card">
            <span className="text-[11px] font-mono text-muted-foreground uppercase block">Workers & Tasks</span>
            <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">{stats.actorBreakdown.worker}</div>
            <span className="text-[10px] font-mono text-muted-foreground">Scrapers & queues</span>
          </Card>

          <Card className="p-3.5 border-border/70 bg-card col-span-2 lg:col-span-1">
            <span className="text-[11px] font-mono text-muted-foreground uppercase block">System & Security</span>
            <div className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400 mt-0.5">
              {stats.actorBreakdown.system + stats.actorBreakdown.admin}
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">Pipelines & admin sessions</span>
          </Card>
        </div>
      )}

      {/* Activity Density Sparkline */}
      {stats?.activityTimeline && stats.activityTimeline.length > 0 && (
        <Card className="p-4 border-border/70 bg-card/60 backdrop-blur-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-mono font-medium text-foreground">Interaction & Task Velocity (Last 15 Minutes)</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              Max peak: {maxTimelineCount} events/min
            </span>
          </div>

          <div className="h-14 flex items-end gap-1.5 pt-2">
            {stats.activityTimeline.map((item, idx) => {
              const heightPercent = Math.max(8, Math.round((item.count / maxTimelineCount) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full rounded-t-xs bg-emerald-500/40 group-hover:bg-emerald-500 transition-colors"
                  />
                  <span className="text-[9px] font-mono text-muted-foreground opacity-60 hidden sm:block">
                    {item.minute.slice(-2)}
                  </span>
                  {/* Tooltip on hover */}
                  <div className="absolute -top-7 px-1.5 py-0.5 rounded bg-popover text-[9px] font-mono text-popover-foreground shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20">
                    {item.minute}: {item.count} events
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl border border-border/70 bg-card">
        {/* Actor Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-mono text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Actor:
          </span>
          {["ALL", "USER", "SYSTEM", "WORKER", "ADMIN"].map((actor) => (
            <button
              key={actor}
              onClick={() => setActorFilter(actor)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                actorFilter === actor
                  ? "bg-emerald-600 text-white font-semibold shadow-xs"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {actor}
            </button>
          ))}
        </div>

        {/* Action Type Filter + Search */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-9 px-2.5 text-xs font-mono rounded-lg border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Actions</option>
            <option value="CLICK">CLICK</option>
            <option value="NAVIGATE">NAVIGATE</option>
            <option value="SEARCH">SEARCH</option>
            <option value="DISCOVER">DISCOVER</option>
            <option value="SAVE">SAVE</option>
            <option value="EXPORT">EXPORT</option>
            <option value="WORKER_TICK">WORKER_TICK</option>
            <option value="AUTH">AUTH</option>
            <option value="CONFIG_CHANGE">CONFIG_CHANGE</option>
          </select>

          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search target, path, user..."
              className="w-full h-9 pl-8 pr-3 text-xs font-mono rounded-lg border border-border/70 bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Main Audit Log Table */}
      <Card className="border-border/70 overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground">
                <th className="p-3 font-semibold text-[11px] w-28">TIMESTAMP</th>
                <th className="p-3 font-semibold text-[11px] w-24">ACTOR</th>
                <th className="p-3 font-semibold text-[11px] w-28">ACTION</th>
                <th className="p-3 font-semibold text-[11px]">TARGET / INTERACTION</th>
                <th className="p-3 font-semibold text-[11px] hidden md:table-cell w-36">ROUTE / PATH</th>
                <th className="p-3 font-semibold text-[11px] hidden lg:table-cell w-36">USER CONTEXT</th>
                <th className="p-3 font-semibold text-[11px] text-right w-16">PAYLOAD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-600" />
                    Connecting to real-time audit feed...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const date = new Date(log.timestamp);
                  const timeFormatted = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}.${date.getMilliseconds().toString().padStart(3, "0")}`;
                  
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`hover:bg-muted/40 transition-colors cursor-pointer ${
                        selectedLog?.id === log.id ? "bg-emerald-500/10 dark:bg-emerald-950/30" : ""
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="p-3 text-muted-foreground whitespace-nowrap text-[11px]">
                        {timeFormatted}
                      </td>

                      {/* Actor */}
                      <td className="p-3 whitespace-nowrap">
                        {getActorBadge(log.actor)}
                      </td>

                      {/* Action Type */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-semibold text-foreground text-[11px]">
                          {log.actionType}
                        </span>
                      </td>

                      {/* Target */}
                      <td className="p-3">
                        <span className="text-foreground line-clamp-1">
                          {log.target}
                        </span>
                      </td>

                      {/* Path */}
                      <td className="p-3 hidden md:table-cell text-muted-foreground whitespace-nowrap text-[11px]">
                        <span className="truncate max-w-[140px] block">{log.path}</span>
                      </td>

                      {/* User Context */}
                      <td className="p-3 hidden lg:table-cell text-muted-foreground text-[11px]">
                        {log.userEmail ? (
                          <span className="text-emerald-700 dark:text-emerald-400 truncate max-w-[130px] block">
                            {log.userEmail.split("@")[0]}
                          </span>
                        ) : log.userId ? (
                          <span className="truncate max-w-[130px] block">{log.userId}</span>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </td>

                      {/* Inspector Button */}
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="h-7 w-7 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Event Details Drawer / Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-xl h-full max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-border/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-emerald-600" />
                <h3 className="font-sans font-bold text-sm text-foreground">
                  Audit Record Telemetry Inspector
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLog(null)}
                className="h-8 w-8 p-0 cursor-pointer text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 font-mono text-xs">
              {/* Event Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/30 border border-border/60">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Event ID</span>
                  <span className="font-bold text-foreground">{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Timestamp</span>
                  <span className="text-foreground">{selectedLog.timestamp}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Actor</span>
                  <div className="mt-0.5">{getActorBadge(selectedLog.actor)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Action Type</span>
                  <span className="font-bold text-foreground">{selectedLog.actionType}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-muted-foreground uppercase block">Target Element / Interaction</span>
                  <span className="text-foreground break-all">{selectedLog.target}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-muted-foreground uppercase block">Path / Route</span>
                  <span className="text-foreground">{selectedLog.path}</span>
                </div>
                {selectedLog.userEmail && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-muted-foreground uppercase block">User Identifier</span>
                    <span className="text-emerald-700 dark:text-emerald-400">{selectedLog.userEmail}</span>
                  </div>
                )}
                {selectedLog.ip && (
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase block">Client IP</span>
                    <span className="text-foreground">{selectedLog.ip}</span>
                  </div>
                )}
                {selectedLog.userAgent && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-muted-foreground uppercase block">User Agent</span>
                    <span className="text-[10px] text-muted-foreground break-all">{selectedLog.userAgent}</span>
                  </div>
                )}
              </div>

              {/* JSON Payload Inspector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground uppercase">
                    Raw Payload Details
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyPayload(selectedLog.details || {})}
                    className="h-7 text-[10px] font-mono gap-1"
                  >
                    {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {isCopied ? "Copied" : "Copy JSON"}
                  </Button>
                </div>
                <pre className="p-3.5 rounded-xl bg-slate-950 text-emerald-400 border border-border/80 overflow-x-auto text-[11px] leading-relaxed max-h-64">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-3.5 border-t border-border/80 flex items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLog(null)}
                className="font-mono text-xs cursor-pointer"
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Password Confirmation Gate for Pruning Logs */}
      <AdminPasswordModal
        isOpen={isPurgeModalOpen}
        onClose={() => setIsPurgeModalOpen(false)}
        onConfirm={handlePurgeLogs}
        actionTitle="Prune Universal Audit Buffer"
        actionDescription="This will immediately wipe all in-memory audit logs and re-seed the initial telemetry baseline. This action cannot be undone."
        expectedConfirmationPhrase="CONFIRM PRUNE"
        affectedCount={logs.length}
        affectedItemType="audit records"
        isDestructive={true}
      />
    </div>
  );
}
