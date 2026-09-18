"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

export type ProfileTab = 
  | "ACCOUNT" 
  | "PROVIDERS" 
  | "CONNECTORS" 
  | "CAREER_MEMORY" 
  | "PERSONALIZATION" 
  | "BILLING" 
  | "NOTIFICATIONS" 
  | "HELP";

export interface ConnectorMeta {
  id: string;
  name: string;
  displayName?: string | null;
  iconUrl?: string | null;
  baseUrlPattern?: string | null;
  type: string;
}

export interface ConnectorMatch {
  name: string;
  displayName: string;
  iconUrl?: string | null;
  type?: string;
  isRegistered: boolean;
}

interface UIStateContextType {
  // Connectors Registry Cache
  connectors: ConnectorMeta[];
  getConnectorMeta: (sourcePlatform?: string | null, url?: string | null) => ConnectorMatch;
  refreshConnectors: () => Promise<void>;

  // Notifications
  unreadNotificationsCount: number;
  setUnreadNotificationsCount: (count: number) => void;
  refreshNotifications: () => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;

  // Saved / Bookmarks
  savedCount: number;
  setSavedCount: (count: number | ((prev: number) => number)) => void;
  refreshSavedCount: () => Promise<void>;

  // Command Palette
  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;

  // Sidebar State
  isSidebarCollapsed: boolean;
  toggleSidebarCollapse: () => void;
  setIsSidebarCollapsed: (collapsed: boolean) => void;

  // Profile / Settings Modal Overlay
  isProfileModalOpen: boolean;
  profileModalTab: ProfileTab;
  openProfileModal: (tab?: ProfileTab) => void;
  closeProfileModal: () => void;

  // Subscription Tier & Feature Isolation
  planTier: "FREE" | "PREMIUM" | "ENTERPRISE";
  isPaid: boolean;
  isEnterprise: boolean;
  capabilities: Record<string, boolean>;
  canAccessFeature: (featureKey: string) => boolean;
  currency: "USD" | "INR";
  setCurrency: (c: "USD" | "INR") => void;
  refreshBilling: () => Promise<void>;
}

const UIStateContext = createContext<UIStateContextType | null>(null);

