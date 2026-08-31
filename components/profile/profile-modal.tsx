"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  User, 
  Mail, 
  Sparkles, 
  KeyRound, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  X,
  Zap,
  ShieldCheck,
  Activity
} from "lucide-react";
import { toast } from "sonner";
import { usePuter } from "@/hooks/usePuter";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { data: session, update: updateSession } = useSession();
  const { isLoaded: isPuterLoaded, isSignedIn: isPuterSignedIn, user: puterUser, isAuthenticating: isPuterAuthenticating, signIn: puterSignIn, signOut: puterSignOut } = usePuter();

  const [activeTab, setActiveTab] = useState<"ACCOUNT" | "PERSONALIZATION" | "PROVIDERS" | "BILLING">("ACCOUNT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Providers & Usage state
  const [connectedProviders, setConnectedProviders] = useState<any[]>([]);
  const [usageSummary, setUsageSummary] = useState<any | null>(null);

  // Billing & Coupon state
  const [billingData, setBillingData] = useState<any | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [isRedeemingCoupon, setIsRedeemingCoupon] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Personalization state
  const [userCategory, setUserCategory] = useState("");
  const [usageContext, setUsageContext] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSize, setOrganizationSize] = useState("");
  const [preferredRoles, setPreferredRoles] = useState<string[]>([]);
  const [preferredWorkModes, setPreferredWorkModes] = useState<string[]>([]);
  const [targetSkills, setTargetSkills] = useState<string[]>([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  const loadProvidersAndUsage = () => {
    fetch("/api/account/providers")
      .then((res) => res.json())
      .then((data) => {
        if (data?.providers) setConnectedProviders(data.providers);
      })
      .catch(() => {});

    fetch("/api/account/usage")
      .then((res) => res.json())
      .then((data) => {
        if (data?.summary) setUsageSummary(data.summary);
      })
      .catch(() => {});
  };

  const loadBilling = () => {
    fetch("/api/account/billing")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) setBillingData(data);
      })
      .catch(() => {});
  };

  // Load profile data when modal opens
  useEffect(() => {
    if (isOpen && session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
      setErrorMsg(null);
      setSuccessMsg(null);
      setCurrentPassword("");
      setNewPassword("");
      setGeminiApiKey("");

      loadProvidersAndUsage();
      loadBilling();

      fetch("/api/account/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            if (data.name) setName(data.name);
            if (data.email) setEmail(data.email);
            setHasKey(data.hasGeminiKey || false);
            setMaskedKey(data.maskedKey || null);

            if (data.personalization) {
              setOnboardingCompleted(data.personalization.onboardingCompleted || false);
              setUserCategory(data.personalization.userCategory || "");
              setUsageContext(data.personalization.usageContext || "");
              setExperienceLevel(data.personalization.experienceLevel || "");
              setOrganizationName(data.personalization.organizationName || "");
              setOrganizationSize(data.personalization.organizationSize || "");
              setPreferredRoles(data.personalization.preferredRoles || []);
              setPreferredWorkModes(data.personalization.preferredWorkModes || []);
              setTargetSkills(data.personalization.targetSkills || []);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, session]);

  const handlePuterConnect = async () => {
    try {
      const u = await puterSignIn();
      if (u) {
        await fetch("/api/account/providers/puter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u.username }),
        });
        toast.success(`Connected Puter account: ${u.username}`);
        loadProvidersAndUsage();
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to connect Puter.");
    }
  };

  const handlePuterDisconnect = async () => {
    try {
      await puterSignOut();
      await fetch("/api/account/providers/puter", { method: "DELETE" });
      toast.info("Disconnected Puter account.");
      loadProvidersAndUsage();
    } catch (err) {
      toast.error((err as Error).message || "Failed to disconnect Puter.");
    }
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setErrorMsg("Password is required to confirm and save profile changes.");
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim() ? email.trim().toLowerCase() : undefined,
          geminiApiKey: geminiApiKey.trim() ? geminiApiKey.trim() : undefined,
          currentPassword,
          newPassword: newPassword.trim() ? newPassword.trim() : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMsg(data.message || "Failed to update profile.");
        return;
      }

      setSuccessMsg("Profile and Gemini API Key updated successfully!");
      toast.success("Profile updated successfully!");

      if (data.user) {
        setHasKey(data.user.hasGeminiKey);
        setMaskedKey(data.user.maskedKey);
        setGeminiApiKey("");
        setCurrentPassword("");
        setNewPassword("");
      }

      // Refresh session
      updateSession();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRedeemCoupon = async () => {
    if (!couponCodeInput.trim()) {
      toast.error("Please enter a coupon code.");
      return;
    }

    setIsRedeemingCoupon(true);
    try {
      const res = await fetch("/api/account/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCodeInput.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || "Failed to redeem coupon.");
        return;
      }

      toast.success(data.message || "Coupon applied successfully!");
      setCouponCodeInput("");
      loadBilling();
    } catch (err) {
      toast.error((err as Error).message || "Failed to redeem coupon.");
    } finally {
      setIsRedeemingCoupon(false);
    }
  };

  const handleUpgradePlan = async (planCode: string) => {
    setIsUpgrading(true);
    try {
      const checkoutRes = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, billingInterval: "MONTHLY" }),
      });

      const checkoutData = await checkoutRes.json().catch(() => ({}));
      if (!checkoutRes.ok) {
        toast.error(checkoutData.message || "Failed to initialize checkout.");
        return;
      }

      // Verification / Provisioning
      const verifyRes = await fetch("/api/billing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: checkoutData.order?.orderId || `order_${Date.now()}`,
          paymentId: `pay_${Date.now()}`,
          planCode,
        }),
      });

      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        toast.error(verifyData.message || "Payment verification failed.");
        return;
      }

      toast.success(verifyData.message || `Upgraded to ${planCode} plan!`);
      loadBilling();
    } catch (err) {
      toast.error((err as Error).message || "Upgrade error.");
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 text-foreground shadow-2xl z-10 overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-border/60">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground font-mono">
                  User Profile & Settings
                </h3>
                <p className="text-xs text-muted-foreground">
                  Manage your credentials and personalization preferences
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-border/50 pb-2 pt-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("ACCOUNT")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === "ACCOUNT"
                    ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Account & Security
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("PERSONALIZATION")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === "PERSONALIZATION"
                    ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Personalization & Context
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("PROVIDERS")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === "PROVIDERS"
                    ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                AI Providers & Usage
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("BILLING")}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  activeTab === "BILLING"
                    ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Billing & Plans
              </button>
            </div>

            {isLoading ? (
              <div className="py-10 flex flex-col items-center justify-center space-y-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs font-mono text-muted-foreground">Loading profile...</p>
              </div>
            ) : activeTab === "BILLING" ? (
              <div className="space-y-4 pt-3 text-xs font-mono">
                {/* Current Plan Overview */}
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block">Current Plan</span>
                      <span className="text-sm font-bold text-foreground">
                        {billingData?.plan?.name || "Community Starter (FREE)"}
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      billingData?.plan?.code === "PREMIUM" 
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                        : "bg-muted text-muted-foreground border border-border/60"
                    }`}>
                      {billingData?.plan?.code || "FREE"}
                    </span>
                  </div>

                  {/* Quota & Limit Progress */}
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Daily Discoveries:</span>
                      <span className="font-semibold text-foreground">
                        {billingData?.quota?.dailyDiscoveries?.used || 0} / {billingData?.quota?.dailyDiscoveries?.limit || 10}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Monthly AI Operations:</span>
                      <span className="font-semibold text-foreground">
                        {billingData?.quota?.monthlyAIOperations?.used || 0} / {billingData?.quota?.monthlyAIOperations?.limit || 100}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Active Watches:</span>
                      <span className="font-semibold text-foreground">
                        {billingData?.quota?.activeWatches?.used || 0} / {billingData?.quota?.activeWatches?.limit || 1}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Upgrade Option for Free users */}
                {billingData?.plan?.code !== "PREMIUM" && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-foreground">Upgrade to Pro Hunter</h4>
                        <p className="text-[10px] text-muted-foreground">
                          High-frequency 2h scans, company targeting & 2,500 AI operations.
                        </p>
                      </div>
                      <span className="text-sm font-bold text-primary font-mono">$19<span className="text-[10px] text-muted-foreground">/mo</span></span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isUpgrading}
                      onClick={() => handleUpgradePlan("PREMIUM")}
                      className="w-full text-xs font-mono"
                    >
                      {isUpgrading ? "Processing..." : "Upgrade to Premium"}
                    </Button>
                  </div>
                )}

                {/* Coupon Code Redemption */}
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2">
                  <span className="text-[11px] font-semibold text-foreground block">Have a promotional coupon?</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={couponCodeInput}
                      onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                      placeholder="e.g. LAUNCH2026"
                      className="h-8 text-xs font-mono uppercase"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={isRedeemingCoupon || !couponCodeInput.trim()}
                      onClick={handleRedeemCoupon}
                      className="h-8 text-xs font-mono shrink-0"
                    >
                      {isRedeemingCoupon ? "Applying..." : "Apply"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : activeTab === "PERSONALIZATION" ? (
              <div className="space-y-4 pt-3 text-xs font-mono">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground uppercase text-[10px]">Onboarding Status</span>
                    <span className={`font-semibold ${onboardingCompleted ? "text-emerald-500" : "text-amber-500"}`}>
                      {onboardingCompleted ? "● Completed (v1)" : "○ Pending Setup"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Category:</span>
                      <span className="font-semibold text-foreground">{userCategory || "Not specified"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Usage Purpose:</span>
                      <span className="font-semibold text-foreground">{usageContext || "Not specified"}</span>
                    </div>
                    {organizationName && (
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Organization:</span>
                        <span className="font-semibold text-foreground">{organizationName} ({organizationSize})</span>
                      </div>
                    )}
                    {experienceLevel && !organizationName && (
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Experience Level:</span>
                        <span className="font-semibold text-foreground">{experienceLevel}</span>
                      </div>
                    )}
                  </div>

                  {preferredWorkModes.length > 0 && (
                    <div className="pt-2 border-t border-border/40">
                      <span className="text-[10px] text-muted-foreground block mb-1">Work Modes:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {preferredWorkModes.map((m) => (
                          <span key={m} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {targetSkills.length > 0 && (
                    <div className="pt-2 border-t border-border/40">
                      <span className="text-[10px] text-muted-foreground block mb-1">Key Skills:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {targetSkills.map((s) => (
                          <span key={s} className="px-2 py-0.5 rounded bg-muted text-foreground text-[10px]">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <p className="text-[11px] text-muted-foreground">
                    Tailor your discovery queries and ranking thresholds.
                  </p>
                  <a
                    href="/app/onboarding"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
                  >
                    Adjust Onboarding →
                  </a>
                </div>
              </div>
            ) : activeTab === "PROVIDERS" ? (
              <div className="space-y-4 pt-3 text-xs font-mono">
                {/* Puter Provider Card */}
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-foreground">Puter AI Integration</span>
                    </div>
                    {isPuterSignedIn ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold text-[10px] flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Connected (@{puterUser?.username || "Puter"})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">
                        Not Connected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Connect your Puter account for free client-side AI execution with Claude 3.7 Sonnet, GPT-4o, and DeepSeek R1.
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground">
                      Quota & Balances: Managed by Puter.js
                    </span>
                    {isPuterSignedIn ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handlePuterDisconnect}
                        className="h-7 text-[11px] font-mono"
                      >
                        Disconnect Puter
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handlePuterConnect}
                        disabled={isPuterAuthenticating || !isPuterLoaded}
                        className="h-7 text-[11px] font-mono gap-1"
                      >
                        {isPuterAuthenticating ? "Connecting..." : "Connect Puter Account"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* BYOK Gemini Key Overview */}
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">BYOK Gemini API Key</span>
                    </div>
                    {hasKey && maskedKey ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold text-[10px]">
                        ● {maskedKey}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">
                        Server Environment Fallback
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Direct server-side Google GenAI pipeline for prompt optimization and planning.
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground">
                      Manage in Account & Security tab
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("ACCOUNT")}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Update Key →
                    </button>
                  </div>
                </div>

                {/* Usage Activity Summary */}
                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-cyan-500" />
                      <span className="font-semibold text-foreground">AI Usage Activity</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {usageSummary?.totalOperations || 0} operations recorded
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="bg-background/60 p-2 rounded border border-border/40">
                      <span className="text-[10px] text-muted-foreground block">Successful</span>
                      <span className="font-semibold text-emerald-500">{usageSummary?.successfulOperations || 0}</span>
                    </div>
                    <div className="bg-background/60 p-2 rounded border border-border/40">
                      <span className="text-[10px] text-muted-foreground block">Tokens Tracked</span>
                      <span className="font-semibold text-foreground">{usageSummary?.totalTokensTracked || 0}</span>
                    </div>
                    <div className="bg-background/60 p-2 rounded border border-border/40">
                      <span className="text-[10px] text-muted-foreground block">Failed / Limit</span>
                      <span className="font-semibold text-rose-400">{usageSummary?.failedOperations || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4 pt-3">
                {errorMsg && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 font-mono flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-mono flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Name & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5 font-mono">
                      <User className="h-3 w-3 text-muted-foreground" />
                      Full Name
                    </label>
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Developer"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5 font-mono">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      Email Address
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="developer@example.com"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* BYOK Gemini API Key Section */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 font-mono">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Gemini API Key (BYOK)
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 font-mono"
                    >
                      Get free key <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>

                  {hasKey && maskedKey && (
                    <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-2">
                      <span className="text-emerald-500 font-semibold">● Active:</span>
                      <span className="bg-background/80 px-2 py-0.5 rounded border border-border/60">
                        {maskedKey}
                      </span>
                    </div>
                  )}

                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder={hasKey ? "Enter new key to replace existing..." : "AIzaSy..."}
                      className="h-9 text-xs font-mono pr-10 bg-background"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    System automatically detects and selects Gemini 3.6 Flash / 3.6 Pro models.
                  </p>
                </div>

                {/* Optional New Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5 font-mono">
                    <KeyRound className="h-3 w-3 text-muted-foreground" />
                    New Password (Optional)
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="h-9 text-xs font-mono"
                  />
                </div>

                {/* Required Current Password for Security Confirmation */}
                <div className="space-y-1.5 pt-1 border-t border-border/40">
                  <label className="text-xs font-semibold text-rose-400 flex items-center gap-1.5 font-mono">
                    <Lock className="h-3.5 w-3.5" />
                    Current Password (Required to Save) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password to confirm changes"
                    className="h-9 text-xs font-mono border-rose-500/30 focus-visible:ring-rose-500/30"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="font-mono text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSaving || !currentPassword}
                    className="font-mono text-xs gap-1.5 shadow-sm"
                  >
                    {isSaving ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Saving Changes...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
