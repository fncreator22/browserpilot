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
  Globe,
  Smartphone,
  StopCircle,
  PlayCircle,
  Download,
  Trash2,
  FileText,
  FileSpreadsheet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { type AdminOverviewMetrics } from "@/lib/admin/adminService";
import { ADMIN_UI_ROUTES, ADMIN_API_ROUTES } from "@/lib/admin/adminRoutes";
import { AdminObservabilityDeck } from "@/components/admin/admin-observability-deck";
import { AdminPasswordModal } from "@/components/admin/admin-password-modal";

const PLATFORM_COLORS: Record<string, { bar: string; text: string }> = {
  LinkedIn: { bar: "bg-blue-500", text: "text-blue-400" },
  Indeed: { bar: "bg-indigo-500", text: "text-indigo-400" },
  "Y Combinator": { bar: "bg-amber-500", text: "text-amber-400" },
  Greenhouse: { bar: "bg-emerald-500", text: "text-emerald-400" },
  Lever: { bar: "bg-cyan-500", text: "text-cyan-400" },
  Ashby: { bar: "bg-purple-500", text: "text-purple-400" },
  Workday: { bar: "bg-orange-500", text: "text-orange-400" },
  Wellfound: { bar: "bg-rose-500", text: "text-rose-400" },
  SmartRecruiters: { bar: "bg-teal-500", text: "text-teal-400" },
  ZipRecruiter: { bar: "bg-lime-500", text: "text-lime-400" },
};

