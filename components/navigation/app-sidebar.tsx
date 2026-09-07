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
  PanelLeftOpen
} from "lucide-react";
import { useUIState } from "@/components/providers/ui-state-provider";

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

  const navItems = [
    {
      href: "/app",
      label: "Discover",
      icon: Compass,
      isActive: pathname === "/app" || pathname === "/app/discover",
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
      href: "/app/notifications",
      label: "Notifications",
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
      badgeColor: "bg-rose-500",
      isActive: pathname === "/app/notifications",
    },
  ];

  const userName = session?.user?.name || "Engineering Lead";
  const userEmail = session?.user?.email || "lead@browserpilot.internal";

  return (
    <aside 
      aria-label="Application Sidebar"
      className={`hidden md:flex flex-col fixed left-0 top-0 bottom-0 bg-[#FBFBFA] border-r border-[#E6E6E3] z-30 select-none transition-[width] duration-200 ease-in-out ${
        isSidebarCollapsed ? "w-[68px]" : "w-[216px]"
      }`}
    >
      {/* Brand Header & Collapse Toggle */}
      <div className={`py-3.5 border-b border-[#EBEBE8] flex items-center justify-between ${
        isSidebarCollapsed ? "px-2.5 flex-col gap-2" : "px-3.5"
      }`}>
        <Link 
          href="/app" 
          className="flex items-center gap-2.5 group overflow-hidden"
          title="BrowserPilot Discovery Engine"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1F3D2E] text-white shadow-xs group-hover:bg-[#162d22] transition-colors">
            <Compass className="h-4 w-4 stroke-[1.75]" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col min-w-0 transition-opacity duration-200">
              <span className="text-sm font-serif font-bold text-foreground tracking-tight leading-tight truncate">
                BrowserPilot
              </span>
              <span className="text-[10px] text-muted-foreground font-sans truncate">
                Discovery Engine
              </span>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={toggleSidebarCollapse}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
          title={isSidebarCollapsed ? "Expand sidebar (w-216px)" : "Collapse sidebar (w-68px)"}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4 stroke-[1.75]" />
          ) : (
            <PanelLeftClose className="h-4 w-4 stroke-[1.75]" />
          )}
        </button>
      </div>

      {/* Command Palette Trigger in Sidebar */}
      <div className={`pt-3 pb-2 ${isSidebarCollapsed ? "px-2" : "px-3"}`}>
        <button
          type="button"
          onClick={openCommandPalette}
          className={`flex items-center rounded-lg border border-border/70 bg-white/90 hover:bg-white text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs group ${
            isSidebarCollapsed 
              ? "w-full justify-center p-2" 
              : "w-full justify-between px-2.5 py-1.5 text-xs font-sans"
          }`}
          title="Search or jump (⌘K)"
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4 stroke-[1.75] text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            {!isSidebarCollapsed && (
              <span className="text-[11px] font-sans">Search or jump...</span>
            )}
          </span>
          {!isSidebarCollapsed && (
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground border border-border/40">
              ⌘K
            </kbd>
          )}
        </button>
      </div>

      {/* Navigation Links with High-Contrast Active State & Left Accent Bar */}
      <nav className={`flex-1 py-2 space-y-1 overflow-y-auto ${isSidebarCollapsed ? "px-2" : "px-3"}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isSidebarCollapsed ? item.label : undefined}
              className={`relative flex items-center rounded-lg transition-colors ${
                isSidebarCollapsed 
                  ? "justify-center py-2.5 px-0" 
                  : "justify-between px-2.5 py-2 text-xs font-sans"
              } ${
                active
                  ? "bg-[#1F3D2E]/10 text-[#1F3D2E] font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-[#1F3D2E] before:rounded-r-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50 font-medium"
              }`}
            >
              <div className={`flex items-center ${isSidebarCollapsed ? "justify-center" : "gap-2.5 truncate"}`}>
                <Icon className={`h-4 w-4 shrink-0 transition-colors ${
                  active ? "text-[#1F3D2E] stroke-[2.25]" : "text-muted-foreground stroke-[1.75]"
                }`} />
                {!isSidebarCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </div>

              {item.badge !== undefined && (
                isSidebarCollapsed ? (
                  <span 
                    className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${
                      item.badgeColor || "bg-[#1F3D2E]"
                    }`}
                  />
                ) : (
                  <span 
                    className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-mono font-bold text-white shrink-0 ${
                      item.badgeColor || "bg-[#1F3D2E]"
                    }`}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )
              )}
            </Link>
          );
        })}
      </nav>

      {/* Account / Profile Trigger Pinned at Bottom */}
      <div className={`border-t border-[#EBEBE8] bg-[#F9F9F7] ${isSidebarCollapsed ? "p-2" : "p-3"}`}>
        <button
          type="button"
          onClick={() => openProfileModal("ACCOUNT")}
          className={`w-full flex items-center rounded-lg hover:bg-white text-left transition-colors border border-transparent hover:border-border/60 cursor-pointer group shadow-2xs ${
            isSidebarCollapsed ? "justify-center p-1.5" : "justify-between p-2"
          }`}
          title={`${userName} (${userEmail})`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1F3D2E]/10 text-[#1F3D2E] font-mono text-xs font-bold border border-[#1F3D2E]/20">
              {userName.charAt(0).toUpperCase()}
            </div>
            {!isSidebarCollapsed && (
              <div className="truncate">
                <span className="text-xs font-sans font-medium text-foreground block truncate group-hover:text-[#1F3D2E]">
                  {userName}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground block truncate">
                  {userEmail}
                </span>
              </div>
            )}
          </div>
        </button>
      </div>
    </aside>
  );
}

export function MobileAppHeader() {
  const { data: session } = useSession();
  const { openCommandPalette, openProfileModal } = useUIState();
  const userName = session?.user?.name || session?.user?.email || "User";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 bg-[#F6F6F4]/90 backdrop-blur-md border-b border-[#E6E6E3]">
      <Link href="/app" className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#1F3D2E] text-white">
          <Compass className="h-3.5 w-3.5 stroke-[1.75]" />
        </div>
        <span className="text-sm font-serif font-bold text-foreground">BrowserPilot</span>
      </Link>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/70 bg-white text-muted-foreground hover:text-foreground text-xs font-sans cursor-pointer shadow-2xs"
        >
          <Search className="h-3.5 w-3.5 stroke-[1.75]" />
          <span className="text-[11px]">Search</span>
          <kbd className="text-[9px] font-mono px-1 rounded bg-muted/60">⌘K</kbd>
        </button>

        <button
          type="button"
          onClick={() => openProfileModal("ACCOUNT")}
          className="flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-full bg-[#1F3D2E]/10 text-[#1F3D2E] hover:bg-[#1F3D2E]/20 font-mono text-xs font-bold cursor-pointer border border-[#1F3D2E]/30 transition-colors shadow-2xs"
          aria-label="Open Account and Settings"
          title="Open Account and Settings"
        >
          {userInitial || <User className="h-4 w-4 stroke-[1.75]" />}
        </button>
      </div>
    </header>
  );
}
