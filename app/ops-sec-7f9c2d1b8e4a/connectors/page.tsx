"use client";

import { useState, useEffect } from "react";
import {
  Plug,
  Plus,
  RotateCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  Shield,
  Layers,
  Database,
  Pencil,
  Trash2,
  Upload,
  Activity,
  Globe,
  Lock,
  Unlock,
  Check,
  Power,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ADMIN_API_ROUTES } from "@/lib/admin/adminRoutes";

interface ConnectorItem {
  id: string;
  name: string;
  displayName?: string | null;
  iconUrl?: string | null;
  type: string;
  baseUrl: string;
  baseUrlPattern?: string | null;
  requiresAuth: boolean;
  isEnabled: boolean;
  isPublic: boolean;
  status: string;
  totalCrawls: number;
  successfulCrawls: number;
  failedCrawls: number;
  totalJobsFound: number;
  recentJobsFound: number;
  lastQualityGatePassed: number;
  totalQualityGatePassed: number;
  lastCrawledAt?: string | null;
  lastStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface HarvestLogItem {
  id: string;
  sourceId?: string | null;
  connectorName: string;
  targetUrl?: string | null;
  status: string;
  jobsFoundCount: number;
  qualityGatePassCount: number;
  durationMs: number;
  errorMessage?: string | null;
  createdAt: string;
}

interface SummaryMetrics {
  totalConnectors: number;
  activeConnectors: number;
  disabledConnectors: number;
  blockedConnectors: number;
  totalCrawlsAllTime: number;
  totalJobsFoundAllTime: number;
  totalQualityGatePassedAllTime: number;
  overallQualityPassRate: number;
}

export default function AdminConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [recentLogs, setRecentLogs] = useState<HarvestLogItem[]>([]);
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<ConnectorItem | null>(null);
  const [formData, setFormData] = useState({
    displayName: "",
    name: "",
    type: "CAREER_PORTAL",
    baseUrl: "",
    baseUrlPattern: "",
    iconUrl: "",
    requiresAuth: false,
    isEnabled: true,
    isPublic: true,
    status: "ACTIVE",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const adminKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
      const apiUrl = adminKey ? `${ADMIN_API_ROUTES.CONNECTORS}?admin_key=${encodeURIComponent(adminKey)}` : ADMIN_API_ROUTES.CONNECTORS;
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`Failed to load connectors (HTTP ${res.status})`);
      const data = await res.json();

      setConnectors(data.connectors || []);
      setRecentLogs(data.recentLogs || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      toast.error(err.message || "Failed to load connector registry");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleOpenAdd = () => {
    setEditingConnector(null);
    setFormData({
      displayName: "",
      name: "",
      type: "CAREER_PORTAL",
      baseUrl: "",
      baseUrlPattern: "",
      iconUrl: "",
      requiresAuth: false,
      isEnabled: true,
      isPublic: true,
      status: "ACTIVE",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (conn: ConnectorItem) => {
    setEditingConnector(conn);
    setFormData({
      displayName: conn.displayName || conn.name,
      name: conn.name,
      type: conn.type,
      baseUrl: conn.baseUrl,
      baseUrlPattern: conn.baseUrlPattern || "",
      iconUrl: conn.iconUrl || "",
      requiresAuth: conn.requiresAuth,
      isEnabled: conn.isEnabled,
      isPublic: conn.isPublic ?? true,
      status: conn.status,
    });
    setIsModalOpen(true);
  };

  const handleTogglePublic = async (conn: ConnectorItem) => {
    const newPublic = !conn.isPublic;
    try {
      const res = await fetch(`${ADMIN_API_ROUTES.CONNECTORS}/${conn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: newPublic }),
      });

      if (!res.ok) throw new Error("Failed to update visibility");
      toast.success(`${conn.displayName || conn.name} ${newPublic ? "is now visible to users" : "is now hidden from users"}`);
      fetchDashboardData(true);
    } catch (err: any) {
      toast.error(err.message || "Error updating visibility");
    }
  };

  const handleToggleEnable = async (conn: ConnectorItem) => {
    const newEnabled = !conn.isEnabled;
    const newStatus = newEnabled ? "ACTIVE" : "DISABLED";

    try {
      const res = await fetch(`${ADMIN_API_ROUTES.CONNECTORS}/${conn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: newEnabled, status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update connector status");
      toast.success(`${conn.displayName || conn.name} ${newEnabled ? "enabled" : "disabled"}`);
      fetchDashboardData(true);
    } catch (err: any) {
      toast.error(err.message || "Error updating connector");
    }
  };

  const handleDeleteConnector = async (conn: ConnectorItem) => {
    if (!confirm(`Are you sure you want to delete connector "${conn.displayName || conn.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`${ADMIN_API_ROUTES.CONNECTORS}/${conn.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete connector");
      toast.success(`Connector "${conn.displayName || conn.name}" removed.`);
      fetchDashboardData(true);
    } catch (err: any) {
      toast.error(err.message || "Error deleting connector");
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingConnector) {
        // Update
        const res = await fetch(`${ADMIN_API_ROUTES.CONNECTORS}/${editingConnector.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || "Failed to update connector");
        }
        toast.success(`Updated "${formData.displayName}"`);
      } else {
        // Create
        const res = await fetch(ADMIN_API_ROUTES.CONNECTORS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || "Failed to add connector");
        }
        toast.success(`Registered connector "${formData.displayName}"`);
      }

      setIsModalOpen(false);
      fetchDashboardData(true);
    } catch (err: any) {
      toast.error(err.message || "Error saving connector");
    } finally {
      setSubmitting(false);
    }
  };

  const handleIconFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024) {
        toast.error("Icon file must be under 200 KB");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFormData((prev) => ({ ...prev, iconUrl: String(event.target?.result) }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Filtered connectors
  const filteredConnectors = connectors.filter((c) => {
    if (filterType === "DIRECT_ATS" && c.type !== "DIRECT_ATS" && c.type !== "ATS_PORTAL") return false;
    if (filterType === "CAREER_PORTAL" && c.type !== "CAREER_PORTAL" && c.type !== "COMPANY_CAREERS") return false;
    if (filterType === "AGGREGATOR" && c.type !== "AGGREGATOR" && c.type !== "TECH_COMMUNITY") return false;
    if (filterType === "DISABLED" && c.isEnabled && c.status !== "DISABLED") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (c.displayName || c.name).toLowerCase().includes(q);
      const matchUrl = c.baseUrl.toLowerCase().includes(q) || (c.baseUrlPattern || "").toLowerCase().includes(q);
      return matchName || matchUrl;
    }

    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Plug className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Connector Registry & Analytics</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Admin-managed crawler sources, real harvest usage tracking, and automatic search discovery controls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="gap-2 font-mono text-xs border-border/80 hover:bg-muted/50"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-purple-400" : ""}`} />
            Refresh Analytics
          </Button>

          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Connector
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
              <span>ACTIVE CONNECTORS</span>
              <Layers className="h-4 w-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {summary.activeConnectors}
              </span>
              <span className="text-xs text-muted-foreground">/ {summary.totalConnectors} total</span>
            </div>
            <div className="flex items-center gap-2 pt-1 text-[11px] font-mono">
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {summary.activeConnectors} Active
              </span>
              {summary.disabledConnectors > 0 && (
                <span className="text-muted-foreground flex items-center gap-1">
                  • {summary.disabledConnectors} Disabled
                </span>
              )}
              {summary.blockedConnectors > 0 && (
                <span className="text-rose-400 flex items-center gap-1">
                  • {summary.blockedConnectors} Blocked
                </span>
              )}
            </div>
          </div>

          <div className="p-5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
              <span>ALL-TIME SEARCHES</span>
              <Activity className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {summary.totalCrawlsAllTime.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono pt-1">
              Real crawler executions logged in database
            </p>
          </div>

          <div className="p-5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
              <span>JOBS HARVESTED</span>
              <Database className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono text-emerald-400">
              {summary.totalJobsFoundAllTime.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono pt-1">
              All-time opportunities discovered across sources
            </p>
          </div>

          <div className="p-5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
              <span>QUALITY GATE PASS RATE</span>
              <Shield className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {summary.overallQualityPassRate}%
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                ({summary.totalQualityGatePassedAllTime} passed)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono pt-1">
              Strict title + detail URL validation pass rate
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 border border-border/60 rounded-lg w-full sm:w-auto overflow-x-auto">
          {[
            { id: "ALL", label: "All Connectors" },
            { id: "DIRECT_ATS", label: "Direct ATS" },
            { id: "CAREER_PORTAL", label: "Career Portals" },
            { id: "AGGREGATOR", label: "Aggregators" },
            { id: "DISABLED", label: "Disabled" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filterType === tab.id
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search connectors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border/60 bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Connector Registry Table */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-bold text-foreground tracking-wide">Registered Harvester Connectors</h2>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Showing {filteredConnectors.length} of {connectors.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/30 text-muted-foreground font-mono uppercase tracking-wider border-b border-border/40 text-[10px]">
              <tr>
                <th className="px-4 py-3">Connector</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Base Pattern</th>
                <th className="px-4 py-3">Session Mode</th>
                <th className="px-4 py-3 text-right">Searched</th>
                <th className="px-4 py-3 text-right">Jobs Found</th>
                <th className="px-4 py-3">Last Refresh</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">User Visible</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground font-mono">
                    <RotateCw className="h-5 w-5 animate-spin mx-auto mb-2 text-purple-400" />
                    Loading connector registry and live metrics...
                  </td>
                </tr>
              ) : filteredConnectors.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground font-mono">
                    No connectors match the current filter.
                  </td>
                </tr>
              ) : (
                filteredConnectors.map((c) => {
                  const isBlocked = c.status === "BLOCKED";
                  const isDisabled = !c.isEnabled || c.status === "DISABLED";
                  const isActive = !isDisabled && !isBlocked;

                  return (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      {/* Connector Name & Icon */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-md bg-muted/60 border border-border/60 flex items-center justify-center overflow-hidden shrink-0">
                            {c.iconUrl ? (
                              <img src={c.iconUrl} alt="" className="h-5 w-5 object-contain" />
                            ) : (
                              <Plug className="h-4 w-4 text-purple-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              {c.displayName || c.name}
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground">{c.name}</span>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3.5">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] uppercase border-purple-500/30 text-purple-300 bg-purple-500/5"
                        >
                          {c.type}
                        </Badge>
                      </td>

                      {/* Base URL Pattern */}
                      <td className="px-4 py-3.5 font-mono text-[11px] text-muted-foreground max-w-[200px] truncate">
                        <span title={c.baseUrlPattern || c.baseUrl}>
                          {c.baseUrlPattern || c.baseUrl}
                        </span>
                      </td>

                      {/* Session Requirement */}
                      <td className="px-4 py-3.5">
                        {c.requiresAuth ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            <Lock className="h-3 w-3" /> User Session Req
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                            <Unlock className="h-3 w-3" /> Public / Direct
                          </span>
                        )}
                      </td>

                      {/* Total Times Searched */}
                      <td className="px-4 py-3.5 text-right font-mono font-medium text-foreground">
                        {c.totalCrawls.toLocaleString()}
                      </td>

                      {/* Jobs Found */}
                      <td className="px-4 py-3.5 text-right font-mono">
                        <div className="font-bold text-foreground">{c.totalJobsFound.toLocaleString()}</div>
                        {c.recentJobsFound > 0 && (
                          <span className="text-[10px] text-emerald-400 font-semibold">
                            +{c.recentJobsFound} recent
                          </span>
                        )}
                      </td>

                      {/* Last Refreshed */}
                      <td className="px-4 py-3.5 font-mono text-[11px] text-muted-foreground">
                        {c.lastCrawledAt ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {new Date(c.lastCrawledAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </div>
                        ) : (
                          "Never"
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        {isDisabled ? (
                          <Badge variant="outline" className="bg-muted/40 text-muted-foreground border-border text-[10px] font-mono">
                            DISABLED
                          </Badge>
                        ) : isBlocked ? (
                          <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px] font-mono">
                            BLOCKED
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                            ACTIVE
                          </Badge>
                        )}
                      </td>

                      {/* User Visible */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleTogglePublic(c)}
                          title={c.isPublic ? "Visible to end users - Click to hide" : "Hidden from end users - Click to show"}
                          className={`inline-flex items-center gap-1 text-[11px] font-sans px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            c.isPublic
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                              : "border-slate-500/30 bg-slate-500/10 text-slate-400"
                          }`}
                        >
                          {c.isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          <span>{c.isPublic ? "Visible" : "Hidden"}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Enable/Disable Toggle */}
                          <button
                            onClick={() => handleToggleEnable(c)}
                            title={c.isEnabled ? "Disable connector" : "Enable connector"}
                            className={`p-1.5 rounded-md border transition-all ${
                              c.isEnabled
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                : "border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted/60"
                            }`}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEdit(c)}
                            title="Edit connector"
                            className="p-1.5 rounded-md border border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteConnector(c)}
                            title="Delete connector"
                            className="p-1.5 rounded-md border border-border/60 bg-muted/20 text-rose-400 hover:bg-rose-500/10 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Harvest Audit Logs Feed */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-foreground tracking-wide">Recent Real Harvest Audit Logs</h2>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Direct telemetry recorded by harvesting pipeline
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/30 text-muted-foreground font-mono uppercase tracking-wider border-b border-border/40 text-[10px]">
              <tr>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5">Connector</th>
                <th className="px-4 py-2.5">Target URL</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Jobs Found</th>
                <th className="px-4 py-2.5 text-right">Quality Passed</th>
                <th className="px-4 py-2.5 text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono text-[11px]">
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No recent harvest logs recorded yet. Execute a search to populate live usage data.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-foreground">{log.connectorName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-[280px] truncate" title={log.targetUrl || ""}>
                      {log.targetUrl || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {log.status === "SUCCESS" ? (
                        <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">
                          SUCCESS
                        </span>
                      ) : log.status === "BLOCKED" ? (
                        <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 text-[10px]">
                          BLOCKED
                        </span>
                      ) : log.status === "ERROR" ? (
                        <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[10px]">
                          ERROR
                        </span>
                      ) : (
                        <span className="text-muted-foreground bg-muted/40 px-2 py-0.5 rounded text-[10px]">
                          EMPTY
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-foreground">
                      {log.jobsFoundCount}
                    </td>
                    <td className="px-4 py-2.5 text-right text-emerald-400">
                      {log.qualityGatePassCount}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {log.durationMs} ms
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Connector Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
            <div className="px-6 py-5 border-b border-border/60 bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Plug className="h-5 w-5 text-purple-400" />
                <h3 className="font-bold text-foreground text-base">
                  {editingConnector ? `Edit Connector: ${formData.displayName}` : "Register New Connector"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
              {/* Display Name & Identifier */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-muted-foreground font-mono font-medium">Display Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SmartRecruiters"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground text-xs focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground font-mono font-medium">Platform Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground text-xs focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="CAREER_PORTAL">CAREER_PORTAL (Workday, Custom)</option>
                    <option value="DIRECT_ATS">DIRECT_ATS (Greenhouse, Lever)</option>
                    <option value="AGGREGATOR">AGGREGATOR (LinkedIn, Indeed)</option>
                  </select>
                </div>
              </div>

              {/* Base URL & URL Pattern */}
              <div className="space-y-1.5">
                <label className="text-muted-foreground font-mono font-medium">Base URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://jobs.smartrecruiters.com"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground text-xs focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted-foreground font-mono font-medium">
                  Base URL Match Pattern (Wildcard)
                </label>
                <input
                  type="text"
                  placeholder="*smartrecruiters.com*"
                  value={formData.baseUrlPattern}
                  onChange={(e) => setFormData({ ...formData, baseUrlPattern: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground text-xs font-mono focus:ring-1 focus:ring-purple-500"
                />
                <p className="text-[10px] text-muted-foreground">
                  Wildcard used to match dynamic open-web URLs to this connector.
                </p>
              </div>

              {/* Icon URL or Upload */}
              <div className="space-y-1.5">
                <label className="text-muted-foreground font-mono font-medium">Icon (URL or Upload)</label>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted/60 border border-border/60 flex items-center justify-center shrink-0 overflow-hidden">
                    {formData.iconUrl ? (
                      <img src={formData.iconUrl} alt="Preview" className="h-6 w-6 object-contain" />
                    ) : (
                      <Plug className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="https://example.com/icon.png"
                    value={formData.iconUrl}
                    onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground text-xs focus:ring-1 focus:ring-purple-500"
                  />
                  <label className="cursor-pointer px-3 py-2 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted text-foreground flex items-center gap-1 font-mono text-[11px]">
                    <Upload className="h-3 w-3" /> Upload
                    <input type="file" accept="image/*" onChange={handleIconFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Session Requirement & Enabled Flags */}
              <div className="pt-2 border-t border-border/40 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={formData.requiresAuth}
                    onChange={(e) => setFormData({ ...formData, requiresAuth: e.target.checked })}
                    className="rounded border-border text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                  <span className="font-medium">Requires User-Connected Session</span>
                  <span className="text-[10px] text-muted-foreground">
                    (Requires authenticated user browser session to crawl)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={formData.isEnabled}
                    onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                    className="rounded border-border text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                  <span className="font-medium">Enable for Automatic Discovery & Search</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-foreground">
                  <input
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                    className="rounded border-border text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                  <span className="font-medium">Visible to Users in Connector Preferences</span>
                  <span className="text-[10px] text-muted-foreground">
                    (When unchecked, regular users cannot see this connector)
                  </span>
                </label>
              </div>

              {/* Form Actions */}
              <div className="pt-4 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-medium"
                >
                  {submitting ? (
                    <>
                      <RotateCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : editingConnector ? (
                    "Save Changes"
                  ) : (
                    "Register Connector"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