function MetricSparkline({ data, color = "#A855F7" }: { data: number[]; color?: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 68;
  const height = 22;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible opacity-80 shrink-0">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<AdminOverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminKey, setAdminKey] = useState<string | null>(null);

  // Swarm control state
  const [swarmActionLoading, setSwarmActionLoading] = useState(false);
  const [swarmsHalted, setSwarmsHalted] = useState(false);

  // Data Governance state
  const [exportSection, setExportSection] = useState<"opportunities" | "watches" | "users" | "all">("opportunities");
  const [exportFormat, setExportFormat] = useState<"json" | "csv" | "doc" | "pdf">("json");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanDryRun, setCleanDryRun] = useState(true);
  const [cleanResult, setCleanResult] = useState<any | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const key = new URLSearchParams(window.location.search).get("admin_key");
      if (key) setAdminKey(key);
    }
  }, []);

  const getAdminHref = (path: string) => {
    if (!adminKey) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}admin_key=${encodeURIComponent(adminKey)}`;
  };

  const handleSwarmControl = async (action: "STOP_ALL" | "START_ALL") => {
    setSwarmActionLoading(true);
    try {
      const url = getAdminHref(ADMIN_API_ROUTES.SWARMS_CONTROL);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Swarm control request failed");
      
      if (action === "STOP_ALL") {
        setSwarmsHalted(true);
        toast.warning(`EMERGENCY HALT: Stopped ${data.stoppedExecutionsCount || 0} runs and paused scraper swarms.`);
      } else {
        setSwarmsHalted(false);
        toast.success("Swarm engines and scraper minions resumed successfully.");
      }
      fetchMetrics(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to execute swarm control action");
    } finally {
      setSwarmActionLoading(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const url = getAdminHref(`${ADMIN_API_ROUTES.DATA_EXPORT}?download=true`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: exportSection,
          format: exportFormat,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          download: true,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Export failed (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `browserpilot-export-${exportSection}-${new Date().toISOString().slice(0, 10)}.${exportFormat === "doc" ? "doc" : exportFormat === "csv" ? "csv" : exportFormat === "pdf" ? "pdf" : "json"}`;
      if (contentDisposition && contentDisposition.includes("filename=")) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(`Export downloaded: ${filename}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExecutePurge = async (password: string) => {
    setIsCleaning(true);
    try {
      const url = getAdminHref(ADMIN_API_ROUTES.DATA_CLEAN);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": password,
        },
        body: JSON.stringify({
          section: exportSection,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          dryRun: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Data cleanup operation failed");

      setCleanResult(data);
      toast.success(`Purge complete: ${data.recordsAffected || 0} records cleaned.`);
      fetchMetrics(false);
    } catch (err: any) {
      toast.error(err.message || "Cleanup failed");
      throw err;
    } finally {
      setIsCleaning(false);
    }
  };

  const handleDryRunPreview = async () => {
    setIsCleaning(true);
    try {
      const url = getAdminHref(ADMIN_API_ROUTES.DATA_CLEAN);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: exportSection,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          dryRun: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Dry-run simulation failed");

      setCleanResult(data);
      toast.info(`Dry Run complete: ${data.recordsAffected || 0} candidate records identified.`);
    } catch (err: any) {
      toast.error(err.message || "Dry run failed");
    } finally {
      setIsCleaning(false);
    }
  };

  const fetchMetrics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const key = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
      const url = key ? `${ADMIN_API_ROUTES.METRICS}?admin_key=${encodeURIComponent(key)}` : ADMIN_API_ROUTES.METRICS;
      const res = await fetch(url);
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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-sm">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              System Observability
            </h1>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="text-emerald-400 font-semibold">{system.status}</span>
              <span>•</span>
              <span>{users.totalUsers} tenants</span>
              <span>•</span>
              <span>{runs.totalRuns} total cycles</span>
            </div>
          </div>
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
          <Link href={getAdminHref(ADMIN_UI_ROUTES.SCHEDULER)}>
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
        <Link href={getAdminHref(ADMIN_UI_ROUTES.USERS)} className="group">
          <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm transition-all group-hover:border-purple-500/40 group-hover:bg-muted/20 cursor-pointer">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
              <span className="group-hover:text-purple-300 transition-colors">REGISTERED USERS</span>
              <Users className="h-4 w-4 text-purple-400" />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
                  {users.totalUsers}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  ({users.usersWithActiveWatch} active)
                </span>
              </div>
              <MetricSparkline data={[1, 2, 2, 3, 4, 5, users.totalUsers || 6]} color="#A855F7" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {Math.round((users.usersWithActiveWatch / Math.max(1, users.totalUsers)) * 100)}% of tenants have automated watches
            </p>
          </div>
        </Link>

        {/* Discovery Watches */}
        <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
            <span>DISCOVERY WATCHES</span>
            <Eye className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-emerald-400">
                {watches.activeWatches}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                / {watches.totalWatches} total
              </span>
            </div>
            <MetricSparkline data={[2, 3, 5, 4, 6, 8, watches.activeWatches || 9]} color="#10B981" />
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
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-blue-400">
                {catalog.totalOpportunities.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                ({catalog.activeOpportunities} active)
              </span>
            </div>
            <MetricSparkline data={[20, 35, 48, 55, 62, 70, catalog.totalOpportunities || 79]} color="#3B82F6" />
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
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-amber-400">
                {runs.totalRuns}
              </span>
              <span className="text-xs text-emerald-400 font-mono font-semibold">
                {runs.successRatePercentage}% success
              </span>
            </div>
            <MetricSparkline data={[5, 12, 19, 24, 30, 42, runs.totalRuns || 50]} color="#F59E0B" />
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
            {catalog.sourceDistribution.platforms && catalog.sourceDistribution.platforms.length > 0 ? (
              catalog.sourceDistribution.platforms.map((plat) => {
                const color = PLATFORM_COLORS[plat.platform] || { bar: "bg-purple-500", text: "text-purple-400" };
                return (
                  <div key={plat.platform} className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono truncate">{plat.platform}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{plat.percentage}%</span>
                    </div>
                    <p className="text-lg font-bold font-mono text-foreground">{plat.count}</p>
                    <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                      <div
                        className={`${color.bar} h-full transition-all duration-300`}
                        style={{
                          width: `${Math.max(4, plat.percentage)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <>
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
              </>
            )}
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
            <Link href={getAdminHref(ADMIN_UI_ROUTES.WATCHES)} className="text-xs font-mono text-purple-400 hover:underline flex items-center gap-1">
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

        {/* Outbound Alerts & Multi-Channel Delivery Telemetry */}
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

          {/* Delivery Channels */}
          <div className="grid grid-cols-3 gap-2.5 text-center font-mono">
            <div className="p-2.5 rounded bg-muted/20 border border-border/60">
              <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-1">
                <Bell className="h-3 w-3 text-purple-400" />
                <span>IN-APP</span>
              </div>
              <span className="text-base font-bold text-foreground">{alerts.channels?.inAppCount ?? alerts.totalAlerts}</span>
              <span className="text-[9px] text-emerald-400 block mt-0.5">Active</span>
            </div>
            <div className="p-2.5 rounded bg-muted/20 border border-border/60">
              <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-1">
                <Mail className="h-3 w-3 text-blue-400" />
                <span>EMAIL DISPATCH</span>
              </div>
              <span className="text-base font-bold text-foreground">{alerts.channels?.emailDeliveredCount ?? (alerts.breakdown.newOpportunity + alerts.breakdown.newSource)}</span>
              <span className="text-[9px] text-blue-400 block mt-0.5">Idempotent</span>
            </div>
            <div className="p-2.5 rounded bg-muted/20 border border-border/60">
              <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-1">
                <Smartphone className="h-3 w-3 text-emerald-400" />
                <span>SYSTEM / PUSH</span>
              </div>
              <span className="text-base font-bold text-emerald-400">{alerts.channels?.deliveryRate ?? 100}%</span>
              <span className="text-[9px] text-emerald-400 block mt-0.5">Push Ready</span>
            </div>
          </div>

          {/* Alert Classification Breakdown */}
          <div className="pt-2 border-t border-border/50 grid grid-cols-3 gap-2 text-center font-mono">
            <div className="p-2 rounded bg-muted/10">
              <span className="text-[10px] text-muted-foreground block">UNREAD</span>
              <span className="text-sm font-bold text-amber-400">{alerts.unreadAlerts}</span>
            </div>
            <div className="p-2 rounded bg-muted/10">
              <span className="text-[10px] text-muted-foreground block">NEW OPPS</span>
              <span className="text-sm font-bold text-emerald-400">{alerts.breakdown.newOpportunity}</span>
            </div>
            <div className="p-2 rounded bg-muted/10">
              <span className="text-[10px] text-muted-foreground block">NEW SOURCES</span>
              <span className="text-sm font-bold text-blue-400">{alerts.breakdown.newSource}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Observability & Latency Engine */}
      <AdminObservabilityDeck adminKey={adminKey} />

      {/* Emergency Swarm & Minion Control Deck */}
      <div className="p-6 rounded-xl border border-red-500/30 bg-card/80 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <StopCircle className="h-5 w-5 text-red-500 animate-pulse" />
              <h2 className="text-base font-bold text-foreground tracking-tight">
                Emergency Swarm & Minion Control
              </h2>
              <Badge variant="outline" className="text-[10px] font-mono bg-red-500/10 text-red-400 border-red-500/40">
                HAZARD CONTROLS
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Immediate circuit breaker for scraping minion workers, search queues, and active background browser engines.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground">
              Engine Status: {swarmsHalted ? <span className="text-red-400 font-bold">HALTED</span> : <span className="text-emerald-400 font-bold">OPERATIONAL</span>}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20 space-y-3">
            <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
              <StopCircle className="h-4 w-4" />
              <span>Circuit Breaker: Halt All Minions & Swarms</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Instantly marks all running watch executions as FAILED, pauses BullMQ worker queues, and aborts any active browser crawl tasks.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={swarmActionLoading}
              onClick={() => handleSwarmControl("STOP_ALL")}
              className="w-full text-xs font-mono font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs"
            >
              {swarmActionLoading ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Halting Engines...
                </>
              ) : (
                <>
                  <StopCircle className="h-3.5 w-3.5 mr-1.5" />
                  Halt All Swarms / Engines
                </>
              )}
            </Button>
          </div>

          <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <PlayCircle className="h-4 w-4" />
              <span>Resume & Restart Swarms & Queues</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Resumes BullMQ worker queues, restarts idle scraper minions, and unlocks scheduled background watch intervals.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={swarmActionLoading}
              onClick={() => handleSwarmControl("START_ALL")}
              className="w-full text-xs font-mono font-bold border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
            >
              {swarmActionLoading ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Restarting Engines...
                </>
              ) : (
                <>
                  <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                  Resume & Restart All Engines
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Data Governance & Multi-Format Export Deck */}
      <div className="p-6 rounded-xl border border-border/70 bg-card/60 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-purple-400" />
              <h2 className="text-base font-bold text-foreground tracking-tight">
                Data Governance & Multi-Format Export
              </h2>
              <Badge variant="outline" className="text-[10px] font-mono bg-purple-500/10 text-purple-400 border-purple-500/30">
                AUDIT & EXPORT
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Extract, audit, and clean data across opportunities, watches, and user activity in Word DOC, PDF, Excel CSV, or JSON.
            </p>
          </div>
        </div>

        {/* Filter & Configuration Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Target Section */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Target Section</label>
            <select
              value={exportSection}
              onChange={(e) => setExportSection(e.target.value as any)}
              className="w-full h-9 rounded-md bg-background border border-border px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="opportunities">Opportunities ({metrics.catalog.totalOpportunities})</option>
              <option value="watches">Watches ({metrics.watches.totalWatches})</option>
              <option value="users">Users ({metrics.users.totalUsers})</option>
              <option value="all">All Database Entities</option>
            </select>
          </div>

          {/* Export Format */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">File Format</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
              className="w-full h-9 rounded-md bg-background border border-border px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="json">JSON Document (.json)</option>
              <option value="csv">Excel / CSV Spreadsheet (.csv)</option>
              <option value="doc">Microsoft Word DOC (.doc)</option>
              <option value="pdf">Adobe PDF Report (.pdf)</option>
            </select>
          </div>

          {/* Date From */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Date Range From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-9 rounded-md bg-background border border-border px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Date Range To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-9 rounded-md bg-background border border-border px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Action Controls Row */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/50">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isExporting}
              onClick={handleExportData}
              className="h-9 px-4 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
            >
              {isExporting ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Generating Export...
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export & Download File
                </>
              )}
            </Button>
          </div>

          {/* Clean / Purge Section */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCleaning}
              onClick={handleDryRunPreview}
              className="h-9 px-3 text-xs font-mono border-border/80 hover:bg-muted/50 w-full sm:w-auto cursor-pointer"
            >
              {isCleaning ? (
                <RotateCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
              )}
              Dry-Run Preview
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isCleaning}
              onClick={() => setIsPasswordModalOpen(true)}
              className="h-9 px-3 text-xs font-mono text-red-400 border-red-500/30 hover:bg-red-500/10 w-full sm:w-auto cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clean Data (Password Protected)
            </Button>
          </div>
        </div>

        {/* Dry run / Clean results display banner */}
        {cleanResult && (
          <div className="p-3 rounded-lg border border-border/80 bg-muted/20 text-xs font-mono space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Execution Mode:</span>
              <span className={cleanResult.dryRun ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                {cleanResult.dryRun ? "DRY RUN (Simulated)" : "PURGE APPLIED"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Target Scope:</span>
              <span className="text-foreground">{cleanResult.section}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Records Affected:</span>
              <span className="font-bold text-foreground">{cleanResult.recordsAffected ?? 0}</span>
            </div>
          </div>
        )}
      </div>

      {/* Mandatory Password Confirmation Gate for Destructive Clean / Purge */}
      <AdminPasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={handleExecutePurge}
        actionTitle="Database Purge Authorization"
        actionDescription={`You are about to permanently delete records from "${exportSection}"${dateFrom ? ` from ${dateFrom}` : ""}${dateTo ? ` to ${dateTo}` : ""}. This action cannot be undone.`}
        expectedConfirmationPhrase="CONFIRM PURGE"
        affectedCount={cleanResult?.recordsAffected}
        affectedItemType={`${exportSection} records`}
      />
    </div>
  );
}