export function UIStateProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  const [connectors, setConnectors] = useState<ConnectorMeta[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [savedCount, setSavedCount] = useState<number>(0);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [profileModalTab, setProfileModalTab] = useState<ProfileTab>("ACCOUNT");
  const [isSidebarCollapsed, setIsSidebarCollapsedState] = useState<boolean>(false);

  // Subscription Tier & Capabilities
  const [planTier, setPlanTier] = useState<"FREE" | "PREMIUM" | "ENTERPRISE">("FREE");
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [currency, setCurrencyState] = useState<"USD" | "INR">("USD");

  const setCurrency = useCallback((newCur: "USD" | "INR") => {
    setCurrencyState(newCur);
    try {
      localStorage.setItem("browserpilot_currency_preference", newCur);
    } catch {}
  }, []);

  const refreshBilling = useCallback(async () => {
    try {
      const res = await fetch("/api/account/billing");
      if (res.ok) {
        const raw = await res.text();
        const data = raw && raw.trim().length > 0 ? JSON.parse(raw) : null;
        if (!data) return;
        if (data.planTier) setPlanTier(data.planTier);
        if (typeof data.isPaid === "boolean") setIsPaid(data.isPaid);
        if (data.capabilities) setCapabilities(data.capabilities);
        if (data.currency) {
          const stored = localStorage.getItem("browserpilot_currency_preference");
          if (stored === "INR" || stored === "USD") {
            setCurrencyState(stored);
          } else {
            setCurrencyState(data.currency);
          }
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (session?.user) {
      refreshBilling();
    }
  }, [session, refreshBilling]);

  const canAccessFeature = useCallback((featureKey: string): boolean => {
    const norm = featureKey.toUpperCase();
    if (capabilities[norm] !== undefined) {
      return Boolean(capabilities[norm]);
    }
    if (norm === "PRIORITY_EXECUTION" || norm === "SWARM_FLEET") {
      return planTier === "ENTERPRISE";
    }
    if (norm === "COMPANY_TARGETING" || norm === "ADVANCED_FILTERS" || norm === "CSV_EXPORT" || norm === "PUTER_PREMIUM") {
      return isPaid || planTier === "PREMIUM" || planTier === "ENTERPRISE";
    }
    return true;
  }, [capabilities, planTier, isPaid]);

  // Safely restore collapsed state from localStorage post-hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem("browserpilot_sidebar_collapsed");
      if (saved === "true") {
        setIsSidebarCollapsedState(true);
      }
      const savedCur = localStorage.getItem("browserpilot_currency_preference");
      if (savedCur === "USD" || savedCur === "INR") {
        setCurrencyState(savedCur);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  // Auto-synchronize browser Puter authentication token to server DB if user is logged in
  useEffect(() => {
    if (!session?.user) return;

    let syncInterval: NodeJS.Timeout;
    const checkAndSyncPuter = async () => {
      try {
        if (typeof window === "undefined" || !window.puter?.auth) return;
        if (window.puter.auth.isSignedIn()) {
          const puterUser = await window.puter.auth.getUser().catch(() => null);
          const token =
            (window.puter as any).authToken ||
            localStorage.getItem("puter.auth.token.v2") ||
            undefined;

          if (puterUser?.username && token) {
            await fetch("/api/account/providers/puter", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username: puterUser.username,
                token,
              }),
            }).catch(() => {});
          }
        }
      } catch {
        // Non-blocking
      }
    };

    // Initial check after short delay to let Puter.js load, then every 60s
    const timer = setTimeout(checkAndSyncPuter, 1500);
    syncInterval = setInterval(checkAndSyncPuter, 60000);

    return () => {
      clearTimeout(timer);
      clearInterval(syncInterval);
    };
  }, [session?.user]);

  const setIsSidebarCollapsed = useCallback((collapsed: boolean) => {
    setIsSidebarCollapsedState(collapsed);
    if (typeof window !== "undefined") {
      localStorage.setItem("browserpilot_sidebar_collapsed", collapsed ? "true" : "false");
    }
  }, []);

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsedState((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("browserpilot_sidebar_collapsed", next ? "true" : "false");
      }
      return next;
    });
  }, []);

  // Fetch connector registry metadata once on load & cache in state
  const refreshConnectors = useCallback(async () => {
    try {
      const res = await fetch("/api/connectors");
      if (res.ok) {
        const raw = await res.text();
        const data = raw && raw.trim().length > 0 ? JSON.parse(raw) : null;
        if (data && Array.isArray(data.connectors)) {
          setConnectors(data.connectors);
        }
      }
    } catch {
      // Non-fatal fallback
    }
  }, []);

  // Look up real connector display name, icon, and type with graceful fallback
  const getConnectorMeta = useCallback((sourcePlatform?: string | null, url?: string | null): ConnectorMatch => {
    const p = (sourcePlatform || "").trim();
    const u = (url || "").trim();

    if (!p && !u) {
      return {
        name: "Direct",
        displayName: "Direct Web",
        iconUrl: null,
        type: "CAREER_PORTAL",
        isRegistered: false,
      };
    }

    // 1. Direct exact name or displayName match
    if (p) {
      const match = connectors.find(
        (c) =>
          c.name.toLowerCase() === p.toLowerCase() ||
          (c.displayName && c.displayName.toLowerCase() === p.toLowerCase())
      );
      if (match) {
        return {
          name: match.name,
          displayName: match.displayName || match.name,
          iconUrl: match.iconUrl || null,
          type: match.type,
          isRegistered: true,
        };
      }
    }

    // 2. Substring match
    if (p) {
      const subMatch = connectors.find(
        (c) =>
          p.toLowerCase().includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(p.toLowerCase()) ||
          (c.displayName && p.toLowerCase().includes(c.displayName.toLowerCase()))
      );
      if (subMatch) {
        return {
          name: subMatch.name,
          displayName: subMatch.displayName || subMatch.name,
          iconUrl: subMatch.iconUrl || null,
          type: subMatch.type,
          isRegistered: true,
        };
      }
    }

    // 3. Base URL wildcard match
    if (u) {
      const urlMatch = connectors.find((c) => {
        if (!c.baseUrlPattern) return false;
        try {
          const escaped = c.baseUrlPattern.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
          return new RegExp(escaped, "i").test(u);
        } catch {
          return false;
        }
      });
      if (urlMatch) {
        return {
          name: urlMatch.name,
          displayName: urlMatch.displayName || urlMatch.name,
          iconUrl: urlMatch.iconUrl || null,
          type: urlMatch.type,
          isRegistered: true,
        };
      }
    }

    // 4. Graceful Fallback for unregistered open-web sources
    return {
      name: p || "Direct",
      displayName: p || "Direct Web",
      iconUrl: null,
      type: "CAREER_PORTAL",
      isRegistered: false,
    };
  }, [connectors]);

  // Refresh notifications count from unified endpoint
  const refreshNotifications = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetch("/api/notifications?unreadOnly=true");
      if (res.ok) {
        const raw = await res.text();
        const data = raw && raw.trim().length > 0 ? JSON.parse(raw) : null;
        if (data) setUnreadNotificationsCount(data.unreadCount || 0);
      }
    } catch {
      // Non-fatal
    }
  }, [session?.user]);

  // Refresh saved bookmarks count
  const refreshSavedCount = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetch("/api/opportunities/saved");
      if (res.ok) {
        const raw = await res.text();
        const data = raw && raw.trim().length > 0 ? JSON.parse(raw) : null;
        if (data) setSavedCount(data.saved?.length || 0);
      }
    } catch {
      // Non-fatal
    }
  }, [session?.user]);

  // Load connectors once on mount
  useEffect(() => {
    refreshConnectors();
  }, [refreshConnectors]);

  // Initial & periodic sync for authenticated sessions
  useEffect(() => {
    if (!session?.user) {
      setUnreadNotificationsCount(0);
      setSavedCount(0);
      return;
    }

    refreshNotifications();
    refreshSavedCount();

    const handleRefreshEvent = () => {
      refreshNotifications();
      refreshSavedCount();
      refreshBilling();
    };

    window.addEventListener("browserai:refresh-state", handleRefreshEvent);
    window.addEventListener("browserai:bookmark-updated", handleRefreshEvent);
    window.addEventListener("browserai:search-completed", handleRefreshEvent);

    // Poll at a conservative interval (60s) to keep all badges in sync without load
    const interval = setInterval(() => {
      refreshNotifications();
    }, 60000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("browserai:refresh-state", handleRefreshEvent);
      window.removeEventListener("browserai:bookmark-updated", handleRefreshEvent);
      window.removeEventListener("browserai:search-completed", handleRefreshEvent);
    };
  }, [session?.user, refreshNotifications, refreshSavedCount, refreshBilling]);

  // Mark single notification as read & update unread badge synchronously
  const markNotificationAsRead = useCallback(async (id: string) => {
    try {
      setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
      await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
    } catch {
      refreshNotifications();
    }
  }, [refreshNotifications]);

  // Mark all notifications as read & update unread badge synchronously
  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      setUnreadNotificationsCount(0);
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      refreshNotifications();
    }
  }, [refreshNotifications]);

  // Command palette controls
  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);
  const toggleCommandPalette = useCallback(() => setIsCommandPaletteOpen((prev) => !prev), []);

  // Global keyboard shortcut listener: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCommandPalette();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCommandPalette]);

  // Profile modal controls
  const openProfileModal = useCallback((tab: ProfileTab = "ACCOUNT") => {
    setProfileModalTab(tab);
    setIsProfileOpenCompat(true);
  }, []);

  const closeProfileModal = useCallback(() => {
    setIsProfileModalOpen(false);
  }, []);

  // Helper to maintain compatibility with existing 'open-profile-modal' events
  const setIsProfileOpenCompat = (open: boolean) => {
    setIsProfileModalOpen(open);
  };

  useEffect(() => {
    const handleCustomOpenProfile = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: ProfileTab }>;
      if (customEvent.detail?.tab) {
        setProfileModalTab(customEvent.detail.tab);
      } else {
        setProfileModalTab("ACCOUNT");
      }
      setIsProfileModalOpen(true);
    };

    window.addEventListener("open-profile-modal", handleCustomOpenProfile);
    return () => window.removeEventListener("open-profile-modal", handleCustomOpenProfile);
  }, []);

  const contextValue: UIStateContextType = {
    connectors,
    getConnectorMeta,
    refreshConnectors,

    unreadNotificationsCount,
    setUnreadNotificationsCount,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,

    savedCount,
    setSavedCount,
    refreshSavedCount,

    isCommandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    toggleCommandPalette,

    isSidebarCollapsed,
    toggleSidebarCollapse,
    setIsSidebarCollapsed,

    isProfileModalOpen,
    profileModalTab,
    openProfileModal,
    closeProfileModal,

    // Subscription Tier & Feature Isolation
    planTier,
    isPaid,
    isEnterprise: planTier === "ENTERPRISE",
    capabilities,
    canAccessFeature,
    currency,
    setCurrency,
    refreshBilling,
  };

  return (
    <UIStateContext.Provider value={contextValue}>
      {children}
    </UIStateContext.Provider>
  );
}

export function useUIState(): UIStateContextType {
  const context = useContext(UIStateContext);
  if (!context) {
    throw new Error("useUIState must be used within a UIStateProvider");
  }
  return context;
}
