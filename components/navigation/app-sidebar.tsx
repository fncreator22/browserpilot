"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { 
  Compass, 
  Bookmark, 
  Eye, 
  History, 
  Bell, 
  Search, 
  User, 
  PanelLeftClose,
  PanelLeftOpen,
  Brain,
  ShieldCheck,
  Puzzle
} from "lucide-react";
import { useUIState } from "@/components/providers/ui-state-provider";
import { ADMIN_UI_ROUTES } from "@/lib/admin/adminRoutes";

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { 
    unreadNotificationsCount, 
    savedCount, 
    openCommandPalette, 
    openProfileModal,
    isSidebarCollapsed,
    toggleSidebarCollapse
  } = useUIState();

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
      href: "/app/watch",
      label: "Autonomous Watch",
      icon: Eye,
      isActive: pathname === "/app/watch",
    },
    {
      href: "/app/saved",
      label: "Saved Opportunities",
      icon: Bookmark,
      badge: savedCount > 0 ? savedCount : undefined,
      isActive: pathname === "/app/saved",
    },
    {
      href: "/app/history",
      label: "Search History",
      icon: History,
      isActive: pathname === "/app/history",
    },
    {
      href: "/app/settings/memory",
      label: "Memory Vault",
      icon: Brain,
      isActive: pathname === "/app/settings/memory",
    },
    {
      href: "/app/plugins",
      label: "Plugins Marketplace",
      icon: Puzzle,
      isActive: pathname === "/app/plugins",
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
      badgeColor: "bg-purple-600",
      isActive: pathname?.startsWith("/ops-sec-"),
    }] : []),
  ];

  const userName = session?.user?.name || "Engineering Lead";
  const userEmail = session?.user?.email || "lead@browserpilot.internal";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <aside 
      aria-label="Application Sidebar"
      className={`hidden lg:flex flex-col h-screen fixed top-0 left-0 bg-white dark:bg-slate-900 border-r border-[#E5E5E0] dark:border-slate-800 z-30 select-none overflow-hidden transition-[width] duration-200 ease-in-out ${
        isSidebarCollapsed ? "w-[68px]" : "w-[216px]"
      }`}
    >
      {/* Brand Header & Collapse Toggle */}
      <div className={`py-3.5 border-b border-[#EBEBE8] dark:border-slate-800 flex items-center justify-between ${
        isSidebarCollapsed ? "px-2 flex-col gap-2" : "px-3.5"
      }`}>
        <Link 
          href="/app" 
          prefetch={false}
          className="flex items-center gap-2.5 group overflow-hidden"
          title="BrowserPilot Discovery Engine"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs group-hover:bg-emerald-700 transition-colors">
            <Compass className="h-4 w-4 stroke-[1.75]" />
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
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
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
              className="w-full flex items-center justify-center p-2 rounded-lg border border-border/70 bg-white/90 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs group"
              aria-label="Quick search (⌘K)"
            >
              <Search className="h-4 w-4 stroke-[1.75] text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openCommandPalette}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-border/70 bg-white/90 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs group"
            title="Search or jump (⌘K)"
          >
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 stroke-[1.75] text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              <span className="text-[11px] font-sans">Quick search...</span>
            </span>
            <kbd className="kbd kbd-xs font-mono px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground border border-border/40">
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
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold dark:bg-white/10 dark:text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                  }`}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={`h-4 w-4 shrink-0 transition-colors ${
                    active ? "text-emerald-600 dark:text-emerald-400 dark:text-white stroke-[2.25]" : "text-muted-foreground stroke-[1.75]"
                  }`} />
                  {item.badge !== undefined && (
                    <span 
                      className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${
                        item.badgeColor || "bg-emerald-600 dark:bg-white"
                      }`}
                    />
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
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold dark:bg-white/10 dark:text-white before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-emerald-600 dark:before:bg-white before:rounded-r-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`h-4 w-4 shrink-0 transition-colors ${
                  active ? "text-emerald-600 dark:text-emerald-400 dark:text-white stroke-[2.25]" : "text-muted-foreground stroke-[1.75]"
                }`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span 
                  className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-mono font-bold text-white shrink-0 ${
                    item.badgeColor || "bg-emerald-600 dark:bg-slate-700"
                  }`}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Pinned User Profile */}
      <div className={`border-t border-[#EBEBE8] dark:border-slate-800 bg-[#F9F9F7] dark:bg-slate-900/80 ${
        isSidebarCollapsed ? "p-2" : "p-3"
      }`}>
        {isSidebarCollapsed ? (
          <div className="tooltip tooltip-right w-full" data-tip={`${userName} (${userEmail})`}>
            <button
              type="button"
              onClick={() => openProfileModal("ACCOUNT")}
              className="w-full flex items-center justify-center p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Open User Profile"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 dark:bg-white/10 text-emerald-600 dark:text-emerald-400 dark:text-white font-mono text-xs font-bold border border-emerald-500/20 dark:border-white/20">
                {userInitial}
              </div>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openProfileModal("ACCOUNT")}
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-left transition-colors border border-transparent hover:border-border/60 cursor-pointer group shadow-2xs"
            title={`${userName} (${userEmail})`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 dark:bg-white/10 text-emerald-600 dark:text-emerald-400 dark:text-white font-mono text-xs font-bold border border-emerald-500/20 dark:border-white/20">
                {userInitial}
              </div>
              <div className="truncate">
                <span className="text-xs font-sans font-medium text-foreground block truncate group-hover:text-emerald-600 dark:group-hover:text-white">
                  {userName}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground block truncate">
                  {userEmail}
                </span>
              </div>
            </div>
          </button>
        )}
      </div>
    </aside>
  );
}

export function MobileAppHeader() {
  const { unreadNotificationsCount, openCommandPalette } = useUIState();

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-3.5 py-2.5 bg-[#F6F6F4]/95 dark:bg-[#0A0F1D]/95 backdrop-blur-md border-b border-[#E6E6E3] dark:border-slate-800">
      <Link href="/app" prefetch={false} className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
          <Compass className="h-4 w-4 stroke-[1.75]" />
        </div>
        <span className="text-sm font-sans font-bold text-foreground">BrowserPilot</span>
      </Link>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/70 bg-white dark:bg-slate-800 text-muted-foreground hover:text-foreground text-xs font-sans cursor-pointer shadow-2xs"
          aria-label="Quick Search (⌘K)"
        >
          <Search className="h-3.5 w-3.5 stroke-[1.75]" />
          <span className="text-[11px] hidden sm:inline">Quick search</span>
          <kbd className="kbd kbd-xs font-mono px-1 rounded bg-muted/60">⌘K</kbd>
        </button>

        <Link
          href="/app/notifications"
          prefetch={false}
          className="relative flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-full bg-white dark:bg-slate-800 text-foreground hover:bg-muted/80 cursor-pointer border border-border/70 transition-colors shadow-2xs"
          aria-label="Notifications & Alerts"
        >
          <Bell className="h-4 w-4 stroke-[1.75]" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-mono font-bold text-white ring-1 ring-white dark:ring-slate-900">
              {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

