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
  Blocks,
  Compass,
  Zap,
  BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePuter } from "@/hooks/usePuter";
import { useUIState, type ProfileTab } from "@/components/providers/ui-state-provider";
import { PrototypeBadge } from "@/components/ui/prototype-badge";
import { getPlanPrice, formatCurrency } from "@/lib/billing/currency";
import { ConnectorPreferencesPanel } from "@/components/connectors/connector-preferences-modal";
import { CareerMemoryForm } from "@/components/profile/career-memory-form";
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
  const { unreadNotificationsCount, refreshNotifications, currency, setCurrency } = useUIState();

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

  // Lock background body scroll while modal is open to prevent home page scrolling
  useEffect(() => {
    if (isOpen && typeof document !== "undefined") {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [isOpen]);

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

  // Notification Preferences State (Persisted in localStorage)
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("browserpilot_email_alerts");
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return true;
  });
  const [inAppToastsEnabled, setInAppToastsEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("browserpilot_in_app_toasts");
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return true;
  });
  const [dailyDigestEnabled, setDailyDigestEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("browserpilot_daily_digest");
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return false;
  });

  const handleToggleNotificationPref = (key: "email" | "toasts" | "digest", val: boolean) => {
    if (key === "email") {
      setEmailAlertsEnabled(val);
      try { localStorage.setItem("browserpilot_email_alerts", String(val)); } catch {}
      toast.success(val ? "Opportunity match alerts enabled" : "Opportunity match alerts muted");
    } else if (key === "toasts") {
      setInAppToastsEnabled(val);
      try { localStorage.setItem("browserpilot_in_app_toasts", String(val)); } catch {}
      toast.success(val ? "In-app toasts enabled" : "In-app toasts muted");
    } else if (key === "digest") {
      setDailyDigestEnabled(val);
      try { localStorage.setItem("browserpilot_daily_digest", String(val)); } catch {}
      toast.success(val ? "Daily digest enabled" : "Daily digest disabled");
    }
  };

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
      // Synchronize with server-side plugins API & BrowserSession
      if (channel === "twitter") {
        fetch("/api/plugins/x_twitter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: next[channel] ? "CONNECT" : "DISCONNECT" }),
        }).catch(() => {});
      } else if (channel === "linkedIn") {
        fetch("/api/plugins/linkedin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: next[channel] ? "CONNECT" : "DISCONNECT" }),
        }).catch(() => {});
      }
      toast.success(`${channel.toUpperCase()} DeepReach scanner ${next[channel] ? "enabled" : "disabled"}`);
      return next;
    });
  };

  const loadProvidersAndUsage = () => {
    fetch("/api/account/providers")
      .then((res) => res.text())
      .then((raw) => {
        const data = raw && raw.trim().length > 0 ? JSON.parse(raw) : null;
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

    fetch("/api/plugins")
      .then((res) => res.text())
      .then((raw) => {
        const data = raw && raw.trim().length > 0 ? JSON.parse(raw) : null;
        if (Array.isArray(data?.plugins)) {
          const twitterPlugin = data.plugins.find((p: any) => p.id === "x_twitter" || p.id === "twitter" || p.id === "x");
          const linkedinPlugin = data.plugins.find((p: any) => p.id === "linkedin");
          if (twitterPlugin) {
            setDeepReachChannels((prev) => ({ ...prev, twitter: Boolean(twitterPlugin.isConnected) }));
          }
          if (linkedinPlugin) {
            setDeepReachChannels((prev) => ({ ...prev, linkedIn: Boolean(linkedinPlugin.isConnected) }));
          }
        }
      })
      .catch(() => {});

    fetch("/api/account/usage")
      .then((res) => res.text())
      .then((raw) => {
        const data = raw && raw.trim().length > 0 ? JSON.parse(raw) : null;
        if (data?.summary) setUsageSummary(data.summary);
      })
      .catch(() => {});
  };

  const loadBilling = () => {
    fetch("/api/account/billing")
      .then((res) => res.text())
      .then((raw) => {
        const data = raw && raw.trim().length > 0 ? JSON.parse(raw) : null;
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

  // Re-fetch billing quota immediately when switching to Subscription & Quotas tab
  useEffect(() => {
    if (isOpen && activeCategory === "BILLING") {
      loadBilling();
    }
  }, [isOpen, activeCategory]);

  // Synchronize billing quotas whenever a search completes in the background
  useEffect(() => {
    const handleSearchComplete = () => {
      loadBilling();
      loadProvidersAndUsage();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("browserai:search-completed", handleSearchComplete);
      return () => window.removeEventListener("browserai:search-completed", handleSearchComplete);
    }
  }, []);

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
      id: "CONNECTORS",
      label: "Plugins & Connectors",
      shortDesc: "ATS, job boards & radar plugins",
      icon: Blocks,
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
    if (catId === "BILLING") {
      loadBilling();
    }
    if (catId === "PROVIDERS" || catId === "CONNECTORS") {
      loadProvidersAndUsage();
    }
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

              {/* Billing & Display Currency Preference */}
              <div className="pt-3 border-t border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/70">
                  <div>
                    <label className="text-xs font-semibold text-foreground font-sans block">
                      Display & Billing Currency
                    </label>
                    <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                      Choose whether subscription tiers, checkout, and quotas are displayed in USD or INR.
                    </p>
                  </div>
                  <div className="inline-flex items-center bg-muted p-1 rounded-xl border border-border/80 shadow-2xs shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrency("USD");
                        toast.success("Currency Preference Saved", { description: "Active display currency set to USD ($)." });
                      }}
                      className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg transition-all cursor-pointer ${
                        currency === "USD"
                          ? "bg-card text-foreground shadow-xs border border-border/40"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      $ USD
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrency("INR");
                        toast.success("Currency Preference Saved", { description: "Active display currency set to INR (₹)." });
                      }}
                      className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg transition-all cursor-pointer ${
                        currency === "INR"
                          ? "bg-card text-foreground shadow-xs border border-border/40"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      ₹ INR
                    </button>
                  </div>
                </div>
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
                  className="h-9 font-sans text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg cursor-pointer shadow-marble-1 gap-1.5"
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
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-marble-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
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
                    className="h-8 font-sans text-xs rounded-lg border-border/70 hover:text-rose-600 cursor-pointer"
                  >
                    Disconnect Puter
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handlePuterConnect}
                    className="h-8 font-sans text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg cursor-pointer shadow-marble-1 gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Connect Puter Account
                  </Button>
                )}
              </div>
            </div>

            {/* BYOK Gemini Key */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-marble-1">
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
                      className="h-8 text-xs font-sans rounded-lg border-border/80 hover:bg-muted/50 cursor-pointer"
                    >
                      {isReplacingKey ? "Cancel" : "Replace Key"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRemovingGeminiKey}
                      onClick={handleRemoveGeminiKey}
                      className="h-8 text-xs font-sans rounded-lg text-rose-600 border-rose-200/80 hover:bg-rose-50 hover:text-rose-700 cursor-pointer gap-1.5"
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
                        className="h-8 text-xs font-sans rounded-lg cursor-pointer"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSavingGeminiKey || !geminiApiKey.trim()}
                      onClick={handleSaveGeminiKey}
                      className="h-8 font-sans text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg cursor-pointer shadow-marble-1 gap-1.5"
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
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-marble-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
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
                      className="h-8 text-xs font-sans rounded-lg border-border/80 hover:bg-muted/50 cursor-pointer"
                    >
                      {isReplacingDeepseekKey ? "Cancel" : "Replace Key"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRemovingDeepseekKey}
                      onClick={handleRemoveDeepseekKey}
                      className="h-8 text-xs font-sans rounded-lg text-rose-600 border-rose-200/80 hover:bg-rose-50 hover:text-rose-700 cursor-pointer gap-1.5"
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
                        className="h-8 text-xs font-sans rounded-lg cursor-pointer"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSavingDeepseekKey || !deepseekApiKey.trim()}
                      onClick={handleSaveDeepseekKey}
                      className="h-8 font-sans text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg cursor-pointer shadow-marble-1 gap-1.5"
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
              <div className="rounded-2xl border border-border bg-card p-4 text-xs font-mono space-y-2 shadow-marble-1">
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
              <h2 className="text-lg font-sans font-bold text-foreground">Plugins & Connectors</h2>
            </div>

            {/* Direct & Auth Scraper Plugins */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3 shadow-marble-1">
              <ConnectorPreferencesPanel showActions={false} />
            </div>

            {/* Pro DeepReach Multi-Platform Channels */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <h3 className="text-sm font-bold font-sans text-foreground">DeepReach Channels</h3>
                <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                  Active
                </Badge>
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

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3 shadow-marble-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-marble-1 shrink-0">
                    <Blocks className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold font-sans text-foreground">Active Plugins Engine</h3>
                    <p className="text-xs text-muted-foreground font-sans mt-0.5">
                      Monitored sources are driven by our high-yield scraper plugins (~75%+ priority yield). Manage scraper plugins and credentials in the marketplace.
                    </p>
                  </div>
                </div>
                <Link
                  href="/app/plugins"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold font-sans shadow-marble-1 transition-colors shrink-0 cursor-pointer"
                >
                  <span>Open Plugins</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        );

      case "CAREER_MEMORY":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-sans font-bold text-foreground">Career Memory Vault & Personalization</h2>
              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                Configure your verified career context, education, experience, and CGPA band to power autonomous search matching.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-marble-1">
              <CareerMemoryForm />
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
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-marble-1">
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
                      ? "bg-primary/10 text-primary border-primary/20"
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/40 font-sans">
                    {/* Daily Discovery Searches Card */}
                    <div className="p-3.5 rounded-xl border border-border bg-card flex flex-col justify-between space-y-2 hover:border-primary/40 shadow-marble-1 transition-colors">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                          <Compass className="h-3.5 w-3.5 text-primary" />
                          Daily Discovery
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground font-semibold">{discoveriesPercent}%</span>
                      </div>
                      <div className="text-base sm:text-lg font-bold font-mono text-foreground">
                        {todayDiscoveries} <span className="text-xs font-normal text-muted-foreground">/ {maxDailyDiscoveries}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-500" 
                          style={{ width: `${discoveriesPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Autonomous Watches Card */}
                    <div className="p-3.5 rounded-xl border border-border bg-card flex flex-col justify-between space-y-2 hover:border-primary/40 shadow-marble-1 transition-colors">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                          <Radio className="h-3.5 w-3.5 text-primary" />
                          Active Watches
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground font-semibold">{watchesPercent}%</span>
                      </div>
                      <div className="text-base sm:text-lg font-bold font-mono text-foreground">
                        {activeWatches} <span className="text-xs font-normal text-muted-foreground">/ {maxWatches}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-500" 
                          style={{ width: `${watchesPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Monthly AI Operations Card */}
                    <div className="p-3.5 rounded-xl border border-border bg-card flex flex-col justify-between space-y-2 hover:border-primary/40 shadow-marble-1 transition-colors">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-primary" />
                          Monthly AI Ops
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground font-semibold">{aiOpsPercent}%</span>
                      </div>
                      <div className="text-base sm:text-lg font-bold font-mono text-foreground">
                        {monthlyAIOps.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">/ {maxMonthlyAIOps.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-500" 
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
                  className="font-sans text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 rounded-lg cursor-pointer shrink-0 shadow-marble-1"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  View All Plans & Subscriptions
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Coupon Code Input */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-marble-1">
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
                  className="font-sans text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg cursor-pointer shrink-0 shadow-marble-1"
                >
                  {isRedeemingCoupon ? "Applying..." : "Apply Coupon"}
                </Button>
              </div>
            </div>

            {/* Upgrade Plan Action */}
            {billingData?.plan?.code !== "PREMIUM" && (() => {
              const premiumPlan = (billingData as any)?.availablePlans?.find((p: any) => p.code === "PREMIUM");
              const discountPct = premiumPlan?.discountPercentage || 0;
              const planPrice = getPlanPrice("PREMIUM", "MONTHLY", currency);
              const basePrice = planPrice.amount;
              const currencySymbol = planPrice.symbol;
              const offerPrice = discountPct > 0 ? Math.round(basePrice * (1 - discountPct / 100) * 100) / 100 : basePrice;

              return (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3 shadow-marble-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-sans font-bold text-foreground">Upgrade to Pro Explorer</h3>
                        {discountPct > 0 && (
                          <Badge className="bg-primary text-white font-mono text-[10px] px-1.5 py-0 border-none">
                            {discountPct}% OFF DEAL
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-sans mt-0.5">
                        Unlock 10 concurrent autonomous watches, hourly scans, and 2,000 monthly AI operations.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleUpgradePlan("PREMIUM")}
                      disabled={isUpgrading}
                      className="font-sans text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg cursor-pointer shrink-0 shadow-marble-1"
                    >
                      {isUpgrading ? (
                        "Processing..."
                      ) : discountPct > 0 ? (
                        <span>
                          Upgrade (<span className="line-through opacity-75 mr-1">{currencySymbol}{basePrice}</span>{currencySymbol}{offerPrice}/mo)
                        </span>
                      ) : (
                        `Upgrade (${currencySymbol}${basePrice}/mo)`
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-sans font-bold text-foreground">Notification Preferences</h2>
                <p className="text-xs text-muted-foreground font-sans mt-0.5">
                  Configure real-time match dispatching, channel routing, and telemetry toasts.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  toast.success("Notification pipeline test: Live telemetry operational.");
                }}
                className="text-xs font-sans font-medium gap-1.5 border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer self-start sm:self-auto"
              >
                <BellRing className="h-3.5 w-3.5 text-primary" />
                Send Test Toast
              </Button>
            </div>

            {/* Interactive 3-Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card 1: New Matches */}
              <div className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between shadow-marble-1 ${
                emailAlertsEnabled 
                  ? "bg-primary/5 border-primary/30" 
                  : "bg-card border-border"
              }`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${emailAlertsEnabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Radio className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PrototypeBadge label="Prototype (Email Alerts)" />
                      <button
                        type="button"
                        role="switch"
                        aria-checked={emailAlertsEnabled}
                        onClick={() => handleToggleNotificationPref("email", !emailAlertsEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          emailAlertsEnabled ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            emailAlertsEnabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-sans font-bold text-foreground">Role Matches</h3>
                    <p className="text-[11px] text-muted-foreground font-sans mt-0.5 leading-relaxed">
                      Instant trigger when an autonomous watch scan finds a role meeting your fit threshold.
                    </p>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">Frequency</span>
                  <span className={`font-semibold ${emailAlertsEnabled ? "text-primary" : "text-muted-foreground"}`}>
                    {emailAlertsEnabled ? "Instant Trigger" : "Muted"}
                  </span>
                </div>
              </div>

              {/* Card 2: In-App Toasts */}
              <div className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between shadow-marble-1 ${
                inAppToastsEnabled 
                  ? "bg-primary/5 border-primary/30" 
                  : "bg-card border-border"
              }`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${inAppToastsEnabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={inAppToastsEnabled}
                      onClick={() => handleToggleNotificationPref("toasts", !inAppToastsEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        inAppToastsEnabled ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          inAppToastsEnabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <div>
                    <h3 className="text-xs font-sans font-bold text-foreground">In-App Live Stream</h3>
                    <p className="text-[11px] text-muted-foreground font-sans mt-0.5 leading-relaxed">
                      Real-time toast notifications during discovery searches and scheduled watch scans.
                    </p>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">Display</span>
                  <span className={`font-semibold ${inAppToastsEnabled ? "text-primary" : "text-muted-foreground"}`}>
                    {inAppToastsEnabled ? "Stream Active" : "Suppressed"}
                  </span>
                </div>
              </div>

              {/* Card 3: Daily Digest */}
              <div className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between shadow-marble-1 ${
                dailyDigestEnabled 
                  ? "bg-primary/5 border-primary/30" 
                  : "bg-card border-border"
              }`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${dailyDigestEnabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PrototypeBadge label="Prototype (Email Digest)" />
                      <button
                        type="button"
                        role="switch"
                        aria-checked={dailyDigestEnabled}
                        onClick={() => handleToggleNotificationPref("digest", !dailyDigestEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          dailyDigestEnabled ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            dailyDigestEnabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-sans font-bold text-foreground">Daily Briefing</h3>
                    <p className="text-[11px] text-muted-foreground font-sans mt-0.5 leading-relaxed">
                      Consolidated summary of all verified active matches delivered once every 24 hours.
                    </p>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">Cadence</span>
                  <span className={`font-semibold ${dailyDigestEnabled ? "text-primary" : "text-muted-foreground"}`}>
                    {dailyDigestEnabled ? "Every 24h" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Channels & Status Telemetry Card */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-marble-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-sans font-bold text-foreground">Dispatch Channels & Feed Status</h3>
                  <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                    Integrated delivery endpoints receiving active lead signals and platform notices.
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-[10px] border-border text-muted-foreground">
                  2 ENDPOINTS ACTIVE
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <div>
                      <span className="text-xs font-semibold text-foreground block">In-App Notification Feed</span>
                      <span className="text-[10px] text-muted-foreground font-sans">Bell tray & modal inbox updates</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    Connected
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <div>
                      <span className="text-xs font-semibold text-foreground block">Browser Pilot Daemon</span>
                      <span className="text-[10px] text-muted-foreground font-sans">Background scan telemetry listener</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    Synchronized
                  </span>
                </div>
              </div>

              {/* Unread Action Banner */}
              <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                <span className="text-xs font-sans text-muted-foreground">
                  {unreadNotificationsCount > 0 ? (
                    <>You have <strong className="text-foreground">{unreadNotificationsCount} unread</strong> notification(s).</>
                  ) : (
                    <>Notification feed is clean and up-to-date.</>
                  )}
                </span>
                {unreadNotificationsCount > 0 && (
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
                    className="h-7 text-xs font-sans rounded-lg border-border cursor-pointer"
                  >
                    Mark all as read
                  </Button>
                )}
              </div>
            </div>
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
            className="hidden md:flex relative w-full max-w-5xl h-[700px] rounded-3xl border border-border bg-card text-foreground shadow-marble-3 z-10 overflow-hidden"
          >
            {/* LEFT SIDEBAR (Expanded to 260px to prevent text clipping) */}
            <aside className="w-[260px] shrink-0 border-r border-border bg-muted/40 flex flex-col select-none">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-border">
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
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-sans transition-colors cursor-pointer text-left ${
                          isSelected
                            ? "bg-primary/10 text-primary font-semibold shadow-2xs border border-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="font-medium whitespace-nowrap">{cat.label}</span>
                        </div>
                        {cat.badge && (
                          <span className="ml-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground shrink-0 border border-border/50">
                            {cat.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </nav>

              {/* Bottom Pinned Category (Help & Learn More) */}
              <div className="p-2 border-t border-border bg-muted/20">
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
                            ? "bg-primary/10 text-primary font-semibold shadow-2xs border border-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
              </div>
            </aside>

            {/* RIGHT CONTENT PANE */}
            <section className="flex-1 flex flex-col min-w-0 bg-card" aria-label="Settings Details">
              {/* Pane Top Bar with Close Button */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-border">
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
            className="md:hidden fixed inset-0 z-50 bg-background flex flex-col text-foreground overflow-hidden h-[100dvh] max-h-[100dvh]"
          >
            {mobileDetailView === null ? (
              /* VIEW 1: Mobile Category Menu List */
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Mobile Menu Header */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/60 bg-card shrink-0">
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
                <div 
                  className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-2 touch-pan-y"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
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
              <div className="flex-1 min-h-0 flex flex-col bg-card overflow-hidden">
                {/* Detail Top Bar */}
                <div className="flex items-center justify-between px-3 py-3 border-b border-border/60 bg-muted/30 shrink-0">
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
                <div 
                  className="flex-1 min-h-0 p-4 overflow-y-auto overscroll-contain touch-pan-y"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
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
