"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { 
  Compass, 
  Bookmark, 
  Eye, 
  Bell, 
  Search, 
  User, 
  PanelLeftClose,
  PanelLeftOpen,
  Brain,
  ShieldCheck,
  Puzzle,
  Briefcase,
  Clock,
  MoreHorizontal,
  Pin,
  PinOff,
  Edit2,
  Share2,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { useUIState } from "@/components/providers/ui-state-provider";
import { ADMIN_UI_ROUTES } from "@/lib/admin/adminRoutes";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { 
    unreadNotificationsCount, 
    savedCount, 
    openCommandPalette, 
    openProfileModal,
    isSidebarCollapsed,
    toggleSidebarCollapse,
    isSearching,
    activeQuery
  } = useUIState();

  interface RecentSearchItem {
    id: string;
    rawQuery: string;
    title?: string;
    isPinned?: boolean;
    isSaved?: boolean;
    createdAt: string;
    totalFound?: number;
  }

  const [recentSearches, setRecentSearches] = React.useState<RecentSearchItem[]>([]);
  const [isHistoryExpanded, setIsHistoryExpanded] = React.useState(true);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);

  // Close context menu on external click or Escape key
  React.useEffect(() => {
    const handleWindowClick = () => setActiveMenuId(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenuId(null);
        setEditingId(null);
      }
    };
    window.addEventListener("click", handleWindowClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleWindowClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    async function loadSearches() {
      try {
        const res = await fetch("/api/search/history?limit=30");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.history) {
            setRecentSearches(data.history);
          }
        }
      } catch {}
    }
    loadSearches();
    return () => {
      isMounted = false;
    };
  }, [isSearching]);

  const handleTogglePin = async (e: React.MouseEvent, item: RecentSearchItem) => {
    e.stopPropagation();
    setActiveMenuId(null);
    const nextPinned = !item.isPinned;
    setRecentSearches((prev) =>
      prev
        .map((s) => (s.id === item.id ? { ...s, isPinned: nextPinned } : s))
        .sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
    );
    try {
      await fetch(`/api/search/history/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: nextPinned }),
      });
      toast.success(nextPinned ? "Chat pinned to top" : "Chat unpinned");
    } catch {
      toast.error("Failed to update pin status");
    }
  };

  const handleStartRename = (e: React.MouseEvent, item: RecentSearchItem) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setEditingId(item.id);
    setEditTitle(item.title || item.rawQuery);
  };

  const handleSaveRename = async (id: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    setRecentSearches((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s))
    );
    setEditingId(null);
    try {
      await fetch(`/api/search/history/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      toast.success("Chat renamed");
    } catch {
      toast.error("Failed to rename chat");
    }
  };

  const handleShare = async (e: React.MouseEvent, item: RecentSearchItem) => {
    e.stopPropagation();
    setActiveMenuId(null);
    try {
      const res = await fetch(`/api/search/history/${item.id}`, { method: "POST" });
      const data = await res.json();
      const url = data.share?.shareUrl || `${window.location.origin}/app?searchId=${item.id}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Failed to copy share link");
    }
  };

  const handleToggleSave = async (e: React.MouseEvent, item: RecentSearchItem) => {
    e.stopPropagation();
    setActiveMenuId(null);
    const nextSaved = !item.isSaved;
    setRecentSearches((prev) =>
      prev.map((s) => (s.id === item.id ? { ...s, isSaved: nextSaved } : s))
    );
    try {
      await fetch(`/api/search/history/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSaved: nextSaved }),
      });
      toast.success(nextSaved ? "Search saved" : "Search removed from saved");
    } catch {
      toast.error("Failed to update saved status");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setRecentSearches((prev) => prev.filter((s) => s.id !== id));
    try {
      const res = await fetch(`/api/search/history/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Conversation deleted");
      } else {
        toast.error("Failed to delete conversation");
      }
    } catch {
      toast.error("Network error deleting conversation");
    }
  };

  const [trialStatus, setTrialStatus] = React.useState<any>(null);

  React.useEffect(() => {
    let isMounted = true;
    async function loadTrial() {
      try {
        const res = await fetch("/api/account/trial");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.trial) {
            setTrialStatus(data.trial);
          }
        }
      } catch {}
    }
    if (session?.user) {
      loadTrial();
    }
    return () => {
      isMounted = false;
    };
  }, [session?.user]);

  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === "ADMIN" || userRole === "SUPERADMIN";

  const navItems = [
    {
      href: "/app",
      label: "Discover",
      icon: Compass,
      isActive: pathname === "/app",
    },
    {
      href: "/app/marketplace",
      label: "Job Market",
      icon: Briefcase,
      isActive: pathname === "/app/marketplace",
    },
    {
      href: "/app/watch",
      label: "Autonomous Watch",
      icon: Eye,
      isActive: pathname === "/app/watch",
    },
    {
      href: "/app/plugins",
      label: "AI Connectors",
      icon: Puzzle,
      isActive: pathname === "/app/plugins",
    },
    {
      href: "/app/saved",
      label: "Saved Opportunities",
      icon: Bookmark,
      badge: savedCount > 0 ? savedCount : undefined,
      isActive: pathname === "/app/saved",
    },
    {
      href: "/app/notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
      badgeColor: "bg-rose-500",
      isActive: pathname === "/app/notifications",
    },
    ...(isAdmin ? [{
      href: ADMIN_UI_ROUTES.OVERVIEW,
      label: "Admin Observatory",
      icon: ShieldCheck,
      badgeColor: "bg-blue-600",
      isActive: pathname?.startsWith("/ops-sec-"),
    }] : []),
  ];

  const userName = session?.user?.name || "Engineering Lead";
  const userEmail = session?.user?.email || "lead@browserpilot.internal";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <aside 
      aria-label="Application Sidebar"
      className={`hidden lg:flex flex-col h-screen fixed top-0 left-0 bg-background border-r border-border z-30 select-none overflow-hidden transition-[width] duration-200 ease-in-out ${
        isSidebarCollapsed ? "w-[68px]" : "w-[216px]"
      }`}
    >
      {/* Brand Header & Collapse Toggle */}
      <div className={`py-3.5 border-b border-border flex items-center justify-between ${
        isSidebarCollapsed ? "px-2 flex-col gap-2" : "px-3.5"
      }`}>
        <Link 
          href="/app" 
          prefetch={false}
          className="flex items-center gap-2.5 group overflow-hidden"
          title="BrowserPilot Discovery Engine"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-marble-1 group-hover:opacity-90 transition-opacity">
            <Compass className="h-4 w-4 stroke-[2]" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col min-w-0 transition-opacity duration-200">
              <span className="text-sm font-sans font-bold text-foreground tracking-tight leading-tight truncate">
                BrowserPilot
              </span>
              <span className="text-[10px] text-muted-foreground font-sans truncate">
                Discovery Engine
              </span>
            </div>
          )}
        </Link>

        <div className={isSidebarCollapsed ? "tooltip tooltip-right" : ""} data-tip={isSidebarCollapsed ? "Expand sidebar" : undefined}>
          <button
            type="button"
            onClick={toggleSidebarCollapse}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
            title={!isSidebarCollapsed ? "Collapse sidebar" : undefined}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4 stroke-[1.75]" />
            ) : (
              <PanelLeftClose className="h-4 w-4 stroke-[1.75]" />
            )}
          </button>
        </div>
      </div>

      {/* Quick Command Trigger */}
      <div className={`pt-3 pb-2 ${isSidebarCollapsed ? "px-2" : "px-3"}`}>
        {isSidebarCollapsed ? (
          <div className="tooltip tooltip-right w-full" data-tip="Quick search (⌘K)">
            <button
              type="button"
              onClick={openCommandPalette}
              className="w-full flex items-center justify-center p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-marble-1"
              aria-label="Quick search (⌘K)"
            >
              <Search className="h-4 w-4 stroke-[1.75]" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openCommandPalette}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-marble-1 group"
            title="Search or jump (⌘K)"
          >
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 stroke-[1.75] text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              <span className="text-[11px] font-sans">Quick search...</span>
            </span>
            <kbd className="kbd kbd-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Navigation Links with High-Contrast Active State */}
      <nav className={`flex-1 py-2 space-y-1 overflow-y-auto overflow-x-hidden ${isSidebarCollapsed ? "px-2" : "px-3"}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          if (isSidebarCollapsed) {
            return (
              <div key={item.href} className="tooltip tooltip-right w-full" data-tip={item.label}>
                <Link
                  href={item.href}
                  prefetch={false}
                  className={`relative flex items-center justify-center py-2.5 px-0 rounded-lg transition-colors ${
                    active
                      ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
                  }`}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={`h-4 w-4 shrink-0 transition-colors ${
                    active ? "text-primary stroke-[2.25]" : "text-muted-foreground stroke-[1.75]"
                  }`} />
                  {item.badge !== undefined && (
                    <span 
                      className={`absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-mono font-bold text-white shadow-xs ${
                        item.badgeColor || "bg-primary"
                      }`}
                    >
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </Link>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-sans transition-colors ${
                active
                  ? "bg-primary/10 text-primary font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-primary before:rounded-r-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`h-4 w-4 shrink-0 transition-colors ${
                  active ? "text-primary stroke-[2.25]" : "text-muted-foreground stroke-[1.75]"
                }`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span 
                  className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-mono font-bold text-white shrink-0 ${
                    item.badgeColor || "bg-primary"
                  }`}
                >
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Recent Searches / Conversations (ChatGPT and Claude style) */}
      {!isSidebarCollapsed ? (
        <div className="border-t border-border py-2 px-2.5 flex flex-col min-h-0 shrink-0 bg-background/50">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <button
              type="button"
              onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
              className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
              title={isHistoryExpanded ? "Minimize history section" : "Expand history section"}
            >
              {isHistoryExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-transform" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-transform" />
              )}
              <span>Recent Searches</span>
              {recentSearches.length > 0 && (
                <span className="font-mono text-[9px] text-muted-foreground/80 bg-muted/60 px-1 rounded">
                  {recentSearches.length}
                </span>
              )}
            </button>
          </div>

          {isHistoryExpanded && (
            <div className="space-y-0.5 max-h-[300px] overflow-y-auto scrollbar-none pr-0.5 relative">
              {/* Active in-flight search conversation item */}
              {isSearching && (
                <Link
                  href="/app"
                  prefetch={false}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-xs font-sans text-primary group shadow-2xs transition-colors mb-1"
                  title={activeQuery || "Active Search"}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="flex items-center gap-0.5 shrink-0 text-primary">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                    </div>
                    <span className="truncate text-[11px] font-semibold text-foreground">
                      {activeQuery || "Searching roles..."}
                    </span>
                  </div>
                </Link>
              )}

              {recentSearches.map((item, idx) => (
                <div key={item.id} className="relative group/item">
                  {editingId === item.id ? (
                    <div className="flex items-center gap-1 p-1 rounded-md bg-muted/90 border border-primary/40">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleSaveRename(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename(item.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                        className="flex-1 bg-background text-[11px] font-sans text-foreground px-1.5 py-0.5 rounded border border-border/80 focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(item.id)}
                        className="p-1 rounded text-primary hover:bg-primary/10 transition-colors"
                        title="Save name"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors"
                        title="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        if (pathname === "/app") {
                          window.dispatchEvent(
                            new CustomEvent("browserai:load-search", {
                              detail: { searchId: item.id, rawQuery: item.rawQuery },
                            })
                          );
                        } else {
                          router.push(`/app?searchId=${item.id}`);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-sans transition-all text-left cursor-pointer ${
                        item.isPinned
                          ? "bg-primary/5 text-foreground font-medium border-l-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      }`}
                      title={item.title || item.rawQuery}
                    >
                      <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pr-1">
                        {item.isPinned && (
                          <Pin className="h-2.5 w-2.5 text-primary shrink-0 rotate-45" />
                        )}
                        {item.isSaved && !item.isPinned && (
                          <Bookmark className="h-2.5 w-2.5 text-primary shrink-0 fill-primary/30" />
                        )}
                        <span className="truncate flex-1">{item.title || item.rawQuery}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {item.totalFound !== undefined && item.totalFound > 0 && (
                          <span className="text-[9px] font-mono text-muted-foreground/70 group-hover/item:opacity-0 transition-opacity">
                            {item.totalFound}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === item.id ? null : item.id);
                          }}
                          className={`p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 transition-opacity cursor-pointer ${
                            activeMenuId === item.id ? "opacity-100 bg-muted-foreground/15 text-foreground" : "opacity-0 group-hover/item:opacity-100"
                          }`}
                          title="Chat options"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3-Dot Dropdown Context Menu */}
                  {activeMenuId === item.id && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute right-0 ${idx >= recentSearches.length - 2 && recentSearches.length > 2 ? "bottom-full mb-1" : "top-full mt-0.5"} w-36 py-1 bg-card border border-border/80 rounded-lg shadow-xl z-50 text-[11px] font-sans text-foreground backdrop-blur-md animate-in fade-in zoom-in-95 duration-100`}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleTogglePin(e, item)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted text-left transition-colors cursor-pointer"
                      >
                        {item.isPinned ? (
                          <>
                            <PinOff className="h-3 w-3 text-muted-foreground" />
                            <span>Unpin</span>
                          </>
                        ) : (
                          <>
                            <Pin className="h-3 w-3 text-muted-foreground" />
                            <span>Pin to top</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleStartRename(e, item)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted text-left transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-3 w-3 text-muted-foreground" />
                        <span>Rename</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleShare(e, item)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted text-left transition-colors cursor-pointer"
                      >
                        <Share2 className="h-3 w-3 text-muted-foreground" />
                        <span>Share</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleToggleSave(e, item)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted text-left transition-colors cursor-pointer"
                      >
                        <Bookmark className="h-3 w-3 text-muted-foreground" />
                        <span>{item.isSaved ? "Unsave" : "Save search"}</span>
                      </button>

                      <div className="my-1 border-t border-border/60" />

                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, item.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-left transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {recentSearches.length === 0 && !isSearching && (
                <div className="px-2 py-1 text-[11px] text-muted-foreground/60 italic font-sans">
                  No recent searches
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="border-t border-border py-2 px-2 flex flex-col items-center gap-1 shrink-0 bg-background/50">
          {isSearching && (
            <div className="tooltip tooltip-right w-full" data-tip={`Searching: ${activeQuery || "Active Search"}`}>
              <Link
                href="/app"
                prefetch={false}
                className="flex items-center justify-center p-2 rounded-lg bg-primary/10 text-primary"
              >
                <div className="flex items-center gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                </div>
              </Link>
            </div>
          )}
          <div className="tooltip tooltip-right w-full" data-tip="Discover">
            <Link
              href="/app"
              prefetch={false}
              className="flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Search className="h-4 w-4 stroke-[1.75]" />
            </Link>
          </div>
        </div>
      )}

      {/* 15-Day Free Trial Clock Indicator */}
      {trialStatus && !trialStatus.isPaid && !trialStatus.isAdmin && (
        <div className={`px-2.5 pb-2 ${isSidebarCollapsed ? "px-1.5" : ""}`}>
          {isSidebarCollapsed ? (
            <div className="tooltip tooltip-right w-full" data-tip={trialStatus.statusText}>
              <Link
                href="/app/billing"
                prefetch={false}
                className={`flex items-center justify-center p-1.5 rounded-lg transition-colors ${
                  trialStatus.isTrialExpired
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <Link
              href="/app/billing"
              prefetch={false}
              className={`block p-2 rounded-lg border transition-all text-xs font-mono group ${
                trialStatus.isTrialExpired
                  ? "bg-rose-950/20 border-rose-500/30 text-rose-300 hover:border-rose-500/60"
                  : "bg-emerald-950/20 border-emerald-500/30 text-emerald-300 hover:border-emerald-500/60"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 font-semibold text-[11px]">
                  <Clock className="h-3 w-3" />
                  {trialStatus.isTrialExpired ? "Trial Ended" : "15-Day Free Trial"}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    trialStatus.isTrialExpired
                      ? "bg-rose-500/20 text-rose-300"
                      : "bg-emerald-500/20 text-emerald-300"
                  }`}
                >
                  {trialStatus.isTrialExpired ? "Expired" : `${trialStatus.daysRemaining}d left`}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground truncate group-hover:text-foreground">
                {trialStatus.isTrialExpired ? "Upgrade to continue →" : "Full access active · Pro plans →"}
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Bottom Pinned User Profile & Theme Toggle */}
      <div className={`border-t border-border bg-muted/40 ${
        isSidebarCollapsed ? "p-2" : "p-3"
      }`}>
        {isSidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <ThemeToggle className="w-8 h-8 mx-auto" />
            <div className="tooltip tooltip-right w-full" data-tip={`${userName} (${userEmail})`}>
              <button
                type="button"
                onClick={() => openProfileModal("ACCOUNT")}
                className="w-full flex items-center justify-center p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                aria-label="Open User Profile"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs font-bold border border-primary/20">
                  {userInitial}
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openProfileModal("ACCOUNT")}
              className="flex-1 min-w-0 flex items-center justify-between p-2 rounded-lg hover:bg-muted text-left transition-colors border border-transparent hover:border-border cursor-pointer group shadow-2xs"
              title={`${userName} (${userEmail})`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs font-bold border border-primary/20">
                  {userInitial}
                </div>
                <div className="truncate">
                  <span className="text-xs font-sans font-medium text-foreground block truncate group-hover:text-primary">
                    {userName}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground block truncate">
                    {userEmail}
                  </span>
                </div>
              </div>
            </button>
            <ThemeToggle className="shrink-0" />
          </div>
        )}
      </div>
    </aside>
  );
}

export function MobileAppHeader() {
  const { unreadNotificationsCount, openCommandPalette } = useUIState();

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-3.5 py-2.5 bg-background/98 backdrop-blur-sm border-b border-border shadow-xs">
      <Link href="/app" prefetch={false} className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-white shadow-marble-1">
          <Compass className="h-4 w-4 stroke-[2]" />
        </div>
        <span className="text-sm font-sans font-bold text-foreground">BrowserPilot</span>
      </Link>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground text-xs font-sans cursor-pointer shadow-marble-1"
          aria-label="Quick Search (⌘K)"
        >
          <Search className="h-3.5 w-3.5 stroke-[1.75]" />
          <span className="text-[11px] hidden sm:inline">Quick search</span>
          <kbd className="kbd kbd-xs font-mono px-1 rounded bg-muted/60 text-muted-foreground border border-border/60">⌘K</kbd>
        </button>

        <Link
          href="/app/notifications"
          prefetch={false}
          className="relative flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-lg bg-card text-foreground hover:bg-muted/80 cursor-pointer border border-border transition-colors shadow-marble-1"
          aria-label="Notifications and Alerts"
        >
          <Bell className="h-4 w-4 stroke-[1.75]" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-mono font-bold text-white ring-1 ring-card">
              {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

