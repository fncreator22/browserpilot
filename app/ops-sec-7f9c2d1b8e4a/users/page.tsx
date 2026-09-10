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

  // Monetization suite tab state
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [activeSuiteTab, setActiveSuiteTab] = useState<"tiers" | "coupons" | "assign">("tiers");

  // Plan tiers state
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [editingPlanData, setEditingPlanData] = useState<Record<string, {
    dailyTokenLimit: number;
    priceMonthly: number;
    priceYearly: number;
    description: string;
    features: string[];
    newFeatureInput: string;
  }>>({});
  const [savingPlanCode, setSavingPlanCode] = useState<string | null>(null);

  // Coupons state
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [creatingCoupon, setCreatingCoupon] = useState(false);
  const [togglingCouponId, setTogglingCouponId] = useState<string | null>(null);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    description: "",
    discountType: "PERCENTAGE",
    discountValue: 20,
    targetPlanCode: "ALL",
    maxRedemptions: 100,
    validFrom: new Date().toISOString().split("T")[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    active: true,
  });

  // Manual subscription assignment state
  const [assignTargetUserId, setAssignTargetUserId] = useState<string>("");
  const [assignPlanCode, setAssignPlanCode] = useState<string>("PREMIUM");
  const [assignInterval, setAssignInterval] = useState<"MONTHLY" | "YEARLY" | "LIFETIME">("MONTHLY");
  const [assignDurationDays, setAssignDurationDays] = useState<number>(30);
  const [assignProvider, setAssignProvider] = useState<string>("MANUAL_ADMIN");
  const [assignNotes, setAssignNotes] = useState<string>("");
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  // Drill-down slideover
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const fetchPlans = async () => {
    try {
      const adminKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
      const plansUrl = adminKey ? `${ADMIN_API_ROUTES.PLANS}?admin_key=${adminKey}` : ADMIN_API_ROUTES.PLANS;
      const res = await fetch(plansUrl);
      if (res.ok) {
        const data = await res.json();
        const loadedPlans: PlanConfig[] = data.plans || [];
        setPlans(loadedPlans);
        
        const initialEdits: Record<string, any> = {};
        for (const p of loadedPlans) {
          initialEdits[p.code] = {
            dailyTokenLimit: p.dailyTokenLimit,
            priceMonthly: p.priceMonthly,
            priceYearly: p.priceYearly || 0,
            description: p.description || "",
            features: Array.isArray(p.features) ? [...p.features] : [],
            newFeatureInput: "",
          };
        }
        setEditingPlanData(initialEdits);
      }
    } catch (err) {
      console.error("Failed to load plans:", err);
    }
  };

  const fetchCoupons = async () => {
    setLoadingCoupons(true);
    try {
      const adminKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
      const couponsUrl = adminKey ? `${ADMIN_API_ROUTES.COUPONS}?admin_key=${adminKey}` : ADMIN_API_ROUTES.COUPONS;
      const res = await fetch(couponsUrl);
      if (res.ok) {
        const data = await res.json();
        setCoupons(data.coupons || []);
      }
    } catch (err) {
      console.error("Failed to load coupons:", err);
    } finally {
      setLoadingCoupons(false);
    }
  };

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
    fetchPlans();
    fetchCoupons();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [page, puterFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleSavePlanTier = async (planCode: string) => {
    const edit = editingPlanData[planCode];
    if (!edit) return;

    if (edit.dailyTokenLimit < 1000) {
      toast.error("Daily token limit must be at least 1,000.");
      return;
    }

    setSavingPlanCode(planCode);
    try {
      const adminKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
      const plansUrl = adminKey ? `${ADMIN_API_ROUTES.PLANS}?admin_key=${adminKey}` : ADMIN_API_ROUTES.PLANS;
      const res = await fetch(plansUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode,
          dailyTokenLimit: edit.dailyTokenLimit,
          priceMonthly: edit.priceMonthly,
          priceYearly: edit.priceYearly,
          description: edit.description,
          features: edit.features,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update plan tier.");
      }

      toast.success(`Updated plan "${planCode}" pricing, features & limits.`);
      await fetchPlans();
      await fetchUsers(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to save plan tier");
    } finally {
      setSavingPlanCode(null);
    }
  };

  const handleAddFeature = (planCode: string) => {
    const edit = editingPlanData[planCode];
    if (!edit || !edit.newFeatureInput?.trim()) return;

    const updatedFeatures = [...edit.features, edit.newFeatureInput.trim()];
    setEditingPlanData((prev) => ({
      ...prev,
      [planCode]: {
        ...prev[planCode],
        features: updatedFeatures,
        newFeatureInput: "",
      },
    }));
  };

  const handleRemoveFeature = (planCode: string, indexToRemove: number) => {
    const edit = editingPlanData[planCode];
    if (!edit) return;

    const updatedFeatures = edit.features.filter((_, idx) => idx !== indexToRemove);
    setEditingPlanData((prev) => ({
      ...prev,
      [planCode]: {
        ...prev[planCode],
        features: updatedFeatures,
      },
    }));
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupon.code.trim()) {
      toast.error("Coupon code is required");
      return;
    }
    setCreatingCoupon(true);
    try {
      const adminKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
      const couponsUrl = adminKey ? `${ADMIN_API_ROUTES.COUPONS}?admin_key=${adminKey}` : ADMIN_API_ROUTES.COUPONS;
      const res = await fetch(couponsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCoupon.code.trim().toUpperCase(),
          description: newCoupon.description.trim() || undefined,
          discountType: newCoupon.discountType,
          discountValue: Number(newCoupon.discountValue),
          targetPlanCode: newCoupon.targetPlanCode === "ALL" ? undefined : newCoupon.targetPlanCode,
          maxRedemptions: Number(newCoupon.maxRedemptions),
          validFrom: newCoupon.validFrom ? new Date(newCoupon.validFrom).toISOString() : undefined,
          validUntil: newCoupon.validUntil ? new Date(newCoupon.validUntil).toISOString() : undefined,
          active: newCoupon.active,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to create coupon");
      }

      toast.success(`Promotional coupon ${newCoupon.code.toUpperCase()} created successfully!`);
      setNewCoupon({
        code: "",
        description: "",
        discountType: "PERCENTAGE",
        discountValue: 20,
        targetPlanCode: "ALL",
        maxRedemptions: 100,
        validFrom: new Date().toISOString().split("T")[0],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        active: true,
      });
      await fetchCoupons();
    } catch (err: any) {
      toast.error(err.message || "Failed to create coupon");
    } finally {
      setCreatingCoupon(false);
    }
  };

  const handleToggleCoupon = async (couponId: string, currentActive: boolean) => {
    setTogglingCouponId(couponId);
    try {
      const adminKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
      const url = adminKey ? `${ADMIN_API_ROUTES.COUPONS}/${couponId}?admin_key=${adminKey}` : `${ADMIN_API_ROUTES.COUPONS}/${couponId}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });

      if (!res.ok) {
        throw new Error("Failed to update coupon status");
      }

      toast.success(`Coupon marked as ${!currentActive ? "Active" : "Disabled"}`);
      setCoupons((prev) => prev.map((c) => (c.id === couponId ? { ...c, active: !currentActive } : c)));
    } catch (err: any) {
      toast.error(err.message || "Failed updating coupon");
    } finally {
      setTogglingCouponId(null);
    }
  };

  const handleAssignSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetUserId) {
      toast.error("Please select a target user.");
      return;
    }

    setSubmittingAssignment(true);
    try {
      const adminKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
      const url = adminKey ? `${ADMIN_API_ROUTES.USER_SUBSCRIPTION(assignTargetUserId)}?admin_key=${adminKey}` : ADMIN_API_ROUTES.USER_SUBSCRIPTION(assignTargetUserId);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: assignPlanCode,
          billingInterval: assignInterval,
          durationDays: Number(assignDurationDays) || undefined,
          paymentProvider: assignProvider,
          notes: assignNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to assign subscription");
      }

      const data = await res.json();
      toast.success(data.message || "Subscription successfully assigned!");
      setAssignNotes("");
      await fetchUsers(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to assign subscription");
    } finally {
      setSubmittingAssignment(false);
    }
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = !showConfigPanel;
              setShowConfigPanel(next);
              if (next && coupons.length === 0) {
                fetchCoupons();
              }
            }}
            className="font-mono text-xs gap-1.5 border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
          >
            <Layers className="h-3.5 w-3.5 text-purple-400" />
            {showConfigPanel ? "Hide Monetization Suite" : "Plans, Subscriptions & Coupons"}
          </Button>
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

      {/* Plans, Subscriptions & Coupons Suite (Collapsible) */}
      {showConfigPanel && (
        <div className="p-5 rounded-xl border border-purple-500/30 bg-purple-950/15 backdrop-blur-md space-y-5 animate-in fade-in slide-in-from-top-2 duration-200 shadow-md">
          {/* Header with Title and Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground font-mono">
                  Plans, Subscriptions & Coupons Suite
                </h2>
                <p className="text-[11px] font-mono text-muted-foreground">
                  Configure plan pricing, rich textual feature offerings, promotional single-use coupons, and user subscriptions
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60 font-mono text-xs">
              <button
                type="button"
                onClick={() => setActiveSuiteTab("tiers")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeSuiteTab === "tiers"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Plan Tiers & Features
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveSuiteTab("coupons");
                  if (coupons.length === 0) fetchCoupons();
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeSuiteTab === "coupons"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Tag className="h-3.5 w-3.5" />
                Coupons ({coupons.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSuiteTab("assign")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeSuiteTab === "assign"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Assign Subscription
              </button>
            </div>
          </div>

          {/* TAB 1: Plan Tiers & Features Matrix */}
          {activeSuiteTab === "tiers" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {plans.map((p) => {
                  const edit = editingPlanData[p.code] || {
                    dailyTokenLimit: p.dailyTokenLimit,
                    priceMonthly: p.priceMonthly,
                    priceYearly: p.priceYearly || 0,
                    description: p.description || "",
                    features: p.features || [],
                    newFeatureInput: "",
                  };

                  const annualMonthlyCost = edit.priceMonthly * 12;
                  const yearlySavings = annualMonthlyCost > 0 ? annualMonthlyCost - edit.priceYearly : 0;
                  const savingsPct = annualMonthlyCost > 0 ? Math.round((yearlySavings / annualMonthlyCost) * 100) : 0;

                  return (
                    <div
                      key={p.code}
                      className="p-4 rounded-xl border border-border/70 bg-card/80 space-y-3.5 flex flex-col justify-between shadow-sm"
                    >
                      <div className="space-y-3">
                        {/* Card Header */}
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <div>
                            <span className="font-mono font-bold text-sm text-foreground block">
                              {p.name}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              Currency: {p.currency}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`font-mono text-[10px] ${
                              p.code === "ENTERPRISE"
                                ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                                : p.code === "PREMIUM"
                                ? "border-purple-500/40 text-purple-300 bg-purple-500/10"
                                : "border-border/60 text-muted-foreground"
                            }`}
                          >
                            {p.code}
                          </Badge>
                        </div>

                        {/* Pricing Configuration */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-muted-foreground block">
                              Monthly Fee ($):
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={edit.priceMonthly}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setEditingPlanData((prev) => ({
                                  ...prev,
                                  [p.code]: {
                                    ...prev[p.code],
                                    priceMonthly: isNaN(val) ? 0 : val,
                                  },
                                }));
                              }}
                              className="h-8 font-mono text-xs bg-background/50 border-border"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-muted-foreground block">
                              Yearly Fee ($):
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="5"
                              value={edit.priceYearly}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setEditingPlanData((prev) => ({
                                  ...prev,
                                  [p.code]: {
                                    ...prev[p.code],
                                    priceYearly: isNaN(val) ? 0 : val,
                                  },
                                }));
                              }}
                              className="h-8 font-mono text-xs bg-background/50 border-border"
                            />
                          </div>
                        </div>

                        {/* Annual Savings Badge */}
                        <div className="text-[10px] font-mono">
                          {edit.priceMonthly === 0 ? (
                            <span className="text-muted-foreground">Free Forever Community Tier</span>
                          ) : savingsPct > 0 ? (
                            <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 inline-block font-semibold">
                              Save ${yearlySavings}/yr ({savingsPct}% annual discount)
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Yearly rate: ${(edit.priceYearly / 12).toFixed(1)}/mo equivalent
                            </span>
                          )}
                        </div>

                        {/* Daily Token Limit */}
                        <div className="space-y-1 pt-1">
                          <label className="text-[10px] font-mono text-muted-foreground block">
                            Daily AI Token Quota:
                          </label>
                          <Input
                            type="number"
                            min="1000"
                            step="5000"
                            value={edit.dailyTokenLimit}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setEditingPlanData((prev) => ({
                                ...prev,
                                [p.code]: {
                                  ...prev[p.code],
                                  dailyTokenLimit: isNaN(val) ? 0 : val,
                                },
                              }));
                            }}
                            className="h-8 font-mono text-xs bg-background/50 border-border"
                          />
                          <span className="text-[9px] font-mono text-muted-foreground block">
                            Active in engine: {p.dailyTokenLimit.toLocaleString()} tokens/day
                          </span>
                        </div>

                        {/* Textual Features Offering */}
                        <div className="space-y-1.5 pt-1 border-t border-border/50">
                          <label className="text-[10px] font-mono font-semibold text-foreground block">
                            Included Plan Features (Textual Offering):
                          </label>
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                            {edit.features.map((feat, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-1 p-1.5 rounded bg-muted/20 text-[11px] font-mono text-foreground border border-border/40"
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                                  <span className="truncate">{feat}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFeature(p.code, idx)}
                                  className="text-muted-foreground hover:text-rose-400 p-0.5"
                                  title="Remove feature bullet"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Add feature input */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <Input
                              type="text"
                              placeholder="Add feature offering bullet..."
                              value={edit.newFeatureInput || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditingPlanData((prev) => ({
                                  ...prev,
                                  [p.code]: {
                                    ...prev[p.code],
                                    newFeatureInput: val,
                                  },
                                }));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddFeature(p.code);
                                }
                              }}
                              className="h-7 text-[11px] font-mono bg-background/50 border-border"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => handleAddFeature(p.code)}
                              className="h-7 px-2 text-[10px] font-mono shrink-0 gap-1"
                            >
                              <Plus className="h-3 w-3" /> Add
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Save Button */}
                      <Button
                        size="sm"
                        disabled={savingPlanCode === p.code}
                        onClick={() => handleSavePlanTier(p.code)}
                        className="w-full h-8 font-mono text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1 mt-2"
                      >
                        {savingPlanCode === p.code ? (
                          <>
                            <RotateCw className="h-3 w-3 animate-spin" />
                            Saving Tier...
                          </>
                        ) : (
                          <>
                            <Save className="h-3 w-3" />
                            Save {p.name}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Coupons Management */}
          {activeSuiteTab === "coupons" && (
            <div className="space-y-6">
              {/* Form: Create Promotional Coupon */}
              <div className="p-4 rounded-xl border border-border/70 bg-card/70 space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-purple-400" />
                    <h3 className="text-xs font-bold font-mono text-foreground uppercase tracking-wide">
                      Create Promotional Coupon
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono text-purple-300 border-purple-500/30">
                    Single-Use Guaranteed
                  </Badge>
                </div>

                <form onSubmit={handleCreateCoupon} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Code */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-muted-foreground block">
                        Coupon Code:
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. VIPHUNTER2026"
                        value={newCoupon.code}
                        onChange={(e) =>
                          setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })
                        }
                        className="h-8 font-mono text-xs uppercase bg-background/50 border-border"
                        required
                      />
                    </div>

                    {/* Discount Type */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-muted-foreground block">
                        Discount Type:
                      </label>
                      <select
                        value={newCoupon.discountType}
                        onChange={(e) =>
                          setNewCoupon({ ...newCoupon, discountType: e.target.value })
                        }
                        className="w-full h-8 px-2 rounded-md border border-border/80 bg-background/80 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
                      >
                        <option value="PERCENTAGE">Percentage (% Off)</option>
                        <option value="FIXED_AMOUNT">Fixed Amount ($ Off)</option>
                        <option value="PLAN_ACCESS">Full Plan Access (100%)</option>
                      </select>
                    </div>

                    {/* Discount Value */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-muted-foreground block">
                        Discount Value:
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={newCoupon.discountValue}
                        onChange={(e) =>
                          setNewCoupon({
                            ...newCoupon,
                            discountValue: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="h-8 font-mono text-xs bg-background/50 border-border"
                        required
                      />
                    </div>

                    {/* Target Plan */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-muted-foreground block">
                        Applicable Plan Tier:
                      </label>
                      <select
                        value={newCoupon.targetPlanCode}
                        onChange={(e) =>
                          setNewCoupon({ ...newCoupon, targetPlanCode: e.target.value })
                        }
                        className="w-full h-8 px-2 rounded-md border border-border/80 bg-background/80 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
                      >
                        <option value="ALL">All Active Plans</option>
                        {plans.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name} ({p.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Max Global Redemptions */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-muted-foreground block">
                        Total Redemptions Cap:
                      </label>
                      <Input
                        type="number"
                        min="1"
                        step="10"
                        value={newCoupon.maxRedemptions}
                        onChange={(e) =>
                          setNewCoupon({
                            ...newCoupon,
                            maxRedemptions: parseInt(e.target.value, 10) || 100,
                          })
                        }
                        className="h-8 font-mono text-xs bg-background/50 border-border"
                      />
                    </div>

                    {/* Activation Date */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-muted-foreground block">
                        Activation Date (validFrom):
                      </label>
                      <Input
                        type="date"
                        value={newCoupon.validFrom}
                        onChange={(e) =>
                          setNewCoupon({ ...newCoupon, validFrom: e.target.value })
                        }
                        className="h-8 font-mono text-xs bg-background/50 border-border"
                      />
                    </div>

                    {/* Expiry Date */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-muted-foreground block">
                        Expiry Date (validUntil):
                      </label>
                      <Input
                        type="date"
                        value={newCoupon.validUntil}
                        onChange={(e) =>
                          setNewCoupon({ ...newCoupon, validUntil: e.target.value })
                        }
                        className="h-8 font-mono text-xs bg-background/50 border-border"
                      />
                    </div>
                  </div>

                  {/* Single-Use Guarantee Callout */}
                  <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/15 flex items-start gap-2.5 text-xs font-mono">
                    <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-semibold text-emerald-300 block">
                        Single-Use per Account Verified & Protected
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Each user account can redeem a coupon strictly once (enforced at the database constraint level). If an error occurs prior to account upgrade, the entire transaction rolls back cleanly so the coupon remains valid for seamless re-application.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={creatingCoupon}
                      className="font-mono text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
                    >
                      {creatingCoupon ? (
                        <>
                          <RotateCw className="h-3.5 w-3.5 animate-spin" />
                          Creating Coupon...
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          Create Coupon
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Table: Active Coupons */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-semibold text-foreground uppercase">
                    Configured Platform Coupons ({coupons.length})
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchCoupons}
                    disabled={loadingCoupons}
                    className="h-7 font-mono text-xs gap-1"
                  >
                    <RotateCw className={`h-3 w-3 ${loadingCoupons ? "animate-spin" : ""}`} />
                    Refresh Coupons
                  </Button>
                </div>

                {loadingCoupons ? (
                  <div className="py-8 text-center text-muted-foreground font-mono text-xs flex items-center justify-center gap-2">
                    <RotateCw className="h-4 w-4 animate-spin text-purple-400" />
                    Loading coupons...
                  </div>
                ) : coupons.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-border/70 rounded-xl text-xs font-mono text-muted-foreground">
                    No promotional coupons created yet. Use the form above to configure a coupon.
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden">
                    <table className="w-full text-left text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-border/70 bg-muted/30 text-[10px] text-muted-foreground uppercase">
                          <th className="py-2.5 px-3">Code</th>
                          <th className="py-2.5 px-3">Discount</th>
                          <th className="py-2.5 px-3">Target Tier</th>
                          <th className="py-2.5 px-3">Usage (Redeemed / Max)</th>
                          <th className="py-2.5 px-3">Active Window</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {coupons.map((c) => (
                          <tr key={c.id} className="hover:bg-muted/15 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-foreground bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30">
                                {c.code}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-foreground">
                                {c.discountType === "PERCENTAGE"
                                  ? `${c.discountValue}% OFF`
                                  : c.discountType === "FIXED_AMOUNT"
                                  ? `$${c.discountValue} OFF`
                                  : "FULL ACCESS"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {c.targetPlanCode || "ALL PLANS"}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-foreground font-semibold">
                                {c.redemptionCount} / {c.maxRedemptions > 0 ? c.maxRedemptions : "Unlimited"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-muted-foreground">
                              {c.validFrom ? new Date(c.validFrom).toLocaleDateString() : "Now"} →{" "}
                              {c.validUntil ? new Date(c.validUntil).toLocaleDateString() : "Never"}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                size="sm"
                                variant={c.active ? "default" : "outline"}
                                disabled={togglingCouponId === c.id}
                                onClick={() => handleToggleCoupon(c.id, c.active)}
                                className={`h-6 px-2 text-[10px] font-mono ${
                                  c.active
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    : "border-border text-muted-foreground"
                                }`}
                              >
                                {c.active ? "Active" : "Disabled"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Assign Subscription Directly */}
          {activeSuiteTab === "assign" && (
            <div className="p-4 rounded-xl border border-border/70 bg-card/70 space-y-4">
              <div className="border-b border-border/60 pb-2">
                <h3 className="text-xs font-bold font-mono text-foreground uppercase tracking-wide flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-purple-400" />
                  Direct User Subscription Assignment
                </h3>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  Grant or upgrade any tenant's subscription tier. Prior subscriptions are atomically deactivated.
                </p>
              </div>

              <form onSubmit={handleAssignSubscription} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Select User */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-muted-foreground block">
                      Target Tenant / User:
                    </label>
                    <select
                      value={assignTargetUserId}
                      onChange={(e) => setAssignTargetUserId(e.target.value)}
                      required
                      className="w-full h-8 px-2 rounded-md border border-border/80 bg-background/80 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="">-- Choose User --</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || "Tenant"} ({u.email}) [{u.plan.code}]
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Plan Tier */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-muted-foreground block">
                      Target Plan Tier:
                    </label>
                    <select
                      value={assignPlanCode}
                      onChange={(e) => setAssignPlanCode(e.target.value)}
                      className="w-full h-8 px-2 rounded-md border border-border/80 bg-background/80 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      {plans.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Billing Interval */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-muted-foreground block">
                      Billing Interval:
                    </label>
                    <select
                      value={assignInterval}
                      onChange={(e) => {
                        const interval = e.target.value as "MONTHLY" | "YEARLY" | "LIFETIME";
                        setAssignInterval(interval);
                        setAssignDurationDays(interval === "YEARLY" ? 365 : interval === "LIFETIME" ? 3650 : 30);
                      }}
                      className="w-full h-8 px-2 rounded-md border border-border/80 bg-background/80 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="MONTHLY">Monthly (30 Days)</option>
                      <option value="YEARLY">Yearly (365 Days)</option>
                      <option value="LIFETIME">Lifetime / Comp</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Duration in days */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-muted-foreground block">
                      Duration (Days):
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="3650"
                      value={assignDurationDays}
                      onChange={(e) => setAssignDurationDays(parseInt(e.target.value, 10) || 30)}
                      className="h-8 font-mono text-xs bg-background/50 border-border"
                    />
                  </div>

                  {/* Provider tag */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-muted-foreground block">
                      Audit Provider Tag:
                    </label>
                    <select
                      value={assignProvider}
                      onChange={(e) => setAssignProvider(e.target.value)}
                      className="w-full h-8 px-2 rounded-md border border-border/80 bg-background/80 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="MANUAL_ADMIN">MANUAL_ADMIN (Direct Provision)</option>
                      <option value="PROMOTIONAL_GRANT">PROMOTIONAL_GRANT</option>
                      <option value="VIP_COMP">VIP_COMP</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-muted-foreground block">
                      Internal Audit Note:
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. VIP onboarding comp"
                      value={assignNotes}
                      onChange={(e) => setAssignNotes(e.target.value)}
                      className="h-8 font-mono text-xs bg-background/50 border-border"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submittingAssignment || !assignTargetUserId}
                    className="font-mono text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
                  >
                    {submittingAssignment ? (
                      <>
                        <RotateCw className="h-3.5 w-3.5 animate-spin" />
                        Assigning Subscription...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Assign Subscription to Tenant
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

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
            setSelectedUserId(null);
            setAssignTargetUserId(uid);
            setActiveSuiteTab("assign");
            setShowConfigPanel(true);
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
