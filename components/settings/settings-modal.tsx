"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { 
  User, 
  KeyRound, 
  Radio, 
  Sparkles, 
  Brain,
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
  MessageSquare,
  Trash2,
  Hash,
  MessageCircle,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePuter } from "@/hooks/usePuter";
import { useUIState, type ProfileTab } from "@/components/providers/ui-state-provider";
import { ConnectorPreferencesPanel } from "@/components/connectors/connector-preferences-modal";
import { 
  DEFAULT_DEEPREACH_CHANNELS, 
  type DeepReachChannelsPreferences 
} from "@/lib/discovery/deepreach/channels";

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

  // Active Category Selection (defaults to AI Providers)
  const [activeCategory, setActiveCategory] = useState<ProfileTab>(() => {
    if (initialTab === "PERSONALIZATION") return "CAREER_MEMORY";
    return initialTab || "PROVIDERS";
  });

  // Mobile Drilldown Navigation State (null = menu view, string = detail view)
  const [mobileDetailView, setMobileDetailView] = useState<ProfileTab | null>(null);

  // Sync initialTab when opening modal
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        const target = initialTab === "PERSONALIZATION" ? "CAREER_MEMORY" : initialTab;
        setActiveCategory(target);
        if (initialTab === "CAREER_MEMORY" || initialTab === "PERSONALIZATION" || initialTab === "BILLING") {
          setMobileDetailView(target);
        } else {
          setMobileDetailView(null);
        }
      } else {
        setMobileDetailView(null);
      }
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
  const [isSavingGeminiKey, setIsSavingGeminiKey] = useState(false);
  const [isRemovingGeminiKey, setIsRemovingGeminiKey] = useState(false);
  const [isReplacingKey, setIsReplacingKey] = useState(false);
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [maskedDeepseekKey, setMaskedDeepseekKey] = useState<string | null>(null);
  const [hasDeepseekKey, setHasDeepseekKey] = useState(false);
  const [showDeepseekApiKey, setShowDeepseekApiKey] = useState(false);
  const [isSavingDeepseekKey, setIsSavingDeepseekKey] = useState(false);
  const [isRemovingDeepseekKey, setIsRemovingDeepseekKey] = useState(false);
  const [isReplacingDeepseekKey, setIsReplacingDeepseekKey] = useState(false);
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
  const [graduationYear, setGraduationYear] = useState("2026");
  const [autoPersonalize, setAutoPersonalize] = useState(true);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSize, setOrganizationSize] = useState("");
  const [preferredRoles, setPreferredRoles] = useState<string[]>([]);
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [preferredWorkModes, setPreferredWorkModes] = useState<string[]>(["REMOTE"]);
  const [targetSkills, setTargetSkills] = useState<string[]>([]);
  const [newRoleInput, setNewRoleInput] = useState("");
  const [newLocationInput, setNewLocationInput] = useState("");
  const [newSkillInput, setNewSkillInput] = useState("");
  const [isSavingCareerMemory, setIsSavingCareerMemory] = useState(false);

  // Notification Preferences State (Local settings backed by storage)
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [inAppToastsEnabled, setInAppToastsEnabled] = useState(true);
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState(false);

  // Pro DeepReach Channels State (Persisted in localStorage)
  const [deepReachChannels, setDeepReachChannels] = useState<DeepReachChannelsPreferences>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("browserpilot_deepreach_channels");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_DEEPREACH_CHANNELS;
  });

  const handleToggleDeepReachChannel = (channel: keyof DeepReachChannelsPreferences) => {
    setDeepReachChannels((prev) => {
      const next = { ...prev, [channel]: !prev[channel] };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("browserpilot_deepreach_channels", JSON.stringify(next));
        } catch {}
      }
      toast.success(`${channel.toUpperCase()} DeepReach scanner ${next[channel] ? "enabled" : "disabled"}`);
      return next;
    });
  };

  const loadProvidersAndUsage = () => {
    fetch("/api/account/providers")
      .then((res) => res.json())
      .then((data) => {
        if (data?.providers) {
          setConnectedProviders(data.providers);
          const deepseekConn = data.providers.find(
            (p: any) => p.provider === "DEEPSEEK_BYOK" && p.status === "CONNECTED"
          );
          if (deepseekConn) {
            setHasDeepseekKey(true);
            setMaskedDeepseekKey(deepseekConn.maskedCredential);
          } else {
            setHasDeepseekKey(false);
            setMaskedDeepseekKey(null);
          }
        }
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
              setPreferredLocations(data.personalization.preferredLocations || []);
              setPreferredWorkModes(data.personalization.preferredWorkModes || ["REMOTE"]);
              setTargetSkills(data.personalization.targetSkills || []);
              if (data.personalization.graduationYear) {
                setGraduationYear(String(data.personalization.graduationYear));
              }
              if (typeof data.personalization.autoPersonalize === "boolean") {
                setAutoPersonalize(data.personalization.autoPersonalize);
              }
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, session]);

  // Auto-synchronize browser Puter authentication token to server DB if logged in
  useEffect(() => {
    if (isOpen && session?.user && isPuterSignedIn && puterUser?.username) {
      const hasServerPuter = connectedProviders.some(
        (p) => p.providerName?.toUpperCase() === "PUTER" && p.status === "ACTIVE"
      );
      if (!hasServerPuter) {
        const token =
          (typeof window !== "undefined" &&
            (localStorage.getItem("puter.auth.token.v2") || (window as any).puter?.authToken)) ||
          undefined;
        fetch("/api/account/providers/puter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: puterUser.username,
            token,
          }),
        })
          .then((res) => {
            if (res.ok) {
              loadProvidersAndUsage();
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, session, isPuterSignedIn, puterUser?.username, connectedProviders.length]);

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

  const puterProvider = connectedProviders.find((p) => p.providerName?.toUpperCase() === "PUTER" && p.status === "ACTIVE");
  const isEffectivePuterConnected = isPuterSignedIn || !!puterProvider;
  const effectivePuterUsername = puterUser?.username || puterProvider?.accountUsername || "Puter User";

  // Categories Definition (Primary tabs front-and-center, unified plugins)
  const categories: CategoryNavDef[] = [
    {
      id: "PROVIDERS",
      label: "AI Providers & Keys",
      shortDesc: "Puter OAuth, BYOK Gemini, token budget",
      icon: Sparkles,
      badge: isEffectivePuterConnected ? "Puter Active" : hasKey ? "BYOK Active" : undefined,
    },
    {
      id: "CAREER_MEMORY",
      label: "Career Memory & Vault",
      shortDesc: "Target roles, skills, and work modes",
      icon: Briefcase,
    },
    {
      id: "BILLING",
      label: "Subscription & Quotas",
      shortDesc: "Subscription tier, quotas, coupons",
      icon: CreditCard,
      badge: billingData?.plan?.code === "ENTERPRISE" ? "ENTERPRISE" : (billingData?.plan?.code || "FREE"),
    },
    {
      id: "ACCOUNT",
      label: "Account & Security",
      shortDesc: "Profile, credentials, and password",
      icon: User,
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

  const handleSaveGeminiKey = async () => {
    const cleanKey = geminiApiKey.trim();
    if (!cleanKey) {
      toast.error("Please enter a valid Gemini API Key.");
      return;
    }
    if (cleanKey.length < 8) {
      toast.error("Gemini API Key must be at least 8 characters.");
      return;
    }

    setIsSavingGeminiKey(true);
    try {
      const res = await fetch("/api/account/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "GEMINI_BYOK",
          apiKey: cleanKey,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Failed to save API key", { description: data.message || "Unknown error" });
        return;
      }

      toast.success("Gemini API Key saved and activated successfully!");
      setGeminiApiKey("");
      setIsReplacingKey(false);
      loadProvidersAndUsage();
      fetch("/api/account/profile")
        .then((r) => r.json())
        .then((p) => {
          if (p && !p.error) {
            setHasKey(p.hasGeminiKey || false);
            setMaskedKey(p.maskedKey || null);
          }
        })
        .catch(() => {});
    } catch (err: unknown) {
      toast.error("Error saving Gemini key", { description: (err as Error).message });
    } finally {
      setIsSavingGeminiKey(false);
    }
  };

  const handleRemoveGeminiKey = async () => {
    setIsRemovingGeminiKey(true);
    try {
      const res = await fetch("/api/account/providers?provider=GEMINI_BYOK", {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Failed to remove API key", { description: data.message || "Unknown error" });
        return;
      }

      toast.success("Gemini API Key removed from your account.");
      setHasKey(false);
      setMaskedKey(null);
      setGeminiApiKey("");
      setIsReplacingKey(false);
      loadProvidersAndUsage();
      fetch("/api/account/profile")
        .then((r) => r.json())
        .then((p) => {
          if (p && !p.error) {
            setHasKey(p.hasGeminiKey || false);
            setMaskedKey(p.maskedKey || null);
          }
        })
        .catch(() => {});
    } catch (err: unknown) {
      toast.error("Error removing Gemini key", { description: (err as Error).message });
    } finally {
      setIsRemovingGeminiKey(false);
    }
  };

  const handleSaveDeepseekKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = deepseekApiKey.trim();
    if (!cleanKey) {
      toast.error("Please enter a valid DeepSeek API Key.");
      return;
    }
    if (cleanKey.length < 8) {
      toast.error("DeepSeek API Key must be at least 8 characters.");
      return;
    }

    setIsSavingDeepseekKey(true);
    try {
      const res = await fetch("/api/account/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "DEEPSEEK_BYOK",
          apiKey: cleanKey,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Failed to save DeepSeek key", { description: data.message || "Unknown error" });
        return;
      }

      toast.success("DeepSeek API Key saved and activated successfully!");
      setDeepseekApiKey("");
      setIsReplacingDeepseekKey(false);
      setHasDeepseekKey(true);
      if (data.provider?.maskedCredential) {
        setMaskedDeepseekKey(data.provider.maskedCredential);
      }
      loadProvidersAndUsage();
    } catch (err: unknown) {
      toast.error("Error saving DeepSeek key", { description: (err as Error).message });
    } finally {
      setIsSavingDeepseekKey(false);
    }
  };

  const handleRemoveDeepseekKey = async () => {
    setIsRemovingDeepseekKey(true);
    try {
      const res = await fetch("/api/account/providers?provider=DEEPSEEK_BYOK", {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Failed to remove API key", { description: data.message || "Unknown error" });
        return;
      }

      toast.success("DeepSeek API Key removed from your account.");
      setHasDeepseekKey(false);
      setMaskedDeepseekKey(null);
      setDeepseekApiKey("");
      setIsReplacingDeepseekKey(false);
      loadProvidersAndUsage();
    } catch (err: unknown) {
      toast.error("Error removing DeepSeek key", { description: (err as Error).message });
    } finally {
      setIsRemovingDeepseekKey(false);
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
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userCategory: userCategory || undefined,
          usageContext: usageContext || undefined,
          experienceLevel: experienceLevel || undefined,
          graduationYear: graduationYear || undefined,
          autoPersonalize,
          organizationName: organizationName || undefined,
          organizationSize: organizationSize || undefined,
          preferredRoles,
          preferredLocations,
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
    const activeCoupon = couponCodeInput.trim().toUpperCase() || undefined;
    try {
      const checkoutRes = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          planCode, 
          billingInterval: "MONTHLY",
          couponCode: activeCoupon,
        }),
      });

      const checkoutData = await checkoutRes.json().catch(() => ({}));
      if (!checkoutRes.ok) {
        toast.error(checkoutData.message || "Failed to initialize checkout.");
        return;
      }

      if (checkoutData.freeUpgrade) {
        toast.success(checkoutData.message || `Upgraded to ${planCode} plan!`);
        setCouponCodeInput("");
        loadBilling();
        return;
      }

      const verifyRes = await fetch("/api/billing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: checkoutData.order?.orderId || `order_${Date.now()}`,
          paymentId: `pay_${Date.now()}`,
          planCode,
          couponCode: activeCoupon,
        }),
      });

      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        toast.error(verifyData.message || "Payment verification failed.");
        return;
      }

      toast.success(verifyData.message || `Upgraded to ${planCode} plan!`);
      setCouponCodeInput("");
      loadBilling();
    } catch (err) {
      toast.error((err as Error).message || "Upgrade error.");
    } finally {
      setIsUpgrading(false);
    }
  };

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
              <h2 className="text-lg font-sans font-bold text-foreground">Account & Security</h2>
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
                  className="font-sans text-xs bg-background border-border/80 text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground font-sans">Email Address</label>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </span>
                </div>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="font-sans text-xs bg-background border-border/80 text-foreground"
                />
              </div>

              <div className="pt-3 border-t border-border/50 space-y-3">
                <div>
                  <h3 className="text-xs font-semibold font-sans text-foreground">Security & Password</h3>
                  <p className="text-[11px] text-muted-foreground font-sans">
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
                      className="font-sans text-xs bg-background border-border/80 text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground font-sans">New Password (optional)</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Leave blank to keep current"
                      className="font-sans text-xs bg-background border-border/80 text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <Button
                  type="submit"
                  disabled={isSavingProfile}
                  className="h-9 font-sans text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs gap-1.5"
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
              <h2 className="text-lg font-sans font-bold text-foreground">AI Providers & Keys</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Configure execution backends: Connect Puter for free unlimited cloud AI or bring your own Gemini API key.
              </p>
            </div>

            {/* Puter Card */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
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
                    className="h-8 font-sans text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Connect Puter Account
                  </Button>
                )}
              </div>
            </div>

            {/* BYOK Gemini Key */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
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
                <div className="p-3.5 rounded-xl bg-slate-50 border border-border/70 flex items-center justify-between gap-3 text-xs font-mono flex-wrap">
                  <div className="space-y-0.5 min-w-[140px]">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-sans">Active Key</span>
                    <span className="font-bold text-foreground tracking-widest">{maskedKey}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsReplacingKey(!isReplacingKey);
                        setGeminiApiKey("");
                      }}
                      className="h-8 text-xs font-sans border-border/80 hover:bg-muted/50 cursor-pointer"
                    >
                      {isReplacingKey ? "Cancel" : "Replace Key"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRemovingGeminiKey}
                      onClick={handleRemoveGeminiKey}
                      className="h-8 text-xs font-sans text-rose-600 border-rose-200/80 hover:bg-rose-50 hover:text-rose-700 cursor-pointer gap-1.5"
                    >
                      {isRemovingGeminiKey ? (
                        <RotateCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      <span>Remove Key</span>
                    </Button>
                  </div>
                </div>
              )}

              {(!hasKey || isReplacingKey) && (
                <div className="space-y-3 pt-2 border-t border-border/50">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-muted-foreground font-sans">
                        {isReplacingKey ? "Enter New Gemini API Key" : "Enter Gemini API Key"}
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
                    <div className="relative">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="AIzaSy... (min 8 characters)"
                        className="font-mono text-xs pr-10 bg-background border-border/80 text-foreground"
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

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {isReplacingKey && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsReplacingKey(false);
                          setGeminiApiKey("");
                        }}
                        className="h-8 text-xs font-sans cursor-pointer"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSavingGeminiKey || !geminiApiKey.trim()}
                      onClick={handleSaveGeminiKey}
                      className="h-8 font-sans text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs gap-1.5"
                    >
                      {isSavingGeminiKey ? (
                        <>
                          <RotateCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving Key...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>{isReplacingKey ? "Update API Key" : "Save Gemini Key"}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* BYOK DeepSeek Key */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-sans font-bold text-foreground">DeepSeek API (BYOK / Harness)</h3>
                    <p className="text-xs text-muted-foreground font-sans">
                      DeepSeek-V3 & DeepSeek-R1 reasoning models via direct API or Puter
                    </p>
                  </div>
                </div>

                <Badge
                  variant={hasDeepseekKey ? "default" : isEffectivePuterConnected ? "secondary" : "outline"}
                  className={`font-mono text-xs ${
                    hasDeepseekKey
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : isEffectivePuterConnected
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "text-muted-foreground"
                  }`}
                >
                  {hasDeepseekKey ? "Configured" : isEffectivePuterConnected ? "Active via Puter" : "None"}
                </Badge>
              </div>

              {hasDeepseekKey && maskedDeepseekKey && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-border/70 flex items-center justify-between gap-3 text-xs font-mono flex-wrap">
                  <div className="space-y-0.5 min-w-[140px]">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-sans">Active Key</span>
                    <span className="font-bold text-foreground tracking-widest">{maskedDeepseekKey}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsReplacingDeepseekKey(!isReplacingDeepseekKey);
                        setDeepseekApiKey("");
                      }}
                      className="h-8 text-xs font-sans border-border/80 hover:bg-muted/50 cursor-pointer"
                    >
                      {isReplacingDeepseekKey ? "Cancel" : "Replace Key"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRemovingDeepseekKey}
                      onClick={handleRemoveDeepseekKey}
                      className="h-8 text-xs font-sans text-rose-600 border-rose-200/80 hover:bg-rose-50 hover:text-rose-700 cursor-pointer gap-1.5"
                    >
                      {isRemovingDeepseekKey ? (
                        <RotateCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      <span>Remove Key</span>
                    </Button>
                  </div>
                </div>
              )}

              {(!hasDeepseekKey || isReplacingDeepseekKey) && (
                <div className="space-y-3 pt-2 border-t border-border/50">
                  {isEffectivePuterConnected && !hasDeepseekKey && (
                    <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/60 flex items-start gap-2.5 text-xs text-blue-900 font-sans">
                      <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-blue-950">DeepSeek Active via Puter Cloud AI</p>
                        <p className="text-[11px] text-blue-800/90 mt-0.5 leading-relaxed">
                          Your connected Puter account {effectivePuterUsername ? `(@${effectivePuterUsername})` : ""} provides free model access for DeepSeek-V3 and DeepSeek-R1 reasoning. A direct DeepSeek API key is optional and only needed if you wish to use your personal DeepSeek quota.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-muted-foreground font-sans">
                        {isReplacingDeepseekKey ? "Enter New DeepSeek API Key" : "Enter DeepSeek API Key"}
                      </label>
                      <a
                        href="https://platform.deepseek.com/api_keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-primary hover:underline flex items-center gap-1 font-mono"
                      >
                        Get DeepSeek key <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                    <div className="relative">
                      <Input
                        type={showDeepseekApiKey ? "text" : "password"}
                        value={deepseekApiKey}
                        onChange={(e) => setDeepseekApiKey(e.target.value)}
                        placeholder="sk-... (min 8 characters)"
                        className="font-mono text-xs pr-10 bg-background border-border/80 text-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDeepseekApiKey(!showDeepseekApiKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1"
                      >
                        {showDeepseekApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    {isReplacingDeepseekKey && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsReplacingDeepseekKey(false);
                          setDeepseekApiKey("");
                        }}
                        className="h-8 text-xs font-sans cursor-pointer"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSavingDeepseekKey || !deepseekApiKey.trim()}
                      onClick={handleSaveDeepseekKey}
                      className="h-8 font-sans text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs gap-1.5"
                    >
                      {isSavingDeepseekKey ? (
                        <>
                          <RotateCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving Key...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>{isReplacingDeepseekKey ? "Update API Key" : "Save DeepSeek Key"}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Token Usage Summary */}
            {usageSummary && (
              <div className="rounded-xl border border-border/60 bg-[#FBFBFA] p-4 text-xs font-mono space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground uppercase text-[10px] block font-sans font-semibold">Real AI Telemetry & Usage</span>
                  {usageSummary.operationsByProvider && Object.keys(usageSummary.operationsByProvider).length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {Object.keys(usageSummary.operationsByProvider).join(", ")}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span>Tokens Consumed:</span>
                  <span className="font-bold text-foreground">
                    {(usageSummary.totalTokensTracked ?? usageSummary.totalTokens ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Operations Executed:</span>
                  <span className="font-bold text-foreground">
                    {(usageSummary.totalOperations ?? usageSummary.operationsCount ?? 0).toLocaleString()}
                  </span>
                </div>
                {typeof usageSummary.successfulOperations === "number" && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>Successful Operations:</span>
                    <span className="text-emerald-600 font-semibold">{usageSummary.successfulOperations}</span>
                  </div>
                )}
                {Boolean(usageSummary.failedOperations) && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Failed / Rate Limited:</span>
                    <span className="text-amber-600 font-semibold">{usageSummary.failedOperations}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case "CONNECTORS":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-sans font-bold text-foreground">Data Connectors</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Manage all registered job board aggregators, direct ATS platforms, and autonomous guest search channels.
              </p>
            </div>

            {/* Pro DeepReach Multi-Platform Channels */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border/60">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold font-sans text-foreground">Pro DeepReach Channels</h3>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                      Zero-Fee Intelligence
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-sans">
                    Autonomous cross-scanners extracting hidden hiring posts, tech talks, and talent acquisition contacts via Jina Reader.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* LinkedIn Channel */}
                <div className="p-3.5 rounded-xl border border-border/70 bg-muted/40 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 shrink-0 mt-0.5">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground font-sans">LinkedIn Intelligence</div>
                      <div className="text-[11px] text-muted-foreground font-sans leading-snug mt-0.5">
                        Scrapes company recruiters (site:linkedin.com/in) and public postings.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={deepReachChannels.linkedIn}
                    onChange={() => handleToggleDeepReachChannel("linkedIn")}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                </div>

                {/* Twitter / X Channel */}
                <div className="p-3.5 rounded-xl border border-border/70 bg-muted/40 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-sky-50 text-sky-600 border border-sky-100 shrink-0 mt-0.5">
                      <Hash className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground font-sans">Twitter / X Radar</div>
                      <div className="text-[11px] text-muted-foreground font-sans leading-snug mt-0.5">
                        Scouts founder threads, engineering leads, and unlisted hiring announcements.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={deepReachChannels.twitter}
                    onChange={() => handleToggleDeepReachChannel("twitter")}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                </div>

                {/* Reddit Channel */}
                <div className="p-3.5 rounded-xl border border-border/70 bg-muted/40 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-orange-50 text-orange-600 border border-orange-100 shrink-0 mt-0.5">
                      <MessageCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground font-sans">Reddit Referral Network</div>
                      <div className="text-[11px] text-muted-foreground font-sans leading-snug mt-0.5">
                        Queries /r/forhire, /r/cscareerquestions, and community referral posts.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={deepReachChannels.reddit}
                    onChange={() => handleToggleDeepReachChannel("reddit")}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                </div>

                {/* YouTube Channel */}
                <div className="p-3.5 rounded-xl border border-border/70 bg-muted/40 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-red-50 text-red-600 border border-red-100 shrink-0 mt-0.5">
                      <Video className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground font-sans">YouTube Tech Talks</div>
                      <div className="text-[11px] text-muted-foreground font-sans leading-snug mt-0.5">
                        Identifies engineering speakers, team culture spotlights, and career descriptions.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={deepReachChannels.youtube}
                    onChange={() => handleToggleDeepReachChannel("youtube")}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500 cursor-pointer shrink-0"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
              <ConnectorPreferencesPanel onPreferencesSaved={() => {}} />
            </div>
          </div>
        );

      case "CAREER_MEMORY":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-sans font-bold text-foreground">Career Memory & Preferences</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Your personal preferences and background context that inform autonomous watch and opportunity fit scoring.
              </p>
            </div>

            {/* Central Memory Vault Hub Card */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs shrink-0">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold font-sans text-foreground">Central Memory Vault</h3>
                    <p className="text-xs text-muted-foreground font-sans mt-0.5">
                      Target roles, locations, skills, and ranking parameters are centrally managed in your dedicated Memory Vault.
                    </p>
                  </div>
                </div>
                <Link
                  href="/app/settings/memory"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-sans font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shrink-0 shadow-xs cursor-pointer"
                >
                  <span>Open Memory Vault</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Active Preferences Snapshot */}
              <div className="pt-3 border-t border-emerald-500/15 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-border/50">
                  <span className="text-[11px] font-mono text-muted-foreground block mb-1.5 uppercase tracking-wider">Target Roles</span>
                  <div className="flex flex-wrap gap-1">
                    {preferredRoles.length > 0 ? (
                      preferredRoles.slice(0, 4).map((role) => (
                        <span key={role} className="inline-flex px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                          {role}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground italic text-[11px]">None configured</span>
                    )}
                    {preferredRoles.length > 4 && (
                      <span className="text-[11px] text-muted-foreground">+{preferredRoles.length - 4} more</span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-border/50">
                  <span className="text-[11px] font-mono text-muted-foreground block mb-1.5 uppercase tracking-wider">Preferred Locations</span>
                  <div className="flex flex-wrap gap-1">
                    {preferredLocations.length > 0 ? (
                      preferredLocations.slice(0, 4).map((loc) => (
                        <span key={loc} className="inline-flex px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium text-[11px]">
                          {loc}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground italic text-[11px]">Global / Remote</span>
                    )}
                    {preferredLocations.length > 4 && (
                      <span className="text-[11px] text-muted-foreground">+{preferredLocations.length - 4} more</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "BILLING":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-sans font-bold text-foreground">Billing & Plans</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Review your current subscription tier, quota limits, and apply promotional access coupons.
              </p>
            </div>

            {/* Current Plan Card */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase block">Active Subscription</span>
                  <h3 className="text-base font-sans font-bold text-foreground">
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

              {(() => {
                const todayDiscoveries = typeof billingData?.usage?.todayDiscoveries === "object"
                  ? (billingData.usage.todayDiscoveries as any)?.used ?? 0
                  : (billingData?.usage?.todayDiscoveries ?? (billingData?.quota?.dailyDiscoveries?.used ?? 0));
                const maxDailyDiscoveries = billingData?.plan?.maxDailyDiscoveries || 10;
                const activeWatches = typeof billingData?.usage?.activeWatches === "object"
                  ? (billingData.usage.activeWatches as any)?.used ?? 0
                  : (billingData?.usage?.activeWatches ?? (billingData?.quota?.activeWatches?.used ?? 1));
                const maxWatches = billingData?.plan?.maxWatches || 1;
                const monthlyAIOps = typeof billingData?.usage?.monthlyAIOperations === "object"
                  ? (billingData.usage.monthlyAIOperations as any)?.used ?? 0
                  : (billingData?.usage?.monthlyAIOperations ?? (billingData?.quota?.monthlyAIOperations?.used ?? 0));
                const maxMonthlyAIOps = billingData?.plan?.maxMonthlyAIOperations || 100;

                const discoveriesPercent = Math.min(100, Math.round((todayDiscoveries / Math.max(1, maxDailyDiscoveries)) * 100));
                const watchesPercent = Math.min(100, Math.round((activeWatches / Math.max(1, maxWatches)) * 100));
                const aiOpsPercent = Math.min(100, Math.round((monthlyAIOps / Math.max(1, maxMonthlyAIOps)) * 100));

                return (
                  <div className="space-y-3.5 pt-3 border-t border-border/40 font-sans">
                    {/* Daily Discovery Searches Meter */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">Daily Discovery Meter</span>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {todayDiscoveries} / {maxDailyDiscoveries} today ({discoveriesPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-border/40">
                        <div 
                          className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${discoveriesPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Autonomous Watches Meter */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">Active Autonomous Watches</span>
                        <span className="font-mono font-semibold text-foreground">
                          {activeWatches} / {maxWatches} active ({watchesPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-border/40">
                        <div 
                          className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${watchesPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Monthly AI Operations Meter */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">Monthly AI Operations</span>
                        <span className="font-mono font-semibold text-foreground">
                          {monthlyAIOps.toLocaleString()} / {maxMonthlyAIOps.toLocaleString()} ops ({aiOpsPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-border/40">
                        <div 
                          className="bg-amber-600 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${aiOpsPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                  className="font-sans text-xs font-semibold gap-1.5 border-emerald-500/25 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5 cursor-pointer shrink-0"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  View All Plans & Subscriptions
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Coupon Code Input */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3 shadow-sm">
              <h3 className="text-xs font-semibold font-sans text-foreground">Redeem Access Coupon</h3>
              <div className="flex gap-2">
                <Input
                  value={couponCodeInput}
                  onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. LAUNCH2026, STUDENT50"
                  className="font-mono text-xs bg-background border-border/80 text-foreground uppercase"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleRedeemCoupon}
                  disabled={isRedeemingCoupon}
                  className="font-sans text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shrink-0"
                >
                  {isRedeemingCoupon ? "Applying..." : "Apply Coupon"}
                </Button>
              </div>
            </div>

            {/* Upgrade Plan Action */}
            {billingData?.plan?.code !== "PREMIUM" && (() => {
              const premiumPlan = (billingData as any)?.availablePlans?.find((p: any) => p.code === "PREMIUM");
              const discountPct = premiumPlan?.discountPercentage || 0;
              const basePrice = premiumPlan?.priceMonthly ?? 19;
              const offerPrice = discountPct > 0 ? Math.round(basePrice * (1 - discountPct / 100) * 100) / 100 : basePrice;

              return (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-sans font-bold text-emerald-950">Upgrade to Pro Explorer</h3>
                        {discountPct > 0 && (
                          <Badge className="bg-emerald-600 text-white font-mono text-[10px] px-1.5 py-0">
                            {discountPct}% OFF DEAL
                          </Badge>
                        )}
                      </div>
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
                      {isUpgrading ? (
                        "Processing..."
                      ) : discountPct > 0 ? (
                        <span>
                          Upgrade (<span className="line-through opacity-75 mr-1">${basePrice}</span>${offerPrice}/mo)
                        </span>
                      ) : (
                        `Upgrade ($${basePrice}/mo)`
                      )}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        );

      case "NOTIFICATIONS":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-sans font-bold text-foreground">Notification Preferences</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Customize when and how BrowserPilot alerts you about new discovered roles and status updates.
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
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
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500 cursor-pointer"
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
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500 cursor-pointer"
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
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500 cursor-pointer"
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
              <h2 className="text-lg font-sans font-bold text-foreground">Help & Learn More</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Product architecture, keyboard shortcuts, and direct feedback channels.
              </p>
            </div>

            {/* Architecture Overview */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-semibold font-sans text-foreground uppercase tracking-wide">
                  BrowserPilot Intelligence Harness
                </h3>
              </div>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                BrowserPilot executes deterministic web exploration across registered ATS platforms (Greenhouse, Lever, Ashby, Workable, and LinkedIn) with anti-hallucination verification gates. No opportunity is ever displayed without a live, verified employer URL.
              </p>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <CommandIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
            <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-muted/50 hover:bg-muted text-xs font-sans font-medium text-foreground transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>GitHub Repository</span>
                </a>
                <a
                  href="https://github.com/fncreator22/browserpilot/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-muted/50 hover:bg-muted text-xs font-sans font-medium text-foreground transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Report an Issue</span>
                </a>
                <a
                  href="mailto:support@radar.internal"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-muted/50 hover:bg-muted text-xs font-sans font-medium text-foreground transition-colors"
                >
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>support@radar.internal</span>
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

          {/* DESKTOP MODAL (Two-Pane Claude/Slack/Notion Pattern) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="hidden md:flex relative w-full max-w-4xl h-[680px] rounded-2xl border border-border/80 bg-card text-foreground shadow-2xl z-10 overflow-hidden"
          >
            {/* LEFT SIDEBAR (Fixed ~220px) */}
            <aside className="w-[220px] shrink-0 border-r border-border/70 bg-muted/30 flex flex-col select-none">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-border/60">
                <h1 className="text-sm font-sans font-bold text-foreground tracking-tight">Settings</h1>
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
                            ? "bg-muted text-foreground font-semibold shadow-2xs border border-border/70"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-foreground" : "text-muted-foreground"}`} />
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
              <div className="p-2 border-t border-border/60 bg-muted/20">
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
                            ? "bg-muted text-foreground font-semibold shadow-2xs border border-border/70"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-foreground" : "text-muted-foreground"}`} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
              </div>
            </aside>

            {/* RIGHT CONTENT PANE */}
            <section className="flex-1 flex flex-col min-w-0 bg-card" aria-label="Settings Details">
              {/* Pane Top Bar with Close Button */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
                <span className="text-xs font-mono text-muted-foreground">
                  Radar / {categories.find((c) => c.id === activeCategory)?.label}
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
            className="md:hidden fixed inset-0 z-50 bg-background flex flex-col text-foreground overflow-hidden"
          >
            {mobileDetailView === null ? (
              /* VIEW 1: Mobile Category Menu List */
              <div className="flex-1 flex flex-col">
                {/* Mobile Menu Header */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/60 bg-card">
                  <div>
                    <h1 className="text-base font-sans font-bold text-foreground">Settings</h1>
                    <p className="text-[11px] text-muted-foreground font-sans">Select a category to view or edit</p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
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
                        className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 transition-colors cursor-pointer text-left shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/10 text-foreground">
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
              <div className="flex-1 flex flex-col bg-card">
                {/* Detail Top Bar */}
                <div className="flex items-center justify-between px-3 py-3 border-b border-border/60 bg-muted/30">
                  <button
                    type="button"
                    onClick={handleMobileBack}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-sans font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
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
