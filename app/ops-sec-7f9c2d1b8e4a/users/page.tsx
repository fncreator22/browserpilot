"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Users, 
  Search, 
  RotateCw, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle,
  Clock, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink,
  Sparkles,
  Sliders,
  Save,
  AlertCircle,
  Zap,
  Activity,
  X,
  Key,
  BarChart3,
  Layers,
  Tag,
  UserCheck,
  Plus,
  Trash2,
  Percent,
  DollarSign,
  Gift,
  Check,
  Calendar,
  CreditCard,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ADMIN_API_ROUTES, ADMIN_UI_ROUTES } from "@/lib/admin/adminRoutes";

interface PlanConfig {
  id: string;
  code: string;
  name: string;
  description?: string;
  dailyTokenLimit: number;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  maxWatches: number;
  maxDailyDiscoveries: number;
  features: string[];
  active: boolean;
}

interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  hasGeminiKey: boolean;
  plan: {
    code: string;
    name: string;
    dailyTokenLimit: number;
  };
  puterConnection: {
    isConnected: boolean;
    connectedSince: string | null;
    username: string | null;
    sevenDaySuccessCalls: number;
    sevenDayFailedCalls: number;
  };
  todayTokenUsage: {
    totalTokens: number;
    geminiTokens: number;
    puterTokens: number;
    otherTokens: number;
    dailyLimit: number;
    percentage: number;
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [puterFilter, setPuterFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Drill-down slideover
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchUsers = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
      });
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (puterFilter !== "ALL") params.set("puter", puterFilter);

      const adminKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
      if (adminKey) params.set("admin_key", adminKey);

      const res = await fetch(`${ADMIN_API_ROUTES.USERS}?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load users (HTTP ${res.status})`);
      }
      const data = await res.json();
      setUsers(data.users || []);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.total || 0);
      }
      if (isManual) toast.success("Live user telemetry refreshed");
    } catch (err: any) {
      toast.error(err.message || "Failed to load user telemetry");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };


  useEffect(() => {
    fetchUsers();
  }, [page, puterFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return "bg-rose-500";
    if (percentage >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Users & AI Quotas
            </h1>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="text-purple-400 font-semibold">{totalCount} registered users</span>
              <span>•</span>
              <span>Live Telemetry & Daily Caps</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={typeof window !== "undefined" && new URLSearchParams(window.location.search).get("admin_key") ? `${ADMIN_UI_ROUTES.PLANS}?admin_key=${new URLSearchParams(window.location.search).get("admin_key")}` : ADMIN_UI_ROUTES.PLANS}>
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-xs gap-1.5 border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
            >
              <Sliders className="h-3.5 w-3.5 text-purple-400" />
              Plans, Subscriptions & Coupons
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsers(true)}
            disabled={refreshing}
            className="font-mono text-xs gap-1.5 border-border/80 hover:border-purple-500/40"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-purple-400" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/70 bg-card/60">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search user by email, name, or tenant ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 font-mono text-xs bg-background/50 border-border/80"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" className="h-9 font-mono text-xs">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Puter:</span>
          </div>
          <select
            value={puterFilter}
            onChange={(e) => {
              setPuterFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by Puter connection status"
            className="h-9 px-2.5 rounded-md border border-border/80 bg-background/80 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="ALL">All Users</option>
            <option value="CONNECTED">Puter Connected</option>
            <option value="NOT_CONNECTED">Puter Not Connected</option>
          </select>
        </div>
      </div>

      {/* Users List Table */}
      <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground font-mono text-sm">
            <RotateCw className="h-6 w-6 animate-spin text-purple-400" />
            Loading live user telemetry and token counts...
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-mono text-muted-foreground">No users match the search/filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30 text-[11px] text-muted-foreground uppercase">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Plan Tier</th>
                  <th className="py-3 px-4">Puter Status</th>
                  <th className="py-3 px-4">Today's Token Quota (Used / Limit)</th>
                  <th className="py-3 px-4 text-center">7-Day Calls (Puter)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.map((u) => {
                  const isPuter = u.puterConnection.isConnected;
                  const usage = u.todayTokenUsage;
                  const pct = usage.percentage;

                  return (
                    <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{u.name || "Unnamed Tenant"}</span>
                            {u.role === "ADMIN" && (
                              <Badge variant="outline" className="text-[9px] border-purple-500/40 text-purple-300 py-0 px-1">
                                ADMIN
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground block">{u.email}</span>
                          <span className="text-[10px] text-muted-foreground/70 font-mono">ID: {u.id}</span>
                        </div>
                      </td>

                      {/* Plan Tier */}
                      <td className="py-3.5 px-4">
                        <Badge 
                          variant="outline" 
                          className={`font-mono text-[10px] ${
                            u.plan.code === "ENTERPRISE"
                              ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                              : u.plan.code === "PREMIUM"
                              ? "border-purple-500/40 text-purple-300 bg-purple-500/10"
                              : "border-border/60 text-muted-foreground"
                          }`}
                        >
                          {u.plan.name}
                        </Badge>
                      </td>

                      {/* Puter Status */}
                      <td className="py-3.5 px-4">
                        {isPuter ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Connected</span>
                            </div>
                            {u.puterConnection.username && (
                              <span className="text-[10px] text-muted-foreground block">
                                @{u.puterConnection.username}
                              </span>
                            )}
                            {u.puterConnection.connectedSince && (
                              <span className="text-[9px] text-muted-foreground/60 block">
                                Since: {new Date(u.puterConnection.connectedSince).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                            <span>Not Connected</span>
                          </div>
                        )}
                      </td>

                      {/* Today's Token Quota & Compact Progress Bar */}
                      <td className="py-3.5 px-4 min-w-[220px]">
                        <div className="space-y-1.5">
                          <div className="flex items-baseline justify-between text-[11px]">
                            <span className="font-semibold text-foreground">
                              {usage.totalTokens.toLocaleString()}
                              <span className="font-normal text-muted-foreground text-[10px]"> / {usage.dailyLimit.toLocaleString()}</span>
                            </span>
                            <span className={`text-[10px] font-bold ${
                              pct >= 90 ? "text-rose-400" : pct >= 70 ? "text-amber-400" : "text-emerald-400"
                            }`}>
                              {pct}%
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden border border-border/40">
                            <div
                              className={`h-full transition-all duration-300 ${getProgressBarColor(pct)}`}
                              style={{ width: `${Math.min(100, Math.max(1, pct))}%` }}
                            />
                          </div>

                          {/* Provider breakdown hint */}
                          <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                            {usage.geminiTokens > 0 && <span>Gemini: {usage.geminiTokens.toLocaleString()}</span>}
                            {usage.puterTokens > 0 && <span>Puter: {usage.puterTokens.toLocaleString()}</span>}
                            {usage.totalTokens === 0 && <span>0 consumed today</span>}
                          </div>
                        </div>
                      </td>

                      {/* 7-Day Puter Calls */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            ✓ {u.puterConnection.sevenDaySuccessCalls}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
                            u.puterConnection.sevenDayFailedCalls > 0
                              ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                              : "text-muted-foreground/60 bg-muted/20 border-border/40"
                          }`}>
                            ✕ {u.puterConnection.sevenDayFailedCalls}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedUserId(u.id)}
                            className="h-7 text-xs font-mono border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
                          >
                            Details
                          </Button>
                          <Link href={ADMIN_UI_ROUTES.USER_DETAIL(u.id)}>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="flex items-center justify-between p-3 border-t border-border/60 bg-muted/20 text-xs font-mono text-muted-foreground">
          <span>
            Total: <span className="font-semibold text-foreground">{totalCount}</span> users
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2 font-mono text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 px-2 font-mono text-xs"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Drill-down Slideover Modal */}
      {selectedUserId && (
        <UserDetailSlideover
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onAssignSubscription={(uid) => {
            const adminKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
            const targetUrl = adminKey ? `${ADMIN_UI_ROUTES.PLANS}?admin_key=${encodeURIComponent(adminKey)}` : ADMIN_UI_ROUTES.PLANS;
            window.location.href = targetUrl;
          }}
        />
      )}
    </div>
  );
}

/**
 * Slideover Drill-down Component for instant user detail inspection
 */
function UserDetailSlideover({
  userId,
  onClose,
  onAssignSubscription,
}: {
  userId: string;
  onClose: () => void;
  onAssignSubscription?: (userId: string) => void;
}) {
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const adminKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
    const detailUrl = adminKey ? `${ADMIN_API_ROUTES.USER_DETAIL(userId)}?admin_key=${adminKey}` : ADMIN_API_ROUTES.USER_DETAIL(userId);
    fetch(detailUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) setDetail(data.user);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-card border-l border-border h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-400" />
            <h2 className="text-base font-bold font-mono text-foreground">
              User Telemetry Drill-down
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Link href={ADMIN_UI_ROUTES.USER_DETAIL(userId)} target="_blank">
              <Button size="sm" variant="outline" className="h-7 text-xs font-mono gap-1">
                Full Page <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground font-mono text-xs">
              <RotateCw className="h-6 w-6 animate-spin text-purple-400" />
              Loading live user telemetry and 7-day trend...
            </div>
          ) : !detail ? (
            <div className="py-12 text-center text-muted-foreground font-mono text-xs">
              Failed to load user detail.
            </div>
          ) : (
            <>
              {/* User Identity Banner */}
              <div className="p-4 rounded-xl border border-border/70 bg-muted/10 space-y-2.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-foreground">{detail.name || "Unnamed Tenant"}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {detail.role}
                  </Badge>
                </div>
                <div className="text-muted-foreground">{detail.email}</div>
                <div className="text-[11px] text-muted-foreground/70">
                  User ID: <span className="text-foreground">{detail.id}</span> • Member since: {new Date(detail.createdAt).toLocaleDateString()}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Active Plan:</span>
                    <Badge variant="outline" className="font-mono text-[10px] text-purple-300 border-purple-500/30">
                      {detail.plan.name} ({detail.plan.code})
                    </Badge>
                  </div>
                  {onAssignSubscription && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAssignSubscription(detail.id)}
                      className="h-6 text-[10px] font-mono border-purple-500/30 text-purple-300 hover:bg-purple-500/10 gap-1"
                    >
                      <UserCheck className="h-3 w-3 text-purple-400" />
                      Manage Subscription
                    </Button>
                  )}
                </div>
              </div>

              {/* 1. Puter Connection Status */}
              <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold font-mono text-foreground flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-400" />
                    1. PUTER CONNECTION STATUS
                  </h3>
                  {detail.puterConnection.isConnected ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-mono">
                      ✓ Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-[10px] font-mono">
                      ✕ Not Connected
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded bg-muted/20 border border-border/50">
                    <span className="text-[10px] text-muted-foreground block">Connected Since:</span>
                    <span className="text-foreground font-semibold">
                      {detail.puterConnection.connectedSince
                        ? new Date(detail.puterConnection.connectedSince).toLocaleString()
                        : "N/A (No active session)"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-muted/20 border border-border/50">
                    <span className="text-[10px] text-muted-foreground block">Puter Username:</span>
                    <span className="text-foreground font-semibold">
                      {detail.puterConnection.username ? `@${detail.puterConnection.username}` : "None"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded bg-emerald-500/5 border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 block">7-Day Successful Puter Calls:</span>
                    <span className="text-lg font-bold text-emerald-400">
                      {detail.puterConnection.sevenDaySuccessCalls}
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-rose-500/5 border border-rose-500/20">
                    <span className="text-[10px] text-rose-400 block">7-Day Quota-Exhausted / Failed Calls:</span>
                    <span className="text-lg font-bold text-rose-400">
                      {detail.puterConnection.sevenDayFailedCalls}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground/80 font-mono italic">
                  Note: Puter does not expose a remaining tokens balance via SDK. Visibility is tracked via logged execution telemetry and error states.
                </p>
              </div>

              {/* 2. Gemini BYOK Token Usage */}
              <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold font-mono text-foreground flex items-center gap-2">
                    <Key className="h-4 w-4 text-amber-400" />
                    2. GEMINI BYOK TOKEN USAGE
                  </h3>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Real Computed Tokens
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <span className="text-[10px] text-amber-400 block">Tokens Used Today:</span>
                    <span className="text-2xl font-bold text-foreground">
                      {detail.geminiUsage.tokensToday.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                    <span className="text-[10px] text-purple-400 block">Tokens Used This Month:</span>
                    <span className="text-2xl font-bold text-foreground">
                      {detail.geminiUsage.tokensThisMonth.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-muted/20 border border-border/50 text-[11px] font-mono flex items-center justify-between">
                  <span className="text-muted-foreground">Stored Gemini BYOK Key:</span>
                  <span className="text-foreground">
                    {detail.hasGeminiKey ? detail.maskedGeminiKey || "Configured (Masked)" : "None"}
                  </span>
                </div>
              </div>

              {/* 3. Plan Limit & 7-Day Usage Trend Bar Chart */}
              <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold font-mono text-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-400" />
                    3. PLAN LIMIT & 7-DAY USAGE TREND
                  </h3>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Plan: {detail.plan.name}
                  </Badge>
                </div>

                {/* Progress bar today */}
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs font-mono">
                    <span className="text-muted-foreground">
                      Today's Limit Consumption:
                    </span>
                    <span className="font-bold text-foreground">
                      {detail.dailyTokenLimit.usedToday.toLocaleString()} / {detail.dailyTokenLimit.limit.toLocaleString()} tokens ({detail.dailyTokenLimit.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted/60 h-2.5 rounded-full overflow-hidden border border-border/40">
                    <div
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(1, detail.dailyTokenLimit.percentage))}%` }}
                    />
                  </div>
                </div>

                {/* 7-Day Mini Bar Chart */}
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <span className="text-[11px] font-mono text-muted-foreground block">
                    7-Day Total AI Tokens Trend:
                  </span>

                  {/* SVG / Flex Mini Bar Chart */}
                  <div className="grid grid-cols-7 gap-2 h-28 items-end pt-2 pb-1 border-b border-border/40">
                    {detail.usageTrend7Days.map((day: any, idx: number) => {
                      // Max scale relative to daily limit or max in window
                      const maxWindow = Math.max(...detail.usageTrend7Days.map((d: any) => d.totalTokens), 100);
                      const barHeight = Math.max(6, Math.round((day.totalTokens / maxWindow) * 100));

                      return (
                        <div key={day.date} className="flex flex-col items-center gap-1 h-full justify-end group">
                          {/* Value tooltip */}
                          <span className="text-[9px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                            {day.totalTokens > 0 ? day.totalTokens.toLocaleString() : "0"}
                          </span>
                          {/* Bar */}
                          <div
                            className={`w-full max-w-[28px] rounded-t transition-all ${
                              day.dayLabel === "Today" ? "bg-purple-500 hover:bg-purple-400" : "bg-muted-foreground/30 hover:bg-purple-500/70"
                            }`}
                            style={{ height: `${barHeight}%` }}
                          />
                          {/* Day Label */}
                          <span className="text-[10px] font-mono text-muted-foreground text-center">
                            {day.dayLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 4. Recent AI Usage Events */}
              <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
                <h3 className="text-xs font-bold font-mono text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  4. RECENT AI USAGE EVENTS (REAL LOGS)
                </h3>

                {detail.recentEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-mono">No AI events logged for this user yet.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-1.5 font-mono text-[11px]">
                    {detail.recentEvents.slice(0, 10).map((ev: any) => (
                      <div key={ev.id} className="p-2 rounded bg-muted/20 border border-border/40 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-foreground">{ev.provider}</span>
                          <span className="text-muted-foreground text-[10px] ml-2">({ev.model})</span>
                          <span className="text-[10px] text-purple-400 block">{ev.operation}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-foreground">{ev.totalTokens} tokens</span>
                          <span className={`text-[9px] block ${
                            ev.status === "SUCCESS" ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {ev.status} • {new Date(ev.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
