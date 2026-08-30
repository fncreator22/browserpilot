"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Activity, 
  Users, 
  Eye, 
  Layers, 
  Briefcase, 
  Bell, 
  Clock, 
  RotateCw, 
  Server, 
  Cpu, 
  Database, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight,
  Sparkles,
  Building2,
  Mail,
  Send,
  Zap,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { type AdminOverviewMetrics } from "@/lib/admin/adminService";

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/metrics");
      if (!res.ok) {
        throw new Error(`Failed to load metrics (HTTP ${res.status})`);
      }
      const data = await res.json();
      setMetrics(data);
      if (isManual) toast.success("Administrative metrics refreshed");
    } catch (err: any) {
      toast.error(err.message || "Failed to load telemetry");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Auto-poll metrics every 30 seconds for live observatory
    const interval = setInterval(() => fetchMetrics(), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground font-mono text-sm">
        <RotateCw className="h-6 w-6 animate-spin text-purple-400" />
        Loading system observability metrics...
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="py-12 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <h2 className="text-lg font-bold text-foreground">Unable to fetch system telemetry</h2>
        <Button onClick={() => fetchMetrics(true)} variant="outline" size="sm">
          Retry
        </Button>
      </div>
    );
  }

  const { system, users, watches, runs, catalog, alerts } = metrics;

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            System Observability & Telemetry
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            Autonomous multi-source swarm metrics, scheduler health, and tenant monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            className="font-mono text-xs gap-1.5 border-border/80 hover:border-purple-500/40"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-purple-400" : ""}`} />
            Refresh
          </Button>
          <Link href="/admin/scheduler">
            <Button size="sm" className="font-mono text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
              <Clock className="h-3.5 w-3.5" />
              Scheduler Console
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
            <span>REGISTERED USERS</span>
            <Users className="h-4 w-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
              {users.totalUsers}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              ({users.usersWithActiveWatch} active)
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {Math.round((users.usersWithActiveWatch / Math.max(1, users.totalUsers)) * 100)}% of tenants have automated watches
          </p>
        </div>

        {/* Discovery Watches */}
        <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
            <span>DISCOVERY WATCHES</span>
            <Eye className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-emerald-400">
              {watches.activeWatches}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              / {watches.totalWatches} total
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
            <span>{watches.totalTargetCompaniesConfigured} company targets</span>
          </div>
        </div>

        {/* Opportunity Catalog */}
        <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
            <span>CANONICAL CATALOG</span>
            <Briefcase className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-blue-400">
              {catalog.totalOpportunities.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              ({catalog.activeOpportunities} active)
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            {catalog.totalSourceListings} verified source listings
          </p>
        </div>

        {/* Discovery Runs */}
        <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
            <span>DISCOVERY RUNS</span>
            <Layers className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-amber-400">
              {runs.totalRuns}
            </span>
            <span className="text-xs text-emerald-400 font-mono font-semibold">
              {runs.successRatePercentage}% success
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            Avg duration: {runs.averageDurationMs}ms
          </p>
        </div>
      </div>

      {/* Middle Grid: Provider Distribution & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Provider Source Distribution */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-border/70 bg-card/60 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-400" />
              Multi-Source Swarm Distribution
            </h2>
            <Badge variant="outline" className="font-mono text-xs">
              {catalog.totalSourceListings} listings harvested
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
              <span className="text-xs text-muted-foreground font-mono">LinkedIn</span>
              <p className="text-lg font-bold font-mono text-foreground">{catalog.sourceDistribution.linkedIn}</p>
              <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full"
                  style={{
                    width: `${Math.round((catalog.sourceDistribution.linkedIn / Math.max(1, catalog.totalSourceListings)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
              <span className="text-xs text-muted-foreground font-mono">Indeed</span>
              <p className="text-lg font-bold font-mono text-foreground">{catalog.sourceDistribution.indeed}</p>
              <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-500 h-full"
                  style={{
                    width: `${Math.round((catalog.sourceDistribution.indeed / Math.max(1, catalog.totalSourceListings)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
              <span className="text-xs text-muted-foreground font-mono">Y Combinator</span>
              <p className="text-lg font-bold font-mono text-foreground">{catalog.sourceDistribution.yCombinator}</p>
              <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full"
                  style={{
                    width: `${Math.round((catalog.sourceDistribution.yCombinator / Math.max(1, catalog.totalSourceListings)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
              <span className="text-xs text-muted-foreground font-mono">Direct / Other</span>
              <p className="text-lg font-bold font-mono text-foreground">{catalog.sourceDistribution.other}</p>
              <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full"
                  style={{
                    width: `${Math.round((catalog.sourceDistribution.other / Math.max(1, catalog.totalSourceListings)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Discovery Novelty Breakdown */}
          <div className="pt-3 border-t border-border/50 grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] font-mono text-emerald-400 block">NEW OPPORTUNITIES</span>
              <span className="text-base font-bold font-mono text-emerald-300">{runs.totalNewOpportunities}</span>
            </div>
            <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
              <span className="text-[10px] font-mono text-blue-400 block">NEW SOURCES ATTACHED</span>
              <span className="text-base font-bold font-mono text-blue-300">{runs.totalNewSources}</span>
            </div>
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] font-mono text-amber-400 block">REPOSTS DETECTED</span>
              <span className="text-base font-bold font-mono text-amber-300">{runs.totalReposted}</span>
            </div>
          </div>
        </div>

        {/* System & Infrastructure Health */}
        <div className="p-5 rounded-xl border border-border/70 bg-card/60 space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Server className="h-4 w-4 text-purple-400" />
            Infrastructure Health
          </h2>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between p-2.5 rounded bg-muted/20 border border-border/60">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-purple-400" />
                Database Engine:
              </span>
              <Badge variant="outline" className="font-bold text-[10px]">
                {system.databaseEngine}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-muted/20 border border-border/60">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                Uptime:
              </span>
              <span className="text-foreground font-semibold">
                {Math.floor(system.uptimeSeconds / 3600)}h {Math.floor((system.uptimeSeconds % 3600) / 60)}m
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-muted/20 border border-border/60">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-blue-400" />
                Memory RSS:
              </span>
              <span className="text-foreground font-semibold">{system.memoryRssMb} MB</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-muted/20 border border-border/60">
              <span className="text-muted-foreground">Node Runtime:</span>
              <span className="text-foreground">{system.nodeVersion}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Scan Interval Distribution & Lifecycle Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scan Interval Distribution */}
        <div className="p-5 rounded-xl border border-border/70 bg-card/60 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              Watch Scan Interval Distribution
            </h2>
            <Link href="/admin/watches" className="text-xs font-mono text-purple-400 hover:underline flex items-center gap-1">
              View all watches <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-5 gap-2 text-center font-mono">
            <div className="p-2.5 rounded bg-muted/20 border border-border/60">
              <span className="text-[10px] text-muted-foreground block">2 Hours</span>
              <span className="text-lg font-bold text-foreground">{watches.intervalDistribution.twoHours}</span>
            </div>
            <div className="p-2.5 rounded bg-muted/20 border border-border/60">
              <span className="text-[10px] text-muted-foreground block">4 Hours</span>
              <span className="text-lg font-bold text-foreground">{watches.intervalDistribution.fourHours}</span>
            </div>
            <div className="p-2.5 rounded bg-muted/20 border border-border/60">
              <span className="text-[10px] text-muted-foreground block">6 Hours</span>
              <span className="text-lg font-bold text-foreground">{watches.intervalDistribution.sixHours}</span>
            </div>
            <div className="p-2.5 rounded bg-muted/20 border border-border/60">
              <span className="text-[10px] text-muted-foreground block">12 Hours</span>
              <span className="text-lg font-bold text-foreground">{watches.intervalDistribution.twelveHours}</span>
            </div>
            <div className="p-2.5 rounded bg-muted/20 border border-border/60">
              <span className="text-[10px] text-muted-foreground block">24 Hours</span>
              <span className="text-lg font-bold text-foreground">{watches.intervalDistribution.twentyFourHours}</span>
            </div>
          </div>
        </div>

        {/* Outbound Alerts & Email Telemetry */}
        <div className="p-5 rounded-xl border border-border/70 bg-card/60 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-purple-400" />
              Lifecycle Alerts & Outbound Delivery
            </h2>
            <Badge variant="outline" className="font-mono text-xs">
              {alerts.totalAlerts} total alerts
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center font-mono">
            <div className="p-3 rounded bg-muted/20 border border-border/60">
              <span className="text-[10px] text-muted-foreground block">UNREAD IN-APP</span>
              <span className="text-lg font-bold text-amber-400">{alerts.unreadAlerts}</span>
            </div>
            <div className="p-3 rounded bg-muted/20 border border-border/60">
              <span className="text-[10px] text-muted-foreground block">NEW OPP ALERTS</span>
              <span className="text-lg font-bold text-emerald-400">{alerts.breakdown.newOpportunity}</span>
            </div>
            <div className="p-3 rounded bg-muted/20 border border-border/60">
              <span className="text-[10px] text-muted-foreground block">NEW SOURCE ALERTS</span>
              <span className="text-lg font-bold text-blue-400">{alerts.breakdown.newSource}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
