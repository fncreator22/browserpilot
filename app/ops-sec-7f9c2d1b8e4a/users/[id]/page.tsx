"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { 
  Users, 
  ArrowLeft, 
  RotateCw, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  Key, 
  BarChart3, 
  Activity, 
  Clock, 
  AlertCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ADMIN_API_ROUTES, ADMIN_UI_ROUTES } from "@/lib/admin/adminRoutes";
import { UserCheck, Layers, CreditCard, Plus, Check } from "lucide-react";

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id as string;

  const [detail, setDetail] = useState<any | null>(null);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Subscription management dialog state
  const [showManageSub, setShowManageSub] = useState(false);
  const [subPlanCode, setSubPlanCode] = useState("PREMIUM");
  const [subInterval, setSubInterval] = useState<"MONTHLY" | "YEARLY" | "LIFETIME">("MONTHLY");
  const [subDurationDays, setSubDurationDays] = useState(30);
  const [subProvider, setSubProvider] = useState("MANUAL_ADMIN");
  const [subNotes, setSubNotes] = useState("");
  const [savingSub, setSavingSub] = useState(false);

  const fetchUserDetail = async (isManual = false) => {
    if (!userId) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const adminKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
      const detailUrl = adminKey ? `${ADMIN_API_ROUTES.USER_DETAIL(userId)}?admin_key=${adminKey}` : ADMIN_API_ROUTES.USER_DETAIL(userId);
      const subUrl = adminKey ? `${ADMIN_API_ROUTES.USER_SUBSCRIPTION(userId)}?admin_key=${adminKey}` : ADMIN_API_ROUTES.USER_SUBSCRIPTION(userId);

      const [userRes, subRes] = await Promise.all([
        fetch(detailUrl),
        fetch(subUrl).catch(() => null),
      ]);

      if (!userRes.ok) {
        throw new Error(`Failed to load user detail (HTTP ${userRes.status})`);
      }
      const data = await userRes.json();
      setDetail(data.user);

      if (subRes && subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData.currentSubscription || null);
      }

      if (isManual) toast.success("Live user telemetry & subscription refreshed");
    } catch (err: any) {
      toast.error(err.message || "Failed to load user details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSub(true);
    try {
      const adminKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
      const subUrl = adminKey ? `${ADMIN_API_ROUTES.USER_SUBSCRIPTION(userId)}?admin_key=${adminKey}` : ADMIN_API_ROUTES.USER_SUBSCRIPTION(userId);

      const res = await fetch(subUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: subPlanCode,
          billingInterval: subInterval,
          durationDays: subDurationDays,
          paymentProvider: subProvider,
          notes: subNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to assign subscription.");
      }

      const resData = await res.json();
      toast.success(resData.message || "Subscription updated successfully!");
      setShowManageSub(false);
      await fetchUserDetail(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to save subscription");
    } finally {
      setSavingSub(false);
    }
  };

  useEffect(() => {
    fetchUserDetail();
  }, [userId]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground font-mono text-sm">
        <RotateCw className="h-6 w-6 animate-spin text-purple-400" />
        Loading live user telemetry and token trends...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="py-16 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <h2 className="text-lg font-bold text-foreground">User Not Found</h2>
        <p className="text-sm text-muted-foreground font-mono">The requested tenant ID could not be located in the database.</p>
        <Link href={ADMIN_UI_ROUTES.USERS}>
          <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Users List
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Link href={ADMIN_UI_ROUTES.USERS}>
            <Button variant="outline" size="sm" className="h-8 font-mono text-xs gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Users
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              {detail.name || "Tenant Profile"}
            </h1>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="text-foreground font-semibold">{detail.email}</span>
              <span>•</span>
              <span>Live Telemetry & Trends</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUserDetail(true)}
            disabled={refreshing}
            className="font-mono text-xs gap-1.5 border-border/80 hover:border-purple-500/40"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-purple-400" : ""}`} />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* User Identity Banner */}
      <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-2 font-mono text-xs shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-foreground">{detail.name || "Unnamed Tenant"}</span>
            <Badge variant="outline" className="font-mono text-[10px] border-purple-500/40 text-purple-300">
              {detail.role}
            </Badge>
            <Badge 
              variant="outline" 
              className={`font-mono text-[10px] ${
                detail.plan.code === "ENTERPRISE"
                  ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                  : detail.plan.code === "PREMIUM"
                  ? "border-purple-500/40 text-purple-300 bg-purple-500/10"
                  : "border-border/60 text-muted-foreground"
              }`}
            >
              Plan: {detail.plan.name}
            </Badge>
          </div>
          <div className="text-muted-foreground text-[11px]">
            Account Created: <span className="text-foreground">{new Date(detail.createdAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="text-muted-foreground">
          Email: <span className="text-foreground">{detail.email}</span> • User ID: <span className="text-foreground">{detail.id}</span>
        </div>
      </div>

      {/* Grid: Puter Connection & Gemini BYOK */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Puter Connection Status */}
        <div className="p-5 rounded-xl border border-border/70 bg-card/60 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-mono text-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-400" />
              1. PUTER CONNECTION STATUS
            </h2>
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
            <div className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-1">
              <span className="text-[10px] text-muted-foreground block">Connected Since:</span>
              <span className="text-foreground font-semibold">
                {detail.puterConnection.connectedSince
                  ? new Date(detail.puterConnection.connectedSince).toLocaleString()
                  : "N/A (Not Connected)"}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-1">
              <span className="text-[10px] text-muted-foreground block">Puter Username:</span>
              <span className="text-foreground font-semibold">
                {detail.puterConnection.username ? `@${detail.puterConnection.username}` : "None"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1">
              <span className="text-[10px] text-emerald-400 block">7-Day Successful Puter Calls:</span>
              <span className="text-2xl font-bold text-emerald-400">
                {detail.puterConnection.sevenDaySuccessCalls}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 space-y-1">
              <span className="text-[10px] text-rose-400 block">7-Day Quota-Exhausted / Failed:</span>
              <span className="text-2xl font-bold text-rose-400">
                {detail.puterConnection.sevenDayFailedCalls}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400/60" />
            <span>Telemetry reflects real logged executions & error events</span>
          </div>
        </div>

        {/* 2. Gemini BYOK Token Usage */}
        <div className="p-5 rounded-xl border border-border/70 bg-card/60 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-mono text-foreground flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-400" />
              2. GEMINI BYOK TOKEN USAGE
            </h2>
            <Badge variant="outline" className="font-mono text-[10px]">
              Real Computed Tokens
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1">
              <span className="text-[10px] text-amber-400 block">Tokens Used Today:</span>
              <span className="text-3xl font-bold text-foreground">
                {detail.geminiUsage.tokensToday.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                Since midnight UTC
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-1">
              <span className="text-[10px] text-purple-400 block">Tokens Used This Month:</span>
              <span className="text-3xl font-bold text-foreground">
                {detail.geminiUsage.tokensThisMonth.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                Current calendar month
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/20 border border-border/50 text-xs font-mono flex items-center justify-between">
            <span className="text-muted-foreground">Stored Gemini BYOK Key:</span>
            <span className="text-foreground font-semibold">
              {detail.hasGeminiKey ? detail.maskedGeminiKey || "Configured (Masked)" : "No BYOK Key Configured"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Subscription Status & Tier Management */}
      <div className="p-5 rounded-xl border border-border/70 bg-card/60 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold font-mono text-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-purple-400" />
            3. SUBSCRIPTION STATUS & TIER MANAGEMENT
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowManageSub(!showManageSub)}
            className="font-mono text-xs gap-1.5 border-purple-500/40 text-purple-300 hover:bg-purple-500/10 h-7"
          >
            <UserCheck className="h-3.5 w-3.5" />
            {showManageSub ? "Close Editor" : "Manage / Assign Subscription"}
          </Button>
        </div>

        {/* Current Subscription Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-1">
            <span className="text-[10px] text-muted-foreground block">Active Plan Tier:</span>
            <span className="text-foreground font-bold text-sm block">
              {subscription?.plan?.name || detail.plan.name}
            </span>
            <Badge variant="outline" className="text-[9px] font-mono">
              {subscription?.plan?.code || detail.plan.code}
            </Badge>
          </div>

          <div className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-1">
            <span className="text-[10px] text-muted-foreground block">Subscription Status:</span>
            <Badge className={`text-[10px] font-mono mt-1 ${
              (subscription?.status === "ACTIVE")
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-muted text-muted-foreground"
            }`}>
              {subscription?.status || "DEFAULT_FREE"}
            </Badge>
          </div>

          <div className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-1">
            <span className="text-[10px] text-muted-foreground block">Billing Interval:</span>
            <span className="text-foreground font-semibold block mt-1">
              {subscription?.billingInterval || "MONTHLY"}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-1">
            <span className="text-[10px] text-muted-foreground block">Current Period End:</span>
            <span className="text-foreground font-semibold block mt-1">
              {subscription?.currentPeriodEnd
                ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                : "No expiration / Ongoing"}
            </span>
          </div>
        </div>

        {/* Inline Manage Subscription Form */}
        {showManageSub && (
          <form onSubmit={handleSaveSubscription} className="p-4 rounded-xl border border-purple-500/30 bg-purple-950/15 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-xs font-mono font-bold text-foreground">
                Assign / Upgrade Tenant Subscription
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                Deactivates previous active plans
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground block">
                  Target Plan Tier:
                </label>
                <select
                  value={subPlanCode}
                  onChange={(e) => setSubPlanCode(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-border/80 bg-background/80 text-xs font-mono text-foreground"
                >
                  <option value="FREE">Starter / Community (FREE)</option>
                  <option value="PREMIUM">BrowserPilot Pro Hunter (PREMIUM)</option>
                  <option value="ENTERPRISE">Enterprise Fleet (ENTERPRISE)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground block">
                  Billing Interval:
                </label>
                <select
                  value={subInterval}
                  onChange={(e) => {
                    const val = e.target.value as "MONTHLY" | "YEARLY" | "LIFETIME";
                    setSubInterval(val);
                    setSubDurationDays(val === "YEARLY" ? 365 : val === "LIFETIME" ? 3650 : 30);
                  }}
                  className="w-full h-8 px-2 rounded-md border border-border/80 bg-background/80 text-xs font-mono text-foreground"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                  <option value="LIFETIME">Lifetime / Comp</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground block">
                  Duration (Days):
                </label>
                <Input
                  type="number"
                  min="1"
                  max="3650"
                  value={subDurationDays}
                  onChange={(e) => setSubDurationDays(parseInt(e.target.value, 10) || 30)}
                  className="h-8 font-mono text-xs bg-background/50 border-border"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground block">
                  Provider / Audit Tag:
                </label>
                <select
                  value={subProvider}
                  onChange={(e) => setSubProvider(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-border/80 bg-background/80 text-xs font-mono text-foreground"
                >
                  <option value="MANUAL_ADMIN">MANUAL_ADMIN</option>
                  <option value="PROMOTIONAL_GRANT">PROMOTIONAL_GRANT</option>
                  <option value="VIP_COMP">VIP_COMP</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground block">
                Internal Audit Note (optional):
              </label>
              <Input
                type="text"
                placeholder="Reason for assignment (e.g. VIP comp, special billing agreement)"
                value={subNotes}
                onChange={(e) => setSubNotes(e.target.value)}
                className="h-8 font-mono text-xs bg-background/50 border-border"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowManageSub(false)}
                className="h-7 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingSub}
                className="h-7 text-xs font-mono bg-purple-600 hover:bg-purple-700 text-white gap-1"
              >
                {savingSub ? (
                  <>
                    <RotateCw className="h-3 w-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3" />
                    Save & Apply Subscription
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* 4. Plan Limit & 7-Day Usage Trend Bar Chart */}
      <div className="p-5 rounded-xl border border-border/70 bg-card/60 space-y-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold font-mono text-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-400" />
            4. PLAN LIMIT & 7-DAY USAGE TREND
          </h2>
          <Badge variant="outline" className="font-mono text-xs">
            Configured Limit: {detail.dailyTokenLimit.limit.toLocaleString()} tokens/day
          </Badge>
        </div>

        {/* Progress bar today */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-xs font-mono">
            <span className="text-muted-foreground">
              Today's Daily Quota Consumption:
            </span>
            <span className="font-bold text-foreground">
              {detail.dailyTokenLimit.usedToday.toLocaleString()} / {detail.dailyTokenLimit.limit.toLocaleString()} tokens ({detail.dailyTokenLimit.percentage}%)
            </span>
          </div>
          <div className="w-full bg-muted/60 h-3 rounded-full overflow-hidden border border-border/40">
            <div
              className={`h-full transition-all duration-300 ${
                detail.dailyTokenLimit.percentage >= 90
                  ? "bg-rose-500"
                  : detail.dailyTokenLimit.percentage >= 70
                  ? "bg-amber-500"
                  : "bg-purple-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(1, detail.dailyTokenLimit.percentage))}%` }}
            />
          </div>
        </div>

        {/* 7-Day Mini Bar Chart */}
        <div className="space-y-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground block">
              7-Day Total AI Token Usage Trend (Daily Breakdown):
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              Relative to 7-day peak
            </span>
          </div>

          <div className="grid grid-cols-7 gap-3 h-36 items-end pt-4 pb-2 border-b border-border/40 px-2">
            {detail.usageTrend7Days.map((day: any) => {
              const maxWindow = Math.max(...detail.usageTrend7Days.map((d: any) => d.totalTokens), 100);
              const barHeight = Math.max(8, Math.round((day.totalTokens / maxWindow) * 100));

              return (
                <div key={day.date} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                  {/* Tooltip value */}
                  <span className="text-[10px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    {day.totalTokens > 0 ? day.totalTokens.toLocaleString() : "0"}
                  </span>
                  {/* Bar */}
                  <div
                    className={`w-full max-w-[36px] rounded-t transition-all ${
                      day.dayLabel === "Today" ? "bg-purple-500 hover:bg-purple-400" : "bg-muted-foreground/30 hover:bg-purple-500/70"
                    }`}
                    style={{ height: `${barHeight}%` }}
                  />
                  {/* Day Label */}
                  <span className="text-xs font-mono text-muted-foreground text-center">
                    {day.dayLabel}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground/60 -mt-1">
                    {day.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Recent AI Usage Events Table */}
      <div className="p-5 rounded-xl border border-border/70 bg-card/60 space-y-4 shadow-sm">
        <h2 className="text-sm font-bold font-mono text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          5. RECENT AI USAGE EVENTS (REAL LOGS)
        </h2>

        {detail.recentEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono py-4">No AI events logged for this user yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-border/70 bg-muted/30 text-[10px] text-muted-foreground uppercase">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Provider</th>
                  <th className="py-2.5 px-3">Model</th>
                  <th className="py-2.5 px-3">Operation</th>
                  <th className="py-2.5 px-3 text-right">Tokens (Total)</th>
                  <th className="py-2.5 px-3 text-right">Duration</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {detail.recentEvents.map((ev: any) => (
                  <tr key={ev.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-3 text-muted-foreground">
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-semibold text-foreground">
                      {ev.provider}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {ev.model}
                    </td>
                    <td className="py-2 px-3 text-purple-400">
                      {ev.operation}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-foreground">
                      {ev.totalTokens.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-muted-foreground">
                      {ev.durationMs}ms
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        ev.status === "SUCCESS"
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                      }`}>
                        {ev.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
