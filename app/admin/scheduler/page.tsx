"use client";

import { useState, useEffect } from "react";
import { 
  Clock, 
  RotateCw, 
  Play, 
  ShieldCheck, 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Unlock, 
  Zap, 
  Server,
  Layers,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface SchedulerState {
  status: string;
  timestamp: string;
  counts: {
    totalWatches: number;
    activeWatches: number;
    dueForExecution: number;
    currentlyLocked: number;
  };
  activeWorkerClaims: Array<{
    id: string;
    userId: string;
    lockedAt: string;
    lockOwner: string;
    nextScanAt: string;
  }>;
}

export default function AdminSchedulerPage() {
  const [state, setState] = useState<SchedulerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [lastTriggerResult, setLastTriggerResult] = useState<any>(null);

  const fetchSchedulerState = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await fetch("/api/admin/scheduler");
      if (!res.ok) {
        throw new Error(`Failed to load scheduler state (HTTP ${res.status})`);
      }
      const data = await res.json();
      setState(data);
      if (isManual) toast.success("Scheduler state refreshed");
    } catch (err: any) {
      toast.error(err.message || "Failed to load scheduler status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedulerState();
    const interval = setInterval(() => fetchSchedulerState(), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleManualTrigger = async () => {
    setTriggering(true);
    setLastTriggerResult(null);
    try {
      const res = await fetch("/api/discovery/scheduler", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxWatches: 10,
          concurrencyLimit: 2,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Scheduler execution failed (HTTP ${res.status})`);
      }

      setLastTriggerResult(data.telemetry);
      toast.success(`Cycle executed: ${data.telemetry?.totalWatchesProcessed || 0} watches processed!`);
      // Refresh state immediately after run
      fetchSchedulerState();
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger scheduler");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Clock className="h-6 w-6 text-purple-400" />
            Autonomous Scheduler & Worker Control Plane
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            Inspect distributed leases, lock ownership, queue states, and trigger manual discovery cycles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSchedulerState(true)}
            disabled={loading}
            className="font-mono text-xs gap-1.5 border-border/80 hover:border-purple-500/40"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-purple-400" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleManualTrigger}
            disabled={triggering}
            className="font-mono text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-md"
          >
            <Play className={`h-3.5 w-3.5 ${triggering ? "animate-spin" : ""}`} />
            {triggering ? "Executing Cycle..." : "Trigger Discovery Cycle Now"}
          </Button>
        </div>
      </div>

      {/* Scheduler Queue Status Cards */}
      {state && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-1.5 shadow-sm">
            <span className="text-xs font-mono text-muted-foreground">TOTAL WATCHES</span>
            <p className="text-2xl font-bold font-mono text-foreground">{state.counts.totalWatches}</p>
            <span className="text-[11px] text-muted-foreground font-mono">
              {state.counts.activeWatches} active in rotation
            </span>
          </div>

          <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-1.5 shadow-sm">
            <span className="text-xs font-mono text-muted-foreground">DUE FOR EXECUTION</span>
            <p className="text-2xl font-bold font-mono text-amber-400">{state.counts.dueForExecution}</p>
            <span className="text-[11px] text-muted-foreground font-mono">
              Ready for immediate scanning
            </span>
          </div>

          <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-1.5 shadow-sm">
            <span className="text-xs font-mono text-muted-foreground">ACTIVE WORKER LEASES</span>
            <p className="text-2xl font-bold font-mono text-purple-400">{state.counts.currentlyLocked}</p>
            <span className="text-[11px] text-muted-foreground font-mono">
              Locked under active processing
            </span>
          </div>

          <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-1.5 shadow-sm">
            <span className="text-xs font-mono text-muted-foreground">SCHEDULER STATUS</span>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-base font-bold font-mono text-emerald-400">ONLINE</p>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono truncate block">
              Last sync: {new Date(state.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {/* Manual Execution Result Card (if just triggered) */}
      {lastTriggerResult && (
        <div className="p-4 rounded-xl border border-purple-500/40 bg-purple-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-purple-300 flex items-center gap-2 font-mono">
              <Sparkles className="h-4 w-4 text-purple-400" />
              Manual Scheduler Execution Completed
            </h2>
            <Badge variant="outline" className="text-xs font-mono border-purple-500/30 text-purple-300">
              Duration: {lastTriggerResult.durationMs}ms
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded bg-muted/30 border border-border/60">
              <span className="text-[10px] text-muted-foreground block">WATCHES EXAMINED</span>
              <span className="text-base font-bold text-foreground">{lastTriggerResult.watchesExamined ?? 0}</span>
            </div>
            <div className="p-2.5 rounded bg-muted/30 border border-border/60">
              <span className="text-[10px] text-muted-foreground block">CANDIDATES HARVESTED</span>
              <span className="text-base font-bold text-foreground">{lastTriggerResult.opportunitiesDiscovered ?? 0}</span>
            </div>
            <div className="p-2.5 rounded bg-muted/30 border border-border/60">
              <span className="text-[10px] text-muted-foreground block">NEW OPPS DISCOVERED</span>
              <span className="text-base font-bold text-emerald-400">{lastTriggerResult.newOpportunities ?? 0}</span>
            </div>
            <div className="p-2.5 rounded bg-muted/30 border border-border/60">
              <span className="text-[10px] text-muted-foreground block">ALERTS GENERATED</span>
              <span className="text-base font-bold text-purple-400">{lastTriggerResult.notificationsCreated ?? 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Active Worker Claims & Leases Table */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Lock className="h-4 w-4 text-purple-400" />
          Active Worker Leases & Distributed Mutual Exclusion
        </h2>

        <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground font-mono text-sm flex items-center justify-center gap-2">
              <RotateCw className="h-4 w-4 animate-spin text-purple-400" />
              Loading active worker claims...
            </div>
          ) : !state || state.activeWorkerClaims.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground font-mono text-sm space-y-1">
              <Unlock className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p>No active locks. All worker queues are idle and ready for next cycle.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-muted/40 border-b border-border/70 text-muted-foreground uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Watch ID</th>
                    <th className="py-3 px-4">Tenant User ID</th>
                    <th className="py-3 px-4">Worker Lock Owner</th>
                    <th className="py-3 px-4">Lease Acquired At</th>
                    <th className="py-3 px-4">Next Scheduled Scan</th>
                    <th className="py-3 px-4 text-right">Lock Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {state.activeWorkerClaims.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">{c.id}</td>
                      <td className="py-3 px-4 text-muted-foreground">{c.userId}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px] font-mono border-purple-500/30 text-purple-300">
                          {c.lockOwner}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(c.lockedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(c.nextScanAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[10px]">
                          LOCKED (LEASE ACTIVE)
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
