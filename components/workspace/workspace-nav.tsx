"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, 
  Layers,
  Eye, 
  Bookmark, 
  History, 
  Bell, 
  Sparkles,
  Plus,
  Brain
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface WorkspaceNavProps {
  unreadAlertsCount?: number;
  savedCount?: number;
  showNewSearchButton?: boolean;
}

export function WorkspaceNav({
  unreadAlertsCount = 0,
  savedCount,
  showNewSearchButton = false,
}: WorkspaceNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/app",
      label: "Discover",
      icon: Compass,
      description: "Search & explore opportunities",
      isActive: pathname === "/app" || pathname === "/app/discover",
    },
    {
      href: "/app/swarm",
      label: "Swarm",
      icon: Layers,
      description: "Multi-source parallel discovery",
      isActive: pathname === "/app/swarm",
    },
    {
      href: "/app/watch",
      label: "Watch",
      icon: Eye,
      description: "Continuous autonomous monitoring",
      isActive: pathname === "/app/watch",
    },
    {
      href: "/app/saved",
      label: "Saved",
      icon: Bookmark,
      description: "Bookmarked opportunities",
      badge: typeof savedCount === "number" && savedCount > 0 ? savedCount : undefined,
      isActive: pathname === "/app/saved",
    },
    {
      href: "/app/history",
      label: "History",
      icon: History,
      description: "Past searches & sessions",
      isActive: pathname === "/app/history",
    },
    {
      href: "/app/notifications",
      label: "Alerts",
      icon: Bell,
      description: "Opportunity lifecycle alerts",
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
      badgeVariant: "amber" as const,
      isActive: pathname === "/app/notifications",
    },
    {
      href: "/app/settings/memory",
      label: "Memory",
      icon: Brain,
      description: "Durable career preferences",
      isActive: pathname === "/app/settings/memory",
    },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
      {/* Primary Navigation Tabs */}
      <nav 
        aria-label="Workspace Navigation" 
        className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className={`h-9 px-3 font-mono text-xs gap-2 transition-all cursor-pointer ${
                  active
                    ? "bg-primary/10 text-primary font-semibold border border-primary/20 shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <Badge 
                    variant={item.badgeVariant === "amber" ? "outline" : "secondary"}
                    className={`ml-0.5 px-1.5 py-0 text-[10px] font-mono leading-none ${
                      item.badgeVariant === "amber" 
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/30" 
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.badge}
                  </Badge>
                )}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Action / New Search Shortcut */}
      {showNewSearchButton && (
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Link href="/app">
            <Button
              size="sm"
              className="h-8 px-3 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Discovery</span>
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
