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
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md transition-all shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/app" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center transition-transform group-hover:scale-105 shadow-marble-1">
              <Radio className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <span className="font-sans font-extrabold text-sm tracking-tight text-foreground block leading-tight">
                BrowserPilot
              </span>
              <span className="text-[10px] text-muted-foreground font-mono tracking-wider block">
                Opportunity Intel
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Navigation Route Pills (hidden on mobile, mobile uses bottom dock) */}
        <nav className="hidden lg:flex items-center gap-1.5 p-1.5 rounded-full bg-muted/60 border border-border shadow-xs">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "bg-card text-foreground shadow-marble-1 border border-border font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-primary stroke-[2.25]" : "text-muted-foreground stroke-[1.75]"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Admin Observatory Pill for Admins */}
          {isAdmin && (
            <Link
              href={ADMIN_UI_ROUTES.OVERVIEW}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                pathname?.startsWith("/ops-sec-7f9c2d1b8e4a")
                  ? "bg-primary/10 text-primary border border-primary/30 font-semibold"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/5"
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
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-[11px] font-mono text-muted-foreground shadow-2xs"
              title="Puter AI Cloud Account"
            >
              <Sparkles className="h-3 w-3 text-primary" />
              <span>{puterUser.username || "Puter"}</span>
            </div>
          )}

          {/* Global Theme Toggle */}
          <ThemeToggle />

          {/* User Profile Avatar / Trigger */}
          <button
            type="button"
            onClick={() => openProfileModal()}
            className="flex items-center gap-2 p-1 pl-2 sm:pr-3 rounded-full border border-border bg-card hover:bg-muted/60 transition-colors cursor-pointer text-xs font-sans shadow-marble-1"
            title="User Settings & Profile"
          >
            <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
              {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : <User className="h-3 w-3" />}
            </div>
            <span className="hidden sm:inline font-medium text-foreground truncate max-w-[110px]">
              {session?.user?.name?.split(" ")[0] || "Account"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
