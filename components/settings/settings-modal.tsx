"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { 
  User, 
  KeyRound, 
  Radio, 
  Sparkles, 
  CreditCard, 
  Bell, 
  HelpCircle, 
  X, 
  ChevronRight, 
  ArrowLeft,
  ArrowRight, 
  ShieldCheck, 
  Check, 
  ExternalLink, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  RotateCw, 
  Building2, 
  Briefcase, 
  CheckCircle2, 
  AlertTriangle,
  SlidersHorizontal,
  Command as CommandIcon,
  LogOut,
  Sliders,
  FileText,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePuter } from "@/hooks/usePuter";
import { useUIState, type ProfileTab } from "@/components/providers/ui-state-provider";
import { ConnectorPreferencesPanel } from "@/components/connectors/connector-preferences-modal";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: ProfileTab;
}

interface CategoryNavDef {
  id: ProfileTab;
  label: string;
  shortDesc: string;
  icon: React.ElementType;
  badge?: string;
  isBottom?: boolean;
}

export function SettingsModal({ isOpen, onClose, initialTab }: SettingsModalProps) {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const { isLoaded: isPuterLoaded, isSignedIn: isPuterSignedIn, user: puterUser, signIn: puterSignIn, signOut: puterSignOut } = usePuter();
  const { unreadNotificationsCount, refreshNotifications } = useUIState();

  // Active Category Selection
  const [activeCategory, setActiveCategory] = useState<ProfileTab>(() => {
    if (initialTab === "PERSONALIZATION") return "CAREER_MEMORY";
    return initialTab || "ACCOUNT";
  });

  // Mobile Drilldown Navigation State (null = menu view, string = detail view)
  const [mobileDetailView, setMobileDetailView] = useState<ProfileTab | null>(() => {
    if (initialTab && initialTab !== "ACCOUNT") {
      return initialTab === "PERSONALIZATION" ? "CAREER_MEMORY" : initialTab;
    }
    return null;
  });

  // Sync initialTab when opening modal
  useEffect(() => {
    if (isOpen && initialTab) {
      const target = initialTab === "PERSONALIZATION" ? "CAREER_MEMORY" : initialTab;
      setActiveCategory(target);
      // On mobile, if a specific deep-link tab is requested (not default ACCOUNT), open detail directly
      if (initialTab !== "ACCOUNT") {
        setMobileDetailView(target);
      } else {
        setMobileDetailView(null);
      }
    } else if (isOpen) {
      setMobileDetailView(null);
    }
  }, [isOpen, initialTab]);

  // Account State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Providers & Usage State
  const [connectedProviders, setConnectedProviders] = useState<any[]>([]);
  const [usageSummary, setUsageSummary] = useState<any | null>(null);

  // Billing & Coupons State
  const [billingData, setBillingData] = useState<any | null>(null);
  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [isRedeemingCoupon, setIsRedeemingCoupon] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Career Memory & Personalization State
  const [userCategory, setUserCategory] = useState("");
  const [usageContext, setUsageContext] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("ENTRY_LEVEL");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSize, setOrganizationSize] = useState("");
  const [preferredRoles, setPreferredRoles] = useState<string[]>([]);
  const [preferredWorkModes, setPreferredWorkModes] = useState<string[]>(["REMOTE"]);
  const [targetSkills, setTargetSkills] = useState<string[]>([]);
  const [newRoleInput, setNewRoleInput] = useState("");
  const [newSkillInput, setNewSkillInput] = useState("");
  const [isSavingCareerMemory, setIsSavingCareerMemory] = useState(false);

  // Notification Preferences State (Local settings backed by storage)
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [inAppToastsEnabled, setInAppToastsEnabled] = useState(true);
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false);

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

  // Load all user data when modal opens
  useEffect(() => {
    if (isOpen && session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
      setCurrentPassword("");
      setNewPassword("");
      setGeminiApiKey("");
      setProfileError(null);

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
              setUserCategory(data.personalization.userCategory || "");
              setUsageContext(data.personalization.usageContext || "");
              setExperienceLevel(data.personalization.experienceLevel || "ENTRY_LEVEL");
              setOrganizationName(data.personalization.organizationName || "");
              setOrganizationSize(data.personalization.organizationSize || "");
              setPreferredRoles(data.personalization.preferredRoles || []);
              setPreferredWorkModes(data.personalization.preferredWorkModes || ["REMOTE"]);
              setTargetSkills(data.personalization.targetSkills || []);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, session]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Categories Definition
  const categories: CategoryNavDef[] = [
    {
      id: "ACCOUNT",
      label: "Account & Security",
      shortDesc: "Profile, credentials, and password",
      icon: User,
    },
    {
      id: "PROVIDERS",
      label: "AI Providers & Keys",
      shortDesc: "Puter OAuth, BYOK Gemini, token budget",
      icon: Sparkles,
      badge: isPuterSignedIn ? "Puter Active" : hasKey ? "BYOK Active" : undefined,
    },
    {
      id: "CONNECTORS",
      label: "Data Connectors",
      shortDesc: "Monitored ATS boards & guest search",
      icon: Radio,
    },
    {
      id: "CAREER_MEMORY",
      label: "Career Memory & Preferences",
      shortDesc: "Target roles, skills, and work modes",
      icon: Briefcase,
    },
    {
      id: "BILLING",
      label: "Billing & Plans",
      shortDesc: "Subscription tier, quotas, coupons",
      icon: CreditCard,
      badge: billingData?.plan?.code || "FREE",
    },
    {
      id: "NOTIFICATIONS",
      label: "Notification Preferences",
      shortDesc: "Lifecycle alerts and toast digests",
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? `${unreadNotificationsCount} unread` : undefined,
    },
    {
      id: "HELP",
      label: "Help & Learn More",
      shortDesc: "Documentation, shortcuts, support",
      icon: HelpCircle,
      isBottom: true,
    },
  ];

  // Puter Handlers
  const handlePuterConnect = async () => {
    try {
      if (!isPuterLoaded) {
        toast.info("Initializing Puter client...");
      }
      const result = await puterSignIn();
      if (result?.user) {
        await fetch("/api/account/providers/puter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: result.user.username,
            token: result.token || undefined,
          }),
        });
        toast.success(`Connected Puter account: ${result.user.username}`);
        loadProvidersAndUsage();
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to connect Puter.");
    }
  };

  const handlePuterDisconnect = async () => {
    try {
      await puterSignOut().catch(() => {});
      await fetch("/api/account/providers/puter", { method: "DELETE" });
      toast.info("Disconnected Puter account.");
      loadProvidersAndUsage();
    } catch (err) {
      toast.error((err as Error).message || "Failed to disconnect Puter.");
    }
  };

  // Account Save Handler
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    if (!currentPassword) {
      setProfileError("Current password is required to verify changes.");
      toast.error("Password Required", { description: "Enter your current password to save profile changes." });
      return;
    }

    setIsSavingProfile(true);
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
        setProfileError(data.message || "Failed to update profile.");
        toast.error("Update Failed", { description: data.message });
        return;
      }

      toast.success("Profile Updated", { description: "Your account credentials have been saved." });
      if (data.user) {
        setHasKey(data.user.hasGeminiKey);
        setMaskedKey(data.user.maskedKey);
        setGeminiApiKey("");
        setCurrentPassword("");
        setNewPassword("");
      }
      updateSession();
    } catch (err) {
      setProfileError((err as Error).message || "An unexpected error occurred.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Career Memory Save Handler
  const handleSaveCareerMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCareerMemory(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userCategory: userCategory || undefined,
          usageContext: usageContext || undefined,
          experienceLevel: experienceLevel || undefined,
          organizationName: organizationName || undefined,
          organizationSize: organizationSize || undefined,
          preferredRoles,
          preferredWorkModes,
          targetSkills,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save career memory.");
      }
      toast.success("Preferences Saved", { description: "Discovery engines will prioritize these criteria." });
    } catch (err) {
      toast.error("Save Error", { description: (err as Error).message });
    } finally {
      setIsSavingCareerMemory(false);
    }
  };

  // Coupon Redemption Handler
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

  // Plan Upgrade Handler
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

  const puterProvider = connectedProviders.find((p) => p.providerName?.toUpperCase() === "PUTER" && p.status === "ACTIVE");
  const isEffectivePuterConnected = isPuterSignedIn || !!puterProvider;
  const effectivePuterUsername = puterUser?.username || puterProvider?.accountUsername || "Puter User";

  // Navigation handlers
  const handleSelectCategory = (catId: ProfileTab) => {
    setActiveCategory(catId);
    setMobileDetailView(catId);
  };

  const handleMobileBack = () => {
    setMobileDetailView(null);
  };

  // Render Right Content Pane
  const renderContentPane = (category: ProfileTab) => {
    switch (category) {
      case "ACCOUNT":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-serif font-bold text-foreground">Account & Security</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Manage your credentials, name, email address, and authentication security.
              </p>
            </div>

            {profileError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground font-sans">Full Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="font-sans text-xs bg-slate-50/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground font-sans">Email Address</label>
                <div className="relative">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="font-sans text-xs bg-slate-50/50 pr-20"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border/50 space-y-3">
                <div>
                  <h3 className="text-xs font-semibold font-sans text-foreground">Security & Password</h3>
                  <p className="text-[11px] text-muted-foreground">
                    To modify your email or change your password, provide your current password.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground font-sans">
                      Current Password <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Required to save"
                      className="font-sans text-xs bg-slate-50/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground font-sans">New Password (optional)</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Leave blank to keep current"
                      className="font-sans text-xs bg-slate-50/50"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <Button
                  type="submit"
                  disabled={isSavingProfile}
                  className="h-9 font-sans text-xs font-semibold bg-[#1F3D2E] hover:bg-[#162d22] text-white cursor-pointer shadow-xs gap-1.5"
                >
                  {isSavingProfile ? (
                    <>
                      <RotateCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Save Account Settings</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-xs font-sans text-muted-foreground hover:text-rose-600 gap-1.5 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </form>
          </div>
        );

      case "PROVIDERS":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-serif font-bold text-foreground">AI Providers & Keys</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Configure execution backends: Connect Puter for free unlimited cloud AI or bring your own Gemini API key.
              </p>
            </div>

            {/* Puter Card */}
            <div className="rounded-2xl border border-border/70 bg-white p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-sans font-bold text-foreground">Puter Cloud AI (Default)</h3>
                    <p className="text-xs text-muted-foreground font-sans">
                      Zero-config, client-side authentication with free model access
                    </p>
                  </div>
                </div>

                <Badge
                  variant={isEffectivePuterConnected ? "default" : "outline"}
                  className={`font-mono text-xs ${
                    isEffectivePuterConnected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "text-muted-foreground"
                  }`}
                >
                  {isEffectivePuterConnected ? "Active" : "Not Connected"}
                </Badge>
              </div>

              <div className="pt-1 flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">
                  {isEffectivePuterConnected ? `Connected as: @${effectivePuterUsername}` : "Connect your Puter account"}
                </span>

                {isEffectivePuterConnected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePuterDisconnect}
                    className="h-8 font-sans text-xs border-border/70 hover:text-rose-600 cursor-pointer"
                  >
                    Disconnect Puter
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handlePuterConnect}
                    className="h-8 font-sans text-xs bg-[#1F3D2E] hover:bg-[#162d22] text-white cursor-pointer shadow-xs gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Connect Puter Account
                  </Button>
                )}
              </div>
            </div>

            {/* BYOK Gemini Key */}
            <div className="rounded-2xl border border-border/70 bg-white p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-sans font-bold text-foreground">Google Gemini API (BYOK)</h3>
                    <p className="text-xs text-muted-foreground font-sans">
                      Bring Your Own Key for direct Google AI Studio quota
                    </p>
                  </div>
                </div>

                <Badge
                  variant={hasKey ? "default" : "outline"}
                  className={`font-mono text-xs ${
                    hasKey ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "text-muted-foreground"
                  }`}
                >
                  {hasKey ? "Configured" : "None"}
                </Badge>
              </div>

              {hasKey && maskedKey && (
                <div className="p-3 rounded-lg bg-slate-50 border border-border/60 flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Active Key:</span>
                  <span className="font-bold text-foreground">{maskedKey}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground font-sans">
                  {hasKey ? "Replace Gemini API Key" : "Enter Gemini API Key"}
                </label>
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="font-mono text-xs pr-10 bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Token Usage Summary */}
            {usageSummary && (
              <div className="rounded-xl border border-border/60 bg-[#FBFBFA] p-4 text-xs font-mono space-y-2">
                <span className="text-muted-foreground uppercase text-[10px] block">Monthly AI Usage</span>
                <div className="flex items-center justify-between">
                  <span>Tokens Consumed:</span>
                  <span className="font-bold text-foreground">{usageSummary.totalTokens?.toLocaleString() || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Operations Executed:</span>
                  <span className="font-bold text-foreground">{usageSummary.operationsCount || 0}</span>
                </div>
              </div>
            )}
          </div>
        );

      case "CONNECTORS":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-serif font-bold text-foreground">Data Connectors</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Manage all registered job board aggregators, direct ATS platforms, and autonomous guest search channels.
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-white p-5 space-y-4 shadow-sm">
              <ConnectorPreferencesPanel onPreferencesSaved={() => {}} />
            </div>
          </div>
        );

      case "CAREER_MEMORY":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-serif font-bold text-foreground">Career Memory & Preferences</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Personalized context that informs all autonomous watch and discovery scoring algorithms.
              </p>
            </div>

            <form onSubmit={handleSaveCareerMemory} className="space-y-5">
              {/* Experience Level & User Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground font-sans">Experience Level</label>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border/70 bg-slate-50/50 px-3 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-[#1F3D2E]"
                  >
                    <option value="INTERN">Intern / Student</option>
                    <option value="ENTRY_LEVEL">Entry Level (0-2 years)</option>
                    <option value="MID">Mid Level (3-5 years)</option>
                    <option value="SENIOR">Senior (5-8 years)</option>
                    <option value="LEAD">Lead / Staff / Principal (8+ years)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground font-sans">Primary User Category</label>
                  <Input
                    value={userCategory}
                    onChange={(e) => setUserCategory(e.target.value)}
                    placeholder="e.g. Software Engineer, Data Scientist"
                    className="font-sans text-xs bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Target Roles */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground font-sans">Target Roles</label>
                <div className="flex gap-2">
                  <Input
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    placeholder="e.g. Full Stack Engineer, Frontend Developer..."
                    className="font-sans text-xs bg-slate-50/50"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (newRoleInput.trim() && !preferredRoles.includes(newRoleInput.trim())) {
                        setPreferredRoles([...preferredRoles, newRoleInput.trim()]);
                        setNewRoleInput("");
                      }
                    }}
                    className="font-sans text-xs cursor-pointer bg-slate-100 hover:bg-slate-200"
                  >
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {preferredRoles.map((role) => (
                    <Badge key={role} variant="secondary" className="font-sans text-xs py-1 px-2.5 gap-1.5 bg-[#1F3D2E]/10 text-[#1F3D2E]">
                      <span>{role}</span>
                      <button
                        type="button"
                        onClick={() => setPreferredRoles(preferredRoles.filter((r) => r !== role))}
                        className="hover:text-rose-500 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {preferredRoles.length === 0 && (
                    <span className="text-xs text-muted-foreground italic font-sans">No target roles specified yet.</span>
                  )}
                </div>
              </div>

              {/* Target Skills */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground font-sans">Target Skills & Tech Stack</label>
                <div className="flex gap-2">
                  <Input
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    placeholder="e.g. React, TypeScript, Next.js, Node.js..."
                    className="font-sans text-xs bg-slate-50/50"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (newSkillInput.trim() && !targetSkills.includes(newSkillInput.trim())) {
                        setTargetSkills([...targetSkills, newSkillInput.trim()]);
                        setNewSkillInput("");
                      }
                    }}
                    className="font-sans text-xs cursor-pointer bg-slate-100 hover:bg-slate-200"
                  >
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {targetSkills.map((skill) => (
                    <Badge key={skill} variant="outline" className="font-sans text-xs py-1 px-2.5 gap-1.5 border-border/70">
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => setTargetSkills(targetSkills.filter((s) => s !== skill))}
                        className="hover:text-rose-500 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {targetSkills.length === 0 && (
                    <span className="text-xs text-muted-foreground italic font-sans">No skills added yet.</span>
                  )}
                </div>
              </div>

              {/* Work Mode Preferences */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground font-sans">Work Mode Preferences</label>
                <div className="flex flex-wrap gap-2">
                  {["REMOTE", "HYBRID", "ON_SITE"].map((mode) => {
                    const isSelected = preferredWorkModes.includes(mode);
                    return (
                      <Button
                        key={mode}
                        type="button"
                        variant={isSelected ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => {
                          if (isSelected) {
                            setPreferredWorkModes(preferredWorkModes.filter((m) => m !== mode));
                          } else {
                            setPreferredWorkModes([...preferredWorkModes, mode]);
                          }
                        }}
                        className={`h-8 font-sans text-xs cursor-pointer ${
                          isSelected ? "bg-[#1F3D2E]/10 text-[#1F3D2E] border-[#1F3D2E]/30 font-semibold" : "text-muted-foreground"
                        }`}
                      >
                        {mode === "ON_SITE" ? "On-Site" : mode.charAt(0) + mode.slice(1).toLowerCase()}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSavingCareerMemory}
                  className="h-9 font-sans text-xs font-semibold bg-[#1F3D2E] hover:bg-[#162d22] text-white cursor-pointer shadow-xs gap-1.5"
                >
                  {isSavingCareerMemory ? (
                    <>
                      <RotateCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Preferences...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Save Career Memory</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        );

      case "BILLING":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-serif font-bold text-foreground">Billing & Plans</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Review your current subscription tier, quota limits, and apply promotional access coupons.
              </p>
            </div>

            {/* Current Plan Card */}
            <div className="rounded-2xl border border-border/70 bg-white p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase block">Active Subscription</span>
                  <h3 className="text-base font-serif font-bold text-foreground">
                    {billingData?.plan?.name || "Community Starter (FREE)"}
                  </h3>
                </div>

                <Badge
                  className={`font-mono text-xs ${
                    billingData?.plan?.code === "PREMIUM"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {billingData?.plan?.code || "FREE"}
                </Badge>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/40 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Autonomous Watches:</span>
                  <span className="font-semibold text-foreground">
                    {billingData?.usage?.activeWatches || 1} / {billingData?.plan?.maxWatches || 1} limit
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Daily Discovery Searches:</span>
                  <span className="font-semibold text-foreground">
                    {billingData?.usage?.todayDiscoveries || 0} / {billingData?.plan?.maxDailyDiscoveries || 10} daily
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Monthly AI Operations:</span>
                  <span className="font-semibold text-foreground">
                    {billingData?.usage?.monthlyAIOperations || 0} / {billingData?.plan?.maxMonthlyAIOperations || 100} monthly
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="text-xs text-muted-foreground font-sans">
                  {billingData?.subscription ? (
                    <span>
                      Billed <span className="font-semibold text-foreground">{billingData.subscription.billingInterval.toLowerCase()}</span>
                      {billingData.subscription.currentPeriodEnd ? ` • Period ends ${new Date(billingData.subscription.currentPeriodEnd).toLocaleDateString()}` : ""}
                    </span>
                  ) : (
                    <span>Looking to upgrade or compare tier quotas?</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    router.push("/app/plans");
                  }}
                  className="font-sans text-xs font-semibold gap-1.5 border-[#1F3D2E]/25 text-[#1F3D2E] hover:bg-[#1F3D2E]/5 cursor-pointer shrink-0"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  View All Plans & Subscriptions
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Coupon Code Input */}
            <div className="rounded-2xl border border-border/70 bg-white p-5 space-y-3 shadow-sm">
              <h3 className="text-xs font-semibold font-sans text-foreground">Redeem Access Coupon</h3>
              <div className="flex gap-2">
                <Input
                  value={couponCodeInput}
                  onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. LAUNCH2026, STUDENT50"
                  className="font-mono text-xs bg-slate-50/50 uppercase"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleRedeemCoupon}
                  disabled={isRedeemingCoupon}
                  className="font-sans text-xs font-semibold bg-[#1F3D2E] hover:bg-[#162d22] text-white cursor-pointer shrink-0"
                >
                  {isRedeemingCoupon ? "Applying..." : "Apply Coupon"}
                </Button>
              </div>
            </div>

            {/* Upgrade Plan Action */}
            {billingData?.plan?.code !== "PREMIUM" && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-sans font-bold text-emerald-950">Upgrade to Pro Explorer</h3>
                    <p className="text-xs text-emerald-800 font-sans mt-0.5">
                      Unlock 10 concurrent autonomous watches, hourly scans, and 2,000 monthly AI operations.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleUpgradePlan("PREMIUM")}
                    disabled={isUpgrading}
                    className="font-sans text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white cursor-pointer shrink-0 shadow-xs"
                  >
                    {isUpgrading ? "Processing..." : "Upgrade ($19/mo)"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );

      case "NOTIFICATIONS":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-serif font-bold text-foreground">Notification Preferences</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Customize when and how BrowserPilot alerts you about new discovered roles and status updates.
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-white p-5 space-y-4 shadow-sm">
              <div className="space-y-3 divide-y divide-border/40">
                <div className="flex items-center justify-between pb-3">
                  <div>
                    <span className="text-xs font-semibold font-sans text-foreground block">New Opportunity Matches</span>
                    <span className="text-[11px] text-muted-foreground font-sans">
                      Alert immediately when an autonomous watch scan finds a role meeting your fit threshold
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlertsEnabled}
                    onChange={(e) => {
                      setEmailAlertsEnabled(e.target.checked);
                      toast.success(e.target.checked ? "Opportunity match alerts enabled" : "Opportunity match alerts muted");
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-[#1F3D2E] focus:ring-[#1F3D2E] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <span className="text-xs font-semibold font-sans text-foreground block">In-App Live Toasts</span>
                    <span className="text-[11px] text-muted-foreground font-sans">
                      Show real-time toast notifications during discovery searches and scheduled scans
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={inAppToastsEnabled}
                    onChange={(e) => {
                      setInAppToastsEnabled(e.target.checked);
                      toast.success(e.target.checked ? "In-app toasts enabled" : "In-app toasts muted");
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-[#1F3D2E] focus:ring-[#1F3D2E] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-3">
                  <div>
                    <span className="text-xs font-semibold font-sans text-foreground block">Daily Summary Digest</span>
                    <span className="text-[11px] text-muted-foreground font-sans">
                      Receive a consolidated summary of all verified active matches every 24 hours
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={dailyDigestEnabled}
                    onChange={(e) => {
                      setDailyDigestEnabled(e.target.checked);
                      toast.success(e.target.checked ? "Daily digest enabled" : "Daily digest disabled");
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-[#1F3D2E] focus:ring-[#1F3D2E] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {unreadNotificationsCount > 0 && (
              <div className="p-4 rounded-xl bg-slate-50 border border-border/60 flex items-center justify-between">
                <span className="text-xs font-sans text-muted-foreground">
                  You have <strong className="text-foreground">{unreadNotificationsCount} unread</strong> notification(s).
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await fetch("/api/notifications", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "MARK_ALL_READ" }),
                    });
                    await refreshNotifications();
                    toast.success("All notifications marked as read");
                  }}
                  className="h-7 text-xs font-sans border-border/70 cursor-pointer"
                >
                  Mark all as read
                </Button>
              </div>
            )}
          </div>
        );

      case "HELP":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-serif font-bold text-foreground">Help & Learn More</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Product architecture, keyboard shortcuts, and direct feedback channels.
              </p>
            </div>

            {/* Architecture Overview */}
            <div className="rounded-2xl border border-border/70 bg-white p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <ShieldCheck className="h-4 w-4 text-[#1F3D2E]" />
                <h3 className="text-xs font-semibold font-sans text-foreground uppercase tracking-wide">
                  BrowserPilot Intelligence Harness
                </h3>
              </div>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                BrowserPilot executes deterministic web exploration across registered ATS platforms (Greenhouse, Lever, Ashby, Workable, and LinkedIn) with anti-hallucination verification gates. No opportunity is ever displayed without a live, verified employer URL.
              </p>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="rounded-2xl border border-border/70 bg-white p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <CommandIcon className="h-4 w-4 text-[#1F3D2E]" />
                <h3 className="text-xs font-semibold font-sans text-foreground uppercase tracking-wide">
                  Keyboard Navigation Shortcuts
                </h3>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between pb-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Open Command Palette:</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[11px]">⌘K / Ctrl+K</kbd>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Close Modal or Dialog:</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[11px]">Escape</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Submit Search / Save:</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[11px]">Enter</kbd>
                </div>
              </div>
            </div>

            {/* Honest Support & Feedback Links */}
            <div className="rounded-2xl border border-border/70 bg-white p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <MessageSquare className="h-4 w-4 text-[#1F3D2E]" />
                <h3 className="text-xs font-semibold font-sans text-foreground uppercase tracking-wide">
                  Support & Community Feedback
                </h3>
              </div>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                BrowserPilot is currently in active development. Please report issues, suggest connector integrations, or review technical documentation directly via GitHub:
              </p>
              <div className="pt-2 flex flex-wrap gap-2.5">
                <a
                  href="https://github.com/fncreator22/browserpilot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-slate-50 hover:bg-slate-100 text-xs font-sans font-medium text-foreground transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>GitHub Repository</span>
                </a>
                <a
                  href="https://github.com/fncreator22/browserpilot/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-slate-50 hover:bg-slate-100 text-xs font-sans font-medium text-foreground transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Report an Issue</span>
                </a>
                <a
                  href="mailto:support@browserpilot.internal"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-slate-50 hover:bg-slate-100 text-xs font-sans font-medium text-foreground transition-colors"
                >
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>support@browserpilot.internal</span>
                </a>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
          />

          {/* DESKTOP MODAL (Two-Pane Claude/Slack/VS Code Pattern) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="hidden md:flex relative w-full max-w-4xl h-[640px] rounded-2xl border border-border/80 bg-white text-foreground shadow-2xl z-10 overflow-hidden"
          >
            {/* LEFT SIDEBAR (Fixed ~230px) */}
            <aside className="w-[230px] shrink-0 border-r border-[#E6E6E3] bg-[#FBFBFA] flex flex-col select-none">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-[#E6E6E3]">
                <h1 className="text-sm font-serif font-bold text-foreground tracking-tight">Settings</h1>
                <p className="text-[11px] text-muted-foreground font-sans">Configuration & Preferences</p>
              </div>

              {/* Main Categories List */}
              <nav className="flex-1 p-2 space-y-1 overflow-y-auto" aria-label="Settings Categories">
                {categories
                  .filter((cat) => !cat.isBottom)
                  .map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = activeCategory === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategory(cat.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-sans transition-colors cursor-pointer text-left ${
                          isSelected
                            ? "bg-[#1F3D2E]/10 text-[#1F3D2E] font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-[#1F3D2E]" : "text-muted-foreground"}`} />
                          <span className="truncate">{cat.label}</span>
                        </div>
                        {cat.badge && (
                          <span className="ml-1 text-[9px] font-mono px-1.5 py-0.2 rounded bg-muted/80 text-muted-foreground shrink-0">
                            {cat.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </nav>

              {/* Bottom Pinned Category (Help & Learn More) */}
              <div className="p-2 border-t border-[#E6E6E3] bg-[#F9F9F7]">
                {categories
                  .filter((cat) => cat.isBottom)
                  .map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = activeCategory === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategory(cat.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-sans transition-colors cursor-pointer text-left ${
                          isSelected
                            ? "bg-[#1F3D2E]/10 text-[#1F3D2E] font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-[#1F3D2E]" : "text-muted-foreground"}`} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
              </div>
            </aside>

            {/* RIGHT CONTENT PANE */}
            <section className="flex-1 flex flex-col min-w-0 bg-white" aria-label="Settings Details">
              {/* Pane Top Bar with Close Button */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
                <span className="text-xs font-mono text-muted-foreground">
                  BrowserPilot / {categories.find((c) => c.id === activeCategory)?.label}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Close settings"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 p-6 sm:p-8 overflow-y-auto">
                {renderContentPane(activeCategory)}
              </div>
            </section>
          </motion.div>

          {/* MOBILE FULL-SCREEN SHEET (Category Menu -> Slide to Detail) */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="md:hidden fixed inset-0 z-50 bg-[#FBFBFA] flex flex-col text-foreground overflow-hidden"
          >
            {mobileDetailView === null ? (
              /* VIEW 1: Mobile Category Menu List */
              <div className="flex-1 flex flex-col">
                {/* Mobile Menu Header */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/60 bg-white">
                  <div>
                    <h1 className="text-base font-serif font-bold text-foreground">Settings</h1>
                    <p className="text-[11px] text-muted-foreground font-sans">Select a category to view or edit</p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-full text-muted-foreground hover:bg-slate-100 hover:text-foreground cursor-pointer"
                    aria-label="Close settings"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Categories List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategory(cat.id)}
                        className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-left shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1F3D2E]/10 text-[#1F3D2E]">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-sans font-semibold text-foreground block truncate">
                              {cat.label}
                            </span>
                            <span className="text-[11px] font-sans text-muted-foreground block truncate">
                              {cat.shortDesc}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {cat.badge && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
                              {cat.badge}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* VIEW 2: Mobile Category Detail View with Back Button */
              <div className="flex-1 flex flex-col bg-white">
                {/* Detail Top Bar */}
                <div className="flex items-center justify-between px-3 py-3 border-b border-border/60 bg-[#FBFBFA]">
                  <button
                    type="button"
                    onClick={handleMobileBack}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-sans font-medium text-[#1F3D2E] hover:bg-[#1F3D2E]/10 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-full text-muted-foreground hover:bg-slate-100 hover:text-foreground cursor-pointer"
                    aria-label="Close settings"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Detail Content */}
                <div className="flex-1 p-4 overflow-y-auto">
                  {renderContentPane(mobileDetailView)}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
