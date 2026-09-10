"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Check, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  ArrowLeft, 
  CreditCard, 
  Tag, 
  Clock, 
  Compass, 
  RotateCw,
  Award,
  CheckCircle2,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useUIState } from "@/components/providers/ui-state-provider";

interface PlanConfig {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  maxWatches: number;
  maxDailyDiscoveries: number;
  maxMonthlyAIOperations: number;
  allowedIntervals: string[];
  supportsCompanyTargeting: boolean;
  supportsAdvancedFilters: boolean;
  supportsPuterPremium: boolean;
  supportsPriorityExecution: boolean;
  features?: string[];
  dailyTokenLimit?: number;
}

interface UserSubscription {
  id: string;
  status: string;
  billingInterval: "MONTHLY" | "YEARLY" | "LIFETIME";
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  paymentProvider: string;
}

interface QuotaReport {
  dailyDiscoveries: { used: number; limit: number; remaining: number };
  monthlyAIOperations: { used: number; limit: number; remaining: number };
  activeWatches: { used: number; limit: number; remaining: number };
}

export default function PlansPage() {
  const router = useRouter();
  const { openProfileModal } = useUIState();

  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PlanConfig | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [quota, setQuota] = useState<QuotaReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpgradingCode, setIsUpgradingCode] = useState<string | null>(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState<string>("");
  const [isRedeemingCoupon, setIsRedeemingCoupon] = useState<boolean>(false);

  const fetchBillingData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/account/billing");
      if (!res.ok) {
        throw new Error("Failed to load subscription details.");
      }
      const data = await res.json();
      setPlans(data.availablePlans || []);
      setCurrentPlan(data.plan || null);
      setSubscription(data.subscription || null);
      setQuota(data.quota || null);

      if (data.subscription?.billingInterval === "YEARLY") {
        setBillingInterval("YEARLY");
      }
    } catch (err: unknown) {
      toast.error("Billing Load Error", { description: (err as Error).message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  // Handle plan upgrade or change
  const handleSelectPlan = async (targetPlan: PlanConfig) => {
    if (currentPlan?.code === targetPlan.code) {
      toast.info("Active Tier", { description: `You are currently using the ${targetPlan.name} plan.` });
      return;
    }

    setIsUpgradingCode(targetPlan.code);
    try {
      // 1. Initialize checkout order
      const checkoutRes = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: targetPlan.code,
          billingInterval,
        }),
      });

      const checkoutData = await checkoutRes.json().catch(() => ({}));
      if (!checkoutRes.ok) {
        throw new Error(checkoutData.message || "Failed to initialize plan checkout.");
      }

      // 2. Complete payment verification & plan assignment
      const verifyRes = await fetch("/api/billing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: checkoutData.order?.orderId || `order_${Date.now()}`,
          paymentId: `pay_${Date.now()}_mock`,
          planCode: targetPlan.code,
          billingInterval,
        }),
      });

      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        throw new Error(verifyData.message || "Payment verification failed.");
      }

      toast.success("Subscription Updated!", {
        description: `Upgraded to ${targetPlan.name} (${billingInterval.toLowerCase()} interval).`,
      });

      // Refresh real-time billing state from backend
      await fetchBillingData();
    } catch (err: unknown) {
      toast.error("Upgrade Failed", { description: (err as Error).message });
    } finally {
      setIsUpgradingCode(null);
    }
  };

  // Handle promotional coupon redemption
  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = couponCode.trim().toUpperCase();
    if (!clean) {
      toast.error("Please enter a coupon code.");
      return;
    }

    setIsRedeemingCoupon(true);
    try {
      const res = await fetch("/api/account/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: clean }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Coupon redemption failed.");
      }

      toast.success("Coupon Redeemed!", {
        description: data.message || `Promotional coupon ${clean} applied to your account.`,
      });

      setCouponCode("");
      await fetchBillingData();
    } catch (err: unknown) {
      toast.error("Coupon Error", { description: (err as Error).message });
    } finally {
      setIsRedeemingCoupon(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F6F6F4]">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-[#E6E6E3] px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
            title="Return to Discovery Engine"
          >
            <ArrowLeft className="h-4 w-4 stroke-[2]" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-serif font-bold text-foreground">
                Subscription Plans & Limits
              </h1>
              <Badge variant="outline" className="text-[10px] font-mono text-[#1F3D2E] border-[#1F3D2E]/20 bg-[#1F3D2E]/5">
                Server Verified
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-sans hidden sm:block">
              Choose the tier that powers your autonomous career discovery. Quotas reset automatically.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchBillingData()}
            disabled={isLoading}
            className="text-xs font-sans font-medium text-muted-foreground hover:text-foreground gap-1.5"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openProfileModal("BILLING")}
            className="text-xs font-sans text-[#1F3D2E] hover:bg-[#1F3D2E]/5"
          >
            Settings Modal
          </Button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-8">
        
        {/* Active Subscription Banner */}
        <section className="bg-white rounded-2xl border border-[#E6E6E3] p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Your Current Plan
                </span>
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="flex items-center gap-3 mt-1">
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground">
                  {currentPlan?.name || "Starter / Community"}
                </h2>
                <Badge
                  className={`font-mono text-xs ${
                    currentPlan?.code === "ENTERPRISE"
                      ? "bg-purple-100 text-purple-800 border-purple-200"
                      : currentPlan?.code === "PREMIUM"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {currentPlan?.code || "FREE"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-sans mt-1">
                {currentPlan?.description || "Essential AI autonomous job discovery with standard monitoring."}
              </p>
            </div>

            {/* Interval & Renewal Badge */}
            <div className="bg-[#FBFBFA] border border-[#EBEBE8] rounded-xl p-3 text-xs font-sans space-y-1 min-w-[220px]">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Billing Interval:
                </span>
                <span className="font-semibold text-foreground capitalize font-mono">
                  {subscription?.billingInterval?.toLowerCase() || "Community"}
                </span>
              </div>
              {subscription?.currentPeriodEnd && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Period Ends:
                  </span>
                  <span className="font-medium text-foreground font-mono">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quota Telemetry Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
            <div className="bg-[#FBFBFA] rounded-xl p-3 border border-border/40">
              <span className="text-[11px] text-muted-foreground font-sans block">Autonomous Watches</span>
              <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                {quota?.activeWatches.used || 0} / {currentPlan?.maxWatches || 1}
              </span>
              <span className="text-[10px] text-emerald-700 font-sans">Active Monitoring</span>
            </div>

            <div className="bg-[#FBFBFA] rounded-xl p-3 border border-border/40">
              <span className="text-[11px] text-muted-foreground font-sans block">Daily Discovery</span>
              <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                {quota?.dailyDiscoveries.used || 0} / {currentPlan?.maxDailyDiscoveries || 10}
              </span>
              <span className="text-[10px] text-muted-foreground font-sans">Resets every 24h</span>
            </div>

            <div className="bg-[#FBFBFA] rounded-xl p-3 border border-border/40">
              <span className="text-[11px] text-muted-foreground font-sans block">Monthly AI Ops</span>
              <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                {quota?.monthlyAIOperations.used || 0} / {(currentPlan?.maxMonthlyAIOperations || 100).toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground font-sans">Monthly Quota</span>
            </div>

            <div className="bg-[#FBFBFA] rounded-xl p-3 border border-border/40">
              <span className="text-[11px] text-muted-foreground font-sans block">Daily Token Cap</span>
              <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                {(currentPlan?.dailyTokenLimit || 10000).toLocaleString()}
              </span>
              <span className="text-[10px] text-purple-700 font-sans">Gemini AI Tokens/Day</span>
            </div>
          </div>
        </section>

        {/* Monthly vs Yearly Billing Interval Switch */}
        <section className="flex flex-col items-center justify-center space-y-3 pt-2">
          <div className="inline-flex items-center bg-[#ECECE9] p-1 rounded-full border border-[#DFDFDC]">
            <button
              type="button"
              onClick={() => setBillingInterval("MONTHLY")}
              className={`px-5 py-2 text-xs font-sans font-semibold rounded-full transition-all cursor-pointer ${
                billingInterval === "MONTHLY"
                  ? "bg-white text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("YEARLY")}
              className={`px-5 py-2 text-xs font-sans font-semibold rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                billingInterval === "YEARLY"
                  ? "bg-[#1F3D2E] text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Yearly Billing</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                billingInterval === "YEARLY" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
              }`}>
                Save 17-20%
              </span>
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground font-sans">
            Yearly plans grant full 365-day continuous execution with discounted annual rates.
          </p>
        </section>

        {/* Responsive Plans Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map((p) => {
            const isCurrent = currentPlan?.code === p.code;
            const isPro = p.code === "PREMIUM";
            const isEnterprise = p.code === "ENTERPRISE";
            
            const price = billingInterval === "YEARLY" ? p.priceYearly : p.priceMonthly;
            const savings = (p.priceMonthly * 12) - p.priceYearly;

            return (
              <div
                key={p.id || p.code}
                className={`relative rounded-2xl bg-white border flex flex-col justify-between transition-all duration-200 shadow-xs ${
                  isCurrent
                    ? "border-[#1F3D2E] ring-2 ring-[#1F3D2E]/20"
                    : isPro
                    ? "border-emerald-300 ring-1 ring-emerald-300"
                    : "border-border/70 hover:border-border"
                }`}
              >
                {/* Popular / Current Ribbon */}
                {isCurrent ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1F3D2E] text-white px-3 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold shadow-xs flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    Current Plan
                  </div>
                ) : isPro ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-700 text-white px-3 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold shadow-xs flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-300" />
                    Most Popular
                  </div>
                ) : null}

                <div className="p-6 space-y-5">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-serif font-bold text-foreground">
                        {p.name}
                      </h3>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {p.code}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-sans mt-1.5 min-h-[32px]">
                      {p.description}
                    </p>
                  </div>

                  {/* Pricing Display */}
                  <div className="pt-2 border-t border-border/40">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-serif font-bold text-foreground">
                        ${price}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        /{billingInterval === "YEARLY" ? "year" : "month"}
                      </span>
                    </div>

                    {billingInterval === "YEARLY" && savings > 0 && (
                      <span className="inline-block mt-1 text-[11px] font-sans font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Save ${savings}/year ({Math.round((savings / (p.priceMonthly * 12)) * 100)}% discount)
                      </span>
                    )}
                  </div>

                  {/* Quota Highlights */}
                  <div className="bg-[#FBFBFA] rounded-xl p-3.5 border border-[#EBEBE8] space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-sans">Autonomous Watches:</span>
                      <span className="font-bold text-foreground">{p.maxWatches}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-sans">Daily Discoveries:</span>
                      <span className="font-bold text-foreground">{p.maxDailyDiscoveries}/day</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-sans">Daily AI Token Cap:</span>
                      <span className="font-bold text-foreground">{(p.dailyTokenLimit || 10000).toLocaleString()}/day</span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-2.5 pt-2">
                    <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block">
                      Included Capabilities
                    </span>
                    <ul className="space-y-2 text-xs font-sans text-foreground">
                      {(p.features || [
                        `${p.maxWatches} Active Autonomous Watches`,
                        `${p.maxDailyDiscoveries} Daily Job Discoveries`,
                        "Standard Monitoring Intervals",
                      ]).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-[#1F3D2E] shrink-0 mt-0.5 stroke-[2.5]" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Plan Card Action Button */}
                <div className="p-6 pt-0">
                  {isCurrent ? (
                    <Button
                      disabled
                      className="w-full bg-slate-100 text-slate-600 font-sans text-xs font-semibold cursor-not-allowed border border-slate-200"
                    >
                      Active Subscription
                    </Button>
                  ) : p.code === "FREE" ? (
                    <Button
                      variant="outline"
                      disabled={isUpgradingCode !== null}
                      onClick={() => handleSelectPlan(p)}
                      className="w-full font-sans text-xs font-semibold border-[#1F3D2E]/30 text-[#1F3D2E] hover:bg-[#1F3D2E]/5 cursor-pointer"
                    >
                      Switch to Starter
                    </Button>
                  ) : (
                    <Button
                      disabled={isUpgradingCode !== null}
                      onClick={() => handleSelectPlan(p)}
                      className={`w-full font-sans text-xs font-semibold text-white shadow-xs cursor-pointer ${
                        isEnterprise
                          ? "bg-purple-900 hover:bg-purple-950"
                          : "bg-[#1F3D2E] hover:bg-[#162d22]"
                      }`}
                    >
                      {isUpgradingCode === p.code ? (
                        <span className="flex items-center gap-1.5">
                          <RotateCw className="h-3.5 w-3.5 animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        `Upgrade to ${p.name}`
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* Promotional Coupons Redemption Section */}
        <section className="bg-white rounded-2xl border border-[#E6E6E3] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-[#1F3D2E]" />
                <h3 className="text-sm font-serif font-bold text-foreground">
                  Redeem Promotional Coupon or Scholarship Code
                </h3>
              </div>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Have an access code from an event or partner? Promotional coupons can activate plans or discount your subscription instantly.
              </p>
            </div>

            <Badge variant="outline" className="text-[10px] font-mono text-emerald-800 bg-emerald-50 border-emerald-200 shrink-0">
              Single-Use per Account Guarantee
            </Badge>
          </div>

          <form onSubmit={handleRedeemCoupon} className="flex flex-col sm:flex-row gap-2.5 max-w-xl">
            <Input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="e.g. LAUNCH2026, STUDENT50, PRO_VIP"
              className="font-mono text-xs uppercase bg-[#FBFBFA] border-border/80"
              disabled={isRedeemingCoupon}
            />
            <Button
              type="submit"
              disabled={isRedeemingCoupon || !couponCode.trim()}
              className="bg-[#1F3D2E] hover:bg-[#162d22] text-white font-sans text-xs font-semibold px-6 cursor-pointer shrink-0"
            >
              {isRedeemingCoupon ? (
                <span className="flex items-center gap-1.5">
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  Verifying...
                </span>
              ) : (
                "Apply Coupon"
              )}
            </Button>
          </form>
        </section>

        {/* Monthly vs Yearly Limits Explanatory FAQ */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-white rounded-xl p-4 border border-[#E6E6E3] space-y-1.5">
            <div className="flex items-center gap-2 text-foreground font-serif font-bold text-xs">
              <Calendar className="h-4 w-4 text-[#1F3D2E]" />
              Monthly vs. Yearly Quotas
            </div>
            <p className="text-[11px] text-muted-foreground font-sans leading-relaxed">
              Autonomous watches and daily searches remain active continuously. Monthly AI operations reset on the 1st of every calendar month.
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-[#E6E6E3] space-y-1.5">
            <div className="flex items-center gap-2 text-foreground font-serif font-bold text-xs">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              Server-Authoritative Enforcement
            </div>
            <p className="text-[11px] text-muted-foreground font-sans leading-relaxed">
              Every upgrade, coupon, and quota check is strictly verified in the database. If any error occurs, coupons are never lost.
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-[#E6E6E3] space-y-1.5">
            <div className="flex items-center gap-2 text-foreground font-serif font-bold text-xs">
              <Sparkles className="h-4 w-4 text-amber-600" />
              Admin Telemetry & Visibility
            </div>
            <p className="text-[11px] text-muted-foreground font-sans leading-relaxed">
              Admins observe all plan statuses, expiration dates, and real-time Puter/Gemini token limits inside the central observatory.
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}
