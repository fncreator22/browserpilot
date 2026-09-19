"use client";

import { useState, useEffect } from "react";
import { 
  Sliders, 
  RotateCw, 
  Save, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Sparkles,
  Zap,
  Lock,
  Unlock,
  CreditCard,
  Layers,
  Tag,
  UserCheck,
  Shield,
  Check,
  Percent,
  BarChart3,
  DollarSign,
  TrendingUp,
  Receipt,
  ArrowUpRight,
  Users,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { ADMIN_API_ROUTES } from "@/lib/admin/adminRoutes";

interface PlanCapabilityItem {
  id?: string;
  capabilityKey: string;
  enabled: boolean;
  limitValue?: number | null;
}

interface AdminPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  discountPercentage?: number;
  currency: string;
  maxWatches: number;
  maxDailyDiscoveries: number;
  dailyTokenLimit: number;
  active: boolean;
  features?: string[];
  capabilities: PlanCapabilityItem[];
}

export default function AdminPlansPage() {
  const [activeTab, setActiveTab] = useState<"tiers" | "capabilities" | "coupons" | "assign" | "analytics" | "trial">("tiers");
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPlanCode, setSavingPlanCode] = useState<string | null>(null);
  const [newCapKeys, setNewCapKeys] = useState<Record<string, string>>({});

  // 15-Day Free Trial Engine State
  const [trialConfig, setTrialConfig] = useState<{
    enforceTrial: boolean;
    defaultTrialDays: number;
    userOverrides: Record<string, { extendedDays: number; exempt: boolean }>;
  }>({
    enforceTrial: true,
    defaultTrialDays: 15,
    userOverrides: {},
  });
  const [loadingTrial, setLoadingTrial] = useState(false);
  const [savingTrial, setSavingTrial] = useState(false);
  const [extendUserIdInput, setExtendUserIdInput] = useState("");
  const [extendDaysInput, setExtendDaysInput] = useState(7);
  const [exemptUserIdInput, setExemptUserIdInput] = useState("");

  // Subscription Analytics State
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Plan Tiers Edit State
  const [editingPlanData, setEditingPlanData] = useState<Record<string, {
    dailyTokenLimit: number;
    priceMonthly: number;
    priceYearly: number;
    discountPercentage: number;
    description: string;
    maxWatches: number;
    maxDailyDiscoveries: number;
    features: string[];
    newFeatureInput: string;
  }>>({});

  // Coupons State
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

  // Assign Subscriptions State
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [assignTargetUserId, setAssignTargetUserId] = useState<string>("");
  const [assignPlanCode, setAssignPlanCode] = useState<string>("PREMIUM");
  const [assignInterval, setAssignInterval] = useState<"MONTHLY" | "YEARLY" | "LIFETIME">("MONTHLY");
  const [assignDurationDays, setAssignDurationDays] = useState<number>(30);
  const [assignProvider, setAssignProvider] = useState<string>("MANUAL_ADMIN");
  const [assignNotes, setAssignNotes] = useState<string>("");
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  const getAdminKey = () => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("admin_key");
    }
    return null;
  };

  const fetchTrialConfig = async () => {
    try {
      setLoadingTrial(true);
      const adminKey = getAdminKey();
      const url = adminKey
        ? `${ADMIN_API_ROUTES.TRIAL}?admin_key=${encodeURIComponent(adminKey)}`
        : ADMIN_API_ROUTES.TRIAL;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setTrialConfig(data.config);
        }
      }
    } catch {
      toast.error("Failed to load trial configuration");
    } finally {
      setLoadingTrial(false);
    }
  };

  const updateTrialConfig = async (updates: any) => {
    try {
      setSavingTrial(true);
      const adminKey = getAdminKey();
      const url = adminKey
        ? `${ADMIN_API_ROUTES.TRIAL}?admin_key=${encodeURIComponent(adminKey)}`
        : ADMIN_API_ROUTES.TRIAL;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setTrialConfig(data.config);
          toast.success("Trial configuration updated successfully");
        }
      } else {
        toast.error("Failed to update trial configuration");
      }
    } catch {
      toast.error("Error updating trial configuration");
    } finally {
      setSavingTrial(false);
    }
  };

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const adminKey = getAdminKey();
      const url = adminKey 
        ? `${ADMIN_API_ROUTES.PLANS}?admin_key=${encodeURIComponent(adminKey)}` 
        : ADMIN_API_ROUTES.PLANS;
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load plans (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data.plans) {
        const loadedPlans: AdminPlan[] = data.plans;
        setPlans(loadedPlans);

        const initialEdits: Record<string, any> = {};
        for (const p of loadedPlans) {
          initialEdits[p.code] = {
            dailyTokenLimit: p.dailyTokenLimit || 10000,
            priceMonthly: p.priceMonthly || 0,
            priceYearly: p.priceYearly || 0,
            discountPercentage: p.discountPercentage || 0,
            description: p.description || "",
            maxWatches: p.maxWatches || 1,
            maxDailyDiscoveries: p.maxDailyDiscoveries || 10,
            features: Array.isArray(p.features) ? [...p.features] : [],
            newFeatureInput: "",
          };
        }
        setEditingPlanData(initialEdits);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  const fetchCoupons = async () => {
    setLoadingCoupons(true);
    try {
      const adminKey = getAdminKey();
      const couponsUrl = adminKey ? `${ADMIN_API_ROUTES.COUPONS}?admin_key=${encodeURIComponent(adminKey)}` : ADMIN_API_ROUTES.COUPONS;
      const res = await fetch(couponsUrl);
      if (res.ok) {
        const data = await res.json();
        setCoupons(data.coupons || []);
      }
    } catch (err: any) {
      console.error("Failed to load coupons:", err);
    } finally {
      setLoadingCoupons(false);
    }
  };

  const fetchUsersForAssignment = async () => {
    setLoadingUsers(true);
    try {
      const adminKey = getAdminKey();
      const url = adminKey ? `${ADMIN_API_ROUTES.USERS}?limit=100&admin_key=${encodeURIComponent(adminKey)}` : `${ADMIN_API_ROUTES.USERS}?limit=100`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err: any) {
      console.error("Failed to load users for assignment:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const adminKey = getAdminKey();
      const url = adminKey 
        ? `${ADMIN_API_ROUTES.SUBSCRIPTION_ANALYTICS}?admin_key=${encodeURIComponent(adminKey)}` 
        : ADMIN_API_ROUTES.SUBSCRIPTION_ANALYTICS;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data.analytics);
      }
    } catch (err: any) {
      console.error("Failed to load subscription analytics:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchCoupons();
    fetchUsersForAssignment();
    fetchAnalytics();
  }, []);

  // Handlers for Plan Tier editing
  const handleAddFeature = (planCode: string) => {
    const input = editingPlanData[planCode]?.newFeatureInput?.trim();
    if (!input) return;

    setEditingPlanData((prev) => ({
      ...prev,
      [planCode]: {
        ...prev[planCode],
        features: [...(prev[planCode]?.features || []), input],
        newFeatureInput: "",
      },
    }));
  };

  const handleRemoveFeature = (planCode: string, index: number) => {
    setEditingPlanData((prev) => ({
      ...prev,
      [planCode]: {
        ...prev[planCode],
        features: prev[planCode].features.filter((_, i) => i !== index),
      },
    }));
  };

  const handleSavePlanTier = async (planCode: string) => {
    setSavingPlanCode(planCode);
    const edit = editingPlanData[planCode];
    if (!edit) return;

    try {
      const adminKey = getAdminKey();
      const url = adminKey 
        ? `${ADMIN_API_ROUTES.PLANS}?admin_key=${encodeURIComponent(adminKey)}` 
        : ADMIN_API_ROUTES.PLANS;

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode,
          dailyTokenLimit: edit.dailyTokenLimit,
          priceMonthly: edit.priceMonthly,
          priceYearly: edit.priceYearly,
          discountPercentage: edit.discountPercentage,
          description: edit.description,
          features: edit.features,
          maxWatches: edit.maxWatches,
          maxDailyDiscoveries: edit.maxDailyDiscoveries,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update plan");
      }

      toast.success(`Successfully saved plan tier "${planCode}" with ${edit.discountPercentage}% discount offer`);
      await fetchPlans();
    } catch (err: any) {
      toast.error(err.message || "Failed to save plan tier");
    } finally {
      setSavingPlanCode(null);
    }
  };

  // Handlers for Capabilities
  const handleToggleCapability = (planCode: string, capabilityKey: string) => {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.code !== planCode) return p;
        const existing = p.capabilities.find(
          (c) => c.capabilityKey.toUpperCase() === capabilityKey.toUpperCase()
        );
        let updatedCapabilities: PlanCapabilityItem[];
        if (existing) {
          updatedCapabilities = p.capabilities.map((c) =>
            c.capabilityKey.toUpperCase() === capabilityKey.toUpperCase()
              ? { ...c, enabled: !c.enabled }
              : c
          );
        } else {
          updatedCapabilities = [
            ...p.capabilities,
            { capabilityKey: capabilityKey.toUpperCase(), enabled: true },
          ];
        }
        return { ...p, capabilities: updatedCapabilities };
      })
    );
  };

  const handleAddCustomCapability = (planCode: string) => {
    const rawKey = newCapKeys[planCode]?.trim();
    if (!rawKey) {
      toast.error("Please enter a capability key");
      return;
    }
    const cleanKey = rawKey.toUpperCase().replace(/[-\s]+/g, "_");

    setPlans((prev) =>
      prev.map((p) => {
        if (p.code !== planCode) return p;
        if (p.capabilities.some((c) => c.capabilityKey.toUpperCase() === cleanKey)) {
          toast.error(`Capability "${cleanKey}" already exists on plan ${planCode}`);
          return p;
        }
        return {
          ...p,
          capabilities: [
            ...p.capabilities,
            { capabilityKey: cleanKey, enabled: true },
          ],
        };
      })
    );

    setNewCapKeys((prev) => ({ ...prev, [planCode]: "" }));
    toast.success(`Added "${cleanKey}" to ${planCode}. Remember to click Save Changes.`);
  };

  const handleSaveCapabilities = async (plan: AdminPlan) => {
    setSavingPlanCode(plan.code);
    try {
      const adminKey = getAdminKey();
      const url = adminKey 
        ? `${ADMIN_API_ROUTES.PLANS}?admin_key=${encodeURIComponent(adminKey)}` 
        : ADMIN_API_ROUTES.PLANS;

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: plan.code,
          capabilities: plan.capabilities,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update capabilities");
      }

      toast.success(`Saved capability entitlements for "${plan.name}" (${plan.code})`);
      await fetchPlans();
    } catch (err: any) {
      toast.error(err.message || "Failed to save capabilities");
    } finally {
      setSavingPlanCode(null);
    }
  };

  // Handlers for Coupons
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupon.code.trim()) {
      toast.error("Coupon code is required");
      return;
    }
    setCreatingCoupon(true);
    try {
      const adminKey = getAdminKey();
      const couponsUrl = adminKey ? `${ADMIN_API_ROUTES.COUPONS}?admin_key=${encodeURIComponent(adminKey)}` : ADMIN_API_ROUTES.COUPONS;
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
      const adminKey = getAdminKey();
      const url = adminKey ? `${ADMIN_API_ROUTES.COUPONS}/${couponId}?admin_key=${encodeURIComponent(adminKey)}` : `${ADMIN_API_ROUTES.COUPONS}/${couponId}`;
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

  // Handler for Assign Subscription
  const handleAssignSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetUserId) {
      toast.error("Please select a target user.");
      return;
    }

    setSubmittingAssignment(true);
    try {
      const adminKey = getAdminKey();
      const url = adminKey 
        ? `${ADMIN_API_ROUTES.USER_SUBSCRIPTION(assignTargetUserId)}?admin_key=${encodeURIComponent(adminKey)}` 
        : ADMIN_API_ROUTES.USER_SUBSCRIPTION(assignTargetUserId);
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
      await fetchUsersForAssignment();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign subscription");
    } finally {
      setSubmittingAssignment(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground font-mono text-sm">
        <RotateCw className="h-6 w-6 animate-spin text-purple-400" />
        Loading plan configurations, capabilities & coupons...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-sm">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Plans, Subscriptions & Coupons Suite
            </h1>
            <p className="text-xs text-muted-foreground">
              Manage subscription tiers, plan discounts, capability gating, single-use coupons, and manual user assignments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={() => {
              fetchPlans();
              fetchCoupons();
              fetchUsersForAssignment();
              fetchAnalytics();
            }} 
            variant="outline" 
            size="sm" 
            className="font-mono text-xs gap-1.5"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Refresh All
          </Button>
        </div>
      </div>

      {/* 5-Tab Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1.5 rounded-xl border border-border/60 font-mono text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("tiers")}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "tiers"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Layers className="h-4 w-4" />
          Plan Tiers, Pricing & Offers
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("capabilities")}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "capabilities"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Sliders className="h-4 w-4" />
          Capability Gates
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("coupons");
            if (coupons.length === 0) fetchCoupons();
          }}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "coupons"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Tag className="h-4 w-4" />
          Promotional Coupons ({coupons.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("assign");
            if (users.length === 0) fetchUsersForAssignment();
          }}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "assign"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Assign Subscriptions
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("analytics");
            fetchAnalytics();
          }}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "analytics"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Subscription Analytics
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("trial");
            fetchTrialConfig();
          }}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "trial"
              ? "bg-purple-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Clock className="h-4 w-4" />
          15-Day Free Trial Engine
        </button>
      </div>

      {/* TAB 1: Plan Tiers, Pricing & Offers */}
      {activeTab === "tiers" && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-950/10 flex items-start gap-3 text-xs font-mono">
            <Percent className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-purple-300 block">
                Auto-calculated Plan Discounts & Real-Time Checkout Sync
              </span>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                Set a discount percentage on any plan (e.g. 15% discount on $100 = $85/mo). The user portal displays strike-through pricing (`$100` → `$85`), and the checkout payment gateway creates orders for the exact discounted amount.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {plans.map((p) => {
              const edit = editingPlanData[p.code] || {
                dailyTokenLimit: p.dailyTokenLimit,
                priceMonthly: p.priceMonthly,
                priceYearly: p.priceYearly || 0,
                discountPercentage: p.discountPercentage || 0,
                description: p.description || "",
                maxWatches: p.maxWatches || 1,
                maxDailyDiscoveries: p.maxDailyDiscoveries || 10,
                features: p.features || [],
                newFeatureInput: "",
              };

              const isSaving = savingPlanCode === p.code;

              // Pricing math
              const baseMonthly = edit.priceMonthly;
              const baseYearly = edit.priceYearly;
              const discountPct = edit.discountPercentage || 0;

              const discountedMonthly = discountPct > 0 
                ? Math.max(0, Math.round(baseMonthly * (1 - discountPct / 100) * 100) / 100)
                : baseMonthly;

              const monthlySavings = baseMonthly - discountedMonthly;

              const discountedYearly = discountPct > 0 
                ? Math.max(0, Math.round(baseYearly * (1 - discountPct / 100) * 100) / 100)
                : baseYearly;

              const yearlySavings = baseYearly - discountedYearly;

              return (
                <Card key={p.id} className="flex flex-col border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={`font-mono text-xs px-2 py-0.5 ${
                          p.code === "ENTERPRISE"
                            ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                            : p.code === "PREMIUM"
                            ? "border-purple-500/40 text-purple-300 bg-purple-500/10"
                            : "border-border/60 text-muted-foreground"
                        }`}
                      >
                        {p.code}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Currency: {p.currency}
                      </span>
                    </div>
                    <CardTitle className="text-lg font-bold pt-1">{p.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {p.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-4 pt-4 text-xs font-mono">
                    {/* Monthly & Yearly Pricing */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground block">
                          Base Monthly ($):
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
                          className="h-8 text-xs bg-background/50 border-border"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground block">
                          Base Yearly ($):
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
                          className="h-8 text-xs bg-background/50 border-border"
                        />
                      </div>
                    </div>

                    {/* Discount % Input */}
                    <div className="space-y-1.5 p-3 rounded-lg border border-purple-500/30 bg-purple-950/20">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-purple-200 flex items-center gap-1.5">
                          <Percent className="h-3 w-3 text-purple-400" />
                          Plan Discount Offer (%):
                        </label>
                        <span className="text-[10px] font-bold text-purple-300">
                          {discountPct}% OFF
                        </span>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        placeholder="e.g. 15 for 15% off"
                        value={edit.discountPercentage}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                          setEditingPlanData((prev) => ({
                            ...prev,
                            [p.code]: {
                              ...prev[p.code],
                              discountPercentage: val,
                            },
                          }));
                        }}
                        className="h-8 text-xs bg-background/80 border-purple-500/40 text-foreground"
                      />

                      {/* Live Auto-Calculated Offer Display */}
                      <div className="pt-2 border-t border-purple-500/20 space-y-1">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground block">
                          Live Auto-Calculated Offer Pricing:
                        </span>
                        {discountPct > 0 && baseMonthly > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">Monthly:</span>
                              <div className="text-right">
                                <span className="line-through text-muted-foreground mr-1.5">${baseMonthly.toFixed(2)}</span>
                                <span className="font-bold text-emerald-400">${discountedMonthly.toFixed(2)}/mo</span>
                                <span className="text-[10px] text-emerald-300 block">
                                  Save ${monthlySavings.toFixed(2)} ({discountPct}% OFF)
                                </span>
                              </div>
                            </div>

                            {baseYearly > 0 && (
                              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-purple-500/10">
                                <span className="text-muted-foreground">Yearly:</span>
                                <div className="text-right">
                                  <span className="line-through text-muted-foreground mr-1.5">${baseYearly.toFixed(2)}</span>
                                  <span className="font-bold text-emerald-400">${discountedYearly.toFixed(2)}/yr</span>
                                  <span className="text-[10px] text-emerald-300 block">
                                    Save ${yearlySavings.toFixed(2)} ({discountPct}% OFF)
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : baseMonthly === 0 ? (
                          <div className="text-[11px] text-muted-foreground">
                            Free Community Tier ($0.00)
                          </div>
                        ) : (
                          <div className="text-[11px] text-foreground font-semibold">
                            Standard Price: ${baseMonthly.toFixed(2)}/mo (No active discount)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Token Quotas & Watches */}
                    <div className="grid grid-cols-3 gap-2 bg-muted/20 p-2.5 rounded-lg border border-border/40 text-[11px]">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Daily Tokens</span>
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
                          className="h-7 text-xs bg-background/50 border-border mt-1"
                        />
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Max Watches</span>
                        <Input
                          type="number"
                          min="1"
                          value={edit.maxWatches}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setEditingPlanData((prev) => ({
                              ...prev,
                              [p.code]: {
                                ...prev[p.code],
                                maxWatches: isNaN(val) ? 1 : val,
                              },
                            }));
                          }}
                          className="h-7 text-xs bg-background/50 border-border mt-1"
                        />
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Daily Disc.</span>
                        <Input
                          type="number"
                          min="1"
                          value={edit.maxDailyDiscoveries}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setEditingPlanData((prev) => ({
                              ...prev,
                              [p.code]: {
                                ...prev[p.code],
                                maxDailyDiscoveries: isNaN(val) ? 1 : val,
                              },
                            }));
                          }}
                          className="h-7 text-xs bg-background/50 border-border mt-1"
                        />
                      </div>
                    </div>

                    {/* Textual Features Offering */}
                    <div className="space-y-1.5 pt-1 border-t border-border/50">
                      <label className="text-[10px] font-semibold text-foreground block">
                        Included Textual Offerings ({edit.features.length} bullets):
                      </label>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {edit.features.map((feat, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-1 p-1.5 rounded bg-muted/20 text-[11px] text-foreground border border-border/40"
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

                      {/* Add Feature Bullet */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <Input
                          type="text"
                          placeholder="Add feature bullet..."
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
                          className="h-7 text-[11px] bg-background/50 border-border"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAddFeature(p.code)}
                          className="h-7 px-2 text-[10px] shrink-0 gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add
                        </Button>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-3 border-t border-border/50">
                    <Button
                      size="sm"
                      disabled={isSaving}
                      onClick={() => handleSavePlanTier(p.code)}
                      className="w-full font-mono text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
                    >
                      {isSaving ? (
                        <>
                          <RotateCw className="h-3.5 w-3.5 animate-spin" />
                          Saving Tier...
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          Save {p.name}
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Capability Gates */}
      {activeTab === "capabilities" && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-950/10 flex items-start gap-3 text-xs font-mono">
            <Sliders className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-purple-300 block">
                Granular Capability Entitlement Engine
              </span>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                Toggle specific functional capabilities per tier. The runtime checks explicit capability rows first, then legacy columns, and defaults to false for unconfigured features.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isSaving = savingPlanCode === plan.code;

              return (
                <Card key={plan.id} className="flex flex-col border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 border-purple-500/40 text-purple-400 bg-purple-500/10">
                        {plan.code}
                      </Badge>
                      <span className="text-sm font-semibold font-mono text-foreground">
                        {plan.capabilities.filter(c => c.enabled).length} Enabled
                      </span>
                    </div>
                    <CardTitle className="text-lg font-bold pt-1">{plan.name}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-4 pt-4 text-xs font-mono">
                    <div className="space-y-2">
                      <span className="font-semibold text-foreground text-xs uppercase tracking-wider block text-muted-foreground">
                        Active Capability Toggles
                      </span>

                      {plan.capabilities.length === 0 ? (
                        <div className="text-muted-foreground italic text-xs py-2">
                          No explicit capabilities configured.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                          {plan.capabilities.map((cap) => (
                            <div
                              key={cap.capabilityKey}
                              className="flex items-center justify-between p-2 rounded-md border border-border/40 bg-background/50 text-xs hover:border-purple-500/30 transition-colors"
                            >
                              <div className="flex items-center gap-2 truncate pr-2">
                                {cap.enabled ? (
                                  <Unlock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                                <span className="truncate">{cap.capabilityKey}</span>
                              </div>

                              <Button
                                type="button"
                                size="sm"
                                variant={cap.enabled ? "default" : "outline"}
                                className={`h-6 text-[10px] px-2 ${
                                  cap.enabled
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                                onClick={() => handleToggleCapability(plan.code, cap.capabilityKey)}
                              >
                                {cap.enabled ? "ENABLED" : "DISABLED"}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add Custom Capability Key */}
                    <div className="pt-2 border-t border-border/40 space-y-2">
                      <span className="text-[11px] text-muted-foreground block">
                        Add Granular Capability Key
                      </span>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. CSV_EXPORT"
                          value={newCapKeys[plan.code] || ""}
                          onChange={(e) =>
                            setNewCapKeys((prev) => ({ ...prev, [plan.code]: e.target.value }))
                          }
                          className="h-7 text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs shrink-0 gap-1"
                          onClick={() => handleAddCustomCapability(plan.code)}
                        >
                          <Plus className="h-3 w-3" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="pt-3 border-t border-border/50">
                    <Button
                      className="w-full font-mono text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => handleSaveCapabilities(plan)}
                    >
                      {isSaving ? (
                        <RotateCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save Capability Entitlements
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Promotional Coupons Suite */}
      {activeTab === "coupons" && (
        <div className="space-y-6">
          {/* Form: Create Promotional Coupon */}
          <div className="p-5 rounded-xl border border-border/70 bg-card/70 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-purple-400" />
                <h3 className="text-xs font-bold font-mono text-foreground uppercase tracking-wide">
                  Create Promotional Single-Use Coupon
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono text-purple-300 border-purple-500/30">
                Concurrency-Safe Database Constraint
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
                    onChange={(e) => {
                      const type = e.target.value;
                      setNewCoupon({
                        ...newCoupon,
                        discountType: type,
                        discountValue: type === "PLAN_ACCESS" ? 100 : (newCoupon.discountValue || 20),
                      });
                    }}
                    className="w-full h-8 px-2 rounded-md border border-border/80 bg-background/80 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="PERCENTAGE">Percentage (% Off)</option>
                    <option value="FIXED_AMOUNT">Fixed Amount ($ Off)</option>
                    <option value="PLAN_ACCESS">Full Plan Access (100% Free)</option>
                  </select>
                </div>

                {/* Discount Value */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-muted-foreground block">
                    {newCoupon.discountType === "PLAN_ACCESS"
                      ? "Discount (Auto 100% Full Access):"
                      : newCoupon.discountType === "FIXED_AMOUNT"
                      ? "Discount Amount ($):"
                      : "Discount Percentage (%):"}
                  </label>
                  {newCoupon.discountType === "PLAN_ACCESS" ? (
                    <div className="h-8 px-2.5 rounded-md border border-purple-500/40 bg-purple-500/10 text-purple-300 font-mono text-xs flex items-center font-semibold">
                      100% Full Access (Free)
                    </div>
                  ) : (
                    <Input
                      type="number"
                      min="1"
                      max={newCoupon.discountType === "PERCENTAGE" ? 100 : 10000}
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
                  )}
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
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono text-muted-foreground block">
                      Total Users Allowed (Global Cap):
                    </label>
                    <span className="text-[9px] font-mono text-purple-400">Total accounts</span>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 100"
                    value={newCoupon.maxRedemptions}
                    onChange={(e) =>
                      setNewCoupon({
                        ...newCoupon,
                        maxRedemptions: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="h-8 font-mono text-xs bg-background/50 border-border"
                    required
                  />
                  <span className="text-[9px] font-mono text-muted-foreground block">
                    Total user accounts that can redeem this code.
                  </span>
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
              <div className="rounded-xl border border-border/70 bg-card/60 overflow-hidden shadow-sm">
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
                          <div className="space-y-0.5">
                            <span className="text-foreground font-semibold block text-xs">
                              {c.redemptionCount} used of {c.maxRedemptions > 0 ? c.maxRedemptions : "∞"} total
                            </span>
                            {c.maxRedemptions > 0 ? (
                              <span className={`text-[10px] font-mono block ${
                                c.redemptionCount >= c.maxRedemptions
                                  ? "text-rose-400 font-semibold"
                                  : "text-emerald-400"
                              }`}>
                                {c.redemptionCount >= c.maxRedemptions
                                  ? "0 slots left (exhausted)"
                                  : `${Math.max(0, c.maxRedemptions - c.redemptionCount)} slots left`}
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-muted-foreground block">
                                Unlimited slots
                              </span>
                            )}
                          </div>
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

      {/* TAB 4: Assign Subscriptions */}
      {activeTab === "assign" && (
        <div className="p-5 rounded-xl border border-border/70 bg-card/70 space-y-4 shadow-sm">
          <div className="border-b border-border/60 pb-3">
            <h3 className="text-xs font-bold font-mono text-foreground uppercase tracking-wide flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-purple-400" />
              Direct User Subscription Assignment
            </h3>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              Grant or upgrade any tenant's subscription tier. Prior subscriptions are atomically deactivated and new quotas provisioned immediately.
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
                  <option value="">-- Choose User ({users.length} loaded) --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || "Tenant"} ({u.email}) [{u.plan?.code || "STARTER"}]
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
                  placeholder="e.g. Executive onboarding comp"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="h-8 font-mono text-xs bg-background/50 border-border"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
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

      {/* TAB 5: Subscription Analytics & Telemetry Suite */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-950/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-start gap-3">
              <BarChart3 className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-purple-300 block">
                  Subscription & Commercial Telemetry Observatory
                </span>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  Real-time monetization analytics: track total users bought, breakdown of direct gateway payments vs coupon promotions, active plan distributions, and recent transactions.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAnalytics}
              disabled={loadingAnalytics}
              className="font-mono text-xs gap-1.5 shrink-0"
            >
              <RotateCw className={`h-3.5 w-3.5 ${loadingAnalytics ? "animate-spin text-purple-400" : ""}`} />
              Refresh Telemetry
            </Button>
          </div>

          {loadingAnalytics && !analyticsData ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground font-mono text-sm">
              <RotateCw className="h-6 w-6 animate-spin text-purple-400" />
              Aggregating subscriber telemetry & payment ledger...
            </div>
          ) : analyticsData ? (
            <>
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Active Subscribers */}
                <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
                    <span>ACTIVE SUBSCRIBERS</span>
                    <Users className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
                      {analyticsData.summary?.activeSubscriptions ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      / {analyticsData.summary?.totalSubscriptions ?? 0} total
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {analyticsData.summary?.totalSubscriptions ? Math.round(((analyticsData.summary?.activeSubscriptions || 0) / Math.max(1, analyticsData.summary?.totalSubscriptions)) * 100) : 0}% retention rate
                  </p>
                </div>

                {/* Direct Money Paid Subscribers */}
                <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
                    <span>DIRECT GATEWAY BUYERS</span>
                    <CreditCard className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-emerald-400">
                      {analyticsData.summary?.directPaymentCount ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      direct paying users
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Via Razorpay / Stripe gateway
                  </p>
                </div>

                {/* Coupon & Promotional Grants */}
                <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
                    <span>COUPON / PROMO BUYERS</span>
                    <Tag className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-amber-400">
                      {analyticsData.summary?.couponPaymentCount ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      ({analyticsData.summary?.totalRedemptions ?? 0} redemptions)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {analyticsData.summary?.manualCompCount ?? 0} manual VIP comp grants
                  </p>
                </div>

                {/* Gross Revenue & ARPU */}
                <div className="p-4 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
                    <span>GROSS REVENUE</span>
                    <DollarSign className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-blue-400">
                      ${(analyticsData.summary?.totalRevenue ?? 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {analyticsData.summary?.currency || "USD"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    ARPU: ${(analyticsData.summary?.arpu ?? 0).toFixed(2)} / paying tenant
                  </p>
                </div>
              </div>

              {/* Middle Grid: Direct vs Coupon Breakdown & Plan Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Acquisition Channel: Direct vs Coupon */}
                <div className="p-5 rounded-xl border border-border/70 bg-card/60 space-y-4 shadow-sm font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-400" />
                      Acquisition Channels (Direct vs Coupon)
                    </h3>
                    <Badge variant="outline" className="text-[10px]">
                      {(analyticsData.summary?.directPaymentCount ?? 0) + (analyticsData.summary?.couponPaymentCount ?? 0)} Recorded Buyers
                    </Badge>
                  </div>

                  <div className="space-y-3 pt-2">
                    {/* Direct Bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5" /> Direct Payment (Card/UPI)
                        </span>
                        <span className="text-muted-foreground">
                          {analyticsData.summary?.directPaymentCount ?? 0} ({
                            Math.round(((analyticsData.summary?.directPaymentCount ?? 0) / Math.max(1, (analyticsData.summary?.directPaymentCount ?? 0) + (analyticsData.summary?.couponPaymentCount ?? 0))) * 100)
                          }%)
                        </span>
                      </div>
                      <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.round(((analyticsData.summary?.directPaymentCount ?? 0) / Math.max(1, (analyticsData.summary?.directPaymentCount ?? 0) + (analyticsData.summary?.couponPaymentCount ?? 0))) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Coupon Bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5" /> Promotional Coupon
                        </span>
                        <span className="text-muted-foreground">
                          {analyticsData.summary?.couponPaymentCount ?? 0} ({
                            Math.round(((analyticsData.summary?.couponPaymentCount ?? 0) / Math.max(1, (analyticsData.summary?.directPaymentCount ?? 0) + (analyticsData.summary?.couponPaymentCount ?? 0))) * 100)
                          }%)
                        </span>
                      </div>
                      <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.round(((analyticsData.summary?.couponPaymentCount ?? 0) / Math.max(1, (analyticsData.summary?.directPaymentCount ?? 0) + (analyticsData.summary?.couponPaymentCount ?? 0))) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-center text-[11px]">
                    <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-emerald-400 block font-bold text-sm">
                        ${(analyticsData.summary?.totalRevenue ?? 0).toFixed(2)}
                      </span>
                      <span className="text-muted-foreground text-[10px]">Total Gateway Revenue</span>
                    </div>
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
                      <span className="text-amber-400 block font-bold text-sm">
                        {analyticsData.summary?.totalRedemptions ?? 0}
                      </span>
                      <span className="text-muted-foreground text-[10px]">Coupons Claimed</span>
                    </div>
                  </div>
                </div>

                {/* Plan Tier Distribution */}
                <div className="p-5 rounded-xl border border-border/70 bg-card/60 space-y-4 shadow-sm font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <Layers className="h-4 w-4 text-purple-400" />
                      Subscribers per Plan Tier
                    </h3>
                    <Badge variant="outline" className="text-[10px]">
                      {analyticsData.breakdowns?.byPlan?.length || 0} Configured Tiers
                    </Badge>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {analyticsData.breakdowns?.byPlan?.map((tier: any) => (
                      <div key={tier.planId} className="p-2.5 rounded-lg bg-muted/20 border border-border/40 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{tier.planName}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-500/30 text-purple-400">
                              {tier.planCode}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            ${tier.priceMonthly}/mo • ${tier.priceYearly}/yr
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-bold text-foreground font-mono">
                            {tier.activeCount}
                          </span>
                          <span className="text-[10px] text-muted-foreground block">subscribers</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Tables: Recent Transactions & Coupon Redemptions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Payment Transactions */}
                <div className="p-5 rounded-xl border border-border/70 bg-card/60 space-y-4 shadow-sm font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-blue-400" />
                      Recent Payment Transactions
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      {analyticsData.recentTransactions?.length || 0} logged
                    </span>
                  </div>

                  {analyticsData.recentTransactions?.length === 0 ? (
                    <div className="text-muted-foreground italic py-6 text-center">
                      No payment transactions recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {analyticsData.recentTransactions?.map((tx: any) => (
                        <div key={tx.id} className="p-2.5 rounded-lg bg-muted/20 border border-border/40 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-foreground truncate block max-w-[180px]">
                              {tx.userEmail}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {tx.provider} • {new Date(tx.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <span className="font-bold text-emerald-400">
                              ${Number(tx.amount).toFixed(2)}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 ${
                                tx.status === "SUCCESS"
                                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                  : "border-amber-500/40 text-amber-400 bg-amber-500/10"
                              }`}
                            >
                              {tx.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Coupon Redemptions */}
                <div className="p-5 rounded-xl border border-border/70 bg-card/60 space-y-4 shadow-sm font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <Tag className="h-4 w-4 text-amber-400" />
                      Recent Coupon Redemptions
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      {analyticsData.recentRedemptions?.length || 0} logged
                    </span>
                  </div>

                  {analyticsData.recentRedemptions?.length === 0 ? (
                    <div className="text-muted-foreground italic py-6 text-center">
                      No coupon redemptions recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {analyticsData.recentRedemptions?.map((r: any) => (
                        <div key={r.id} className="p-2.5 rounded-lg bg-muted/20 border border-border/40 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-foreground truncate block max-w-[180px]">
                              {r.userEmail}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(r.redeemedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[10px] border-purple-500/40 text-purple-300 bg-purple-500/10">
                              {r.couponCode}
                            </Badge>
                            <span className="text-[11px] text-emerald-400 font-bold">
                              {r.discountType === "PERCENTAGE" ? `${r.discountValue}% OFF` : `$${r.discountValue} OFF`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 space-y-3">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground font-mono text-xs">No analytics telemetry available</p>
              <Button onClick={fetchAnalytics} variant="outline" size="sm" className="font-mono text-xs">
                Retry Fetch
              </Button>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: 15-Day Free Trial Engine */}
      {activeTab === "trial" && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 flex items-start justify-between gap-3 text-xs font-mono">
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-300 block">
                  Server-Authoritative 15-Day Free Trial Clock Engine
                </span>
                <span className="text-muted-foreground mt-0.5 block">
                  Calculates real-time 15-day countdown from user creation timestamps. Seamlessly gates expired accounts to Pro upgrade while exempting active subscribers.
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchTrialConfig}
              disabled={loadingTrial}
              className="h-7 text-xs font-mono border-border/60 hover:bg-muted/50 gap-1.5 shrink-0"
            >
              <RotateCw className={`h-3 w-3 ${loadingTrial ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Top Control Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Enforcement Status</span>
                  <Badge variant="outline" className={`font-mono text-[10px] ${trialConfig.enforceTrial ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" : "border-amber-500/40 text-amber-400 bg-amber-500/10"}`}>
                    {trialConfig.enforceTrial ? "ENFORCED" : "BYPASSED"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground font-mono">
                  {trialConfig.enforceTrial
                    ? "Users past 15 days without paid subscription are prompted to upgrade."
                    : "Trial clock is running in permissive mode. All users have full discovery access."}
                </p>
                <Button
                  size="sm"
                  onClick={() => updateTrialConfig({ enforceTrial: !trialConfig.enforceTrial })}
                  disabled={savingTrial}
                  className={`w-full font-mono text-xs ${trialConfig.enforceTrial ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
                >
                  {trialConfig.enforceTrial ? "Disable Enforcement (Permissive)" : "Enable Strict Enforcement"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Default Trial Window
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={trialConfig.defaultTrialDays}
                    onChange={(e) =>
                      setTrialConfig((prev) => ({
                        ...prev,
                        defaultTrialDays: parseInt(e.target.value) || 15,
                      }))
                    }
                    className="h-8 font-mono text-xs w-24 bg-background/50"
                  />
                  <span className="text-xs font-mono text-muted-foreground">days per new user</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateTrialConfig({ defaultTrialDays: trialConfig.defaultTrialDays })}
                  disabled={savingTrial}
                  className="w-full font-mono text-xs border-purple-500/40 hover:bg-purple-500/10 text-purple-300"
                >
                  Save Duration
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Active User Overrides
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold font-mono text-foreground">
                  {Object.keys(trialConfig.userOverrides || {}).length}
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  Custom user extensions and exemptions granted by admin.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* User Overrides & Extensions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="h-4 w-4 text-emerald-400" />
                  Grant User Trial Extension
                </CardTitle>
                <CardDescription className="text-xs font-mono">
                  Add additional trial days to a specific user account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">User ID</label>
                  <Input
                    placeholder="usr_abc123 or database uuid"
                    value={extendUserIdInput}
                    onChange={(e) => setExtendUserIdInput(e.target.value)}
                    className="h-8 font-mono text-xs bg-background/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">Additional Days</label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={extendDaysInput}
                    onChange={(e) => setExtendDaysInput(parseInt(e.target.value) || 7)}
                    className="h-8 font-mono text-xs bg-background/50 w-32"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!extendUserIdInput.trim()) {
                      toast.error("Please provide a User ID");
                      return;
                    }
                    updateTrialConfig({
                      extendUserId: extendUserIdInput.trim(),
                      extendDays: extendDaysInput,
                    });
                    setExtendUserIdInput("");
                  }}
                  disabled={savingTrial || !extendUserIdInput.trim()}
                  className="w-full font-mono text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Grant {extendDaysInput}-Day Extension
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  Set User Trial Exemption
                </CardTitle>
                <CardDescription className="text-xs font-mono">
                  Grant a permanent trial exemption (VIP/Partner free sovereign access).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">User ID</label>
                  <Input
                    placeholder="usr_abc123 or database uuid"
                    value={exemptUserIdInput}
                    onChange={(e) => setExemptUserIdInput(e.target.value)}
                    className="h-8 font-mono text-xs bg-background/50"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!exemptUserIdInput.trim()) {
                        toast.error("Please provide a User ID");
                        return;
                      }
                      updateTrialConfig({
                        exemptUserId: exemptUserIdInput.trim(),
                        exempt: true,
                      });
                      setExemptUserIdInput("");
                    }}
                    disabled={savingTrial || !exemptUserIdInput.trim()}
                    className="flex-1 font-mono text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    Grant Exemption
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!exemptUserIdInput.trim()) {
                        toast.error("Please provide a User ID");
                        return;
                      }
                      updateTrialConfig({
                        exemptUserId: exemptUserIdInput.trim(),
                        exempt: false,
                      });
                      setExemptUserIdInput("");
                    }}
                    disabled={savingTrial || !exemptUserIdInput.trim()}
                    className="font-mono text-xs border-border/60 hover:bg-muted/50"
                  >
                    Revoke
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
