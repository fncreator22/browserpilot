"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { 
  Compass, 
  Radio, 
  Bookmark, 
  History, 
  Blocks, 
  ShieldAlert, 
  User, 
  Sparkles 
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useUIState } from "@/components/providers/ui-state-provider";
import { usePuter } from "@/hooks/usePuter";
import { ADMIN_UI_ROUTES } from "@/lib/admin/adminRoutes";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Discover", href: "/app", icon: Compass },
  { label: "Autonomous Radar", href: "/app/watch", icon: Radio },
  { label: "Saved", href: "/app/saved", icon: Bookmark },
  { label: "History", href: "/app/history", icon: History },
  { label: "Plugins", href: "/app/plugins", icon: Blocks },
];

export function TopNavIsland() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { openProfileModal } = useUIState();
  const { isSignedIn, user: puterUser } = usePuter();

  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === "ADMIN" || userRole === "SUPERADMIN";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/app" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-foreground text-background flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs">
              <Radio className="h-4 w-4 text-background" />
            </div>
            <div>
              <span className="font-sans font-extrabold text-sm tracking-tight text-foreground block leading-tight">
                Radar
              </span>
              <span className="text-[9px] text-muted-foreground font-mono tracking-wider block">
                Opportunity Intel
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Navigation Route Pills (hidden on mobile, mobile uses bottom dock) */}
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-muted/40 border border-border/60">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "bg-background text-foreground shadow-xs border border-border/80 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-emerald-500" : "text-muted-foreground"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Admin Observatory Pill for Admins */}
          {isAdmin && (
            <Link
              href={ADMIN_UI_ROUTES.OVERVIEW}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                pathname?.startsWith("/ops-sec-7f9c2d1b8e4a")
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 font-semibold"
                  : "text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Observatory</span>
            </Link>
          )}
        </nav>

        {/* Right: Actions, Theme Switcher & User Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Puter Account Status Indicator */}
          {isSignedIn && puterUser && (
            <div 
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/60 text-[11px] font-mono text-muted-foreground"
              title="Puter AI Cloud Account"
            >
              <Sparkles className="h-3 w-3 text-emerald-500" />
              <span>{puterUser.username || "Puter"}</span>
            </div>
          )}

          {/* Global Theme Toggle */}
          <ThemeToggle />

          {/* User Profile Avatar / Trigger */}
          <button
            type="button"
            onClick={() => openProfileModal()}
            className="flex items-center gap-2 p-1 pl-1.5 sm:pr-2.5 rounded-full border border-border/70 bg-card hover:bg-muted/60 transition-colors cursor-pointer text-xs font-sans"
            title="User Settings & Profile"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : <User className="h-3 w-3" />}
            </div>
            <span className="hidden sm:inline font-medium text-foreground truncate max-w-[100px]">
              {session?.user?.name?.split(" ")[0] || "Account"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
