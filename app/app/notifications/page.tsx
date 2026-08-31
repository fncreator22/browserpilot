"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Bell, 
  CheckCheck, 
  ExternalLink, 
  ArrowUpRight, 
  Building2, 
  Clock, 
  Sparkles,
  Zap,
  RotateCw,
  Compass
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface LifecycleAlertItem {
  id: string;
  opportunityId: string;
  transitionType: string;
  previousStatus?: string;
  newStatus?: string;
  title: string;
  companyName: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  opportunity?: {
    id: string;
    title: string;
    companyName: string;
    location?: string;
    workMode?: string;
    primaryApplyUrl?: string;
  };
}

export default function NotificationsPage() {
  const [alerts, setAlerts] = useState<LifecycleAlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Non-fatal
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (res.ok) {
        setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
        setUnreadCount(0);
        toast.success("All alerts marked as read");
      }
    } catch {
      toast.error("Failed to mark alerts read");
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Non-fatal
    }
  };

  const getTransitionBadge = (type: string) => {
    switch (type) {
      case "NEW_OPPORTUNITY":
        return <Badge variant="default" className="font-mono text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30">NEW MATCH</Badge>;
      case "NEW_SOURCE":
        return <Badge variant="secondary" className="font-mono text-[10px] bg-blue-500/15 text-blue-600 border-blue-500/30">NEW SOURCE</Badge>;
      case "REPOSTED":
        return <Badge variant="outline" className="font-mono text-[10px] bg-amber-500/15 text-amber-600 border-amber-500/30">REPOSTED</Badge>;
      default:
        return <Badge variant="outline" className="font-mono text-[10px]">{type}</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Workspace Navigation Bar */}
        <WorkspaceNav unreadAlertsCount={unreadCount} showNewSearchButton />

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell className="h-4 w-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Lifecycle Alerts
              </h1>
              {unreadCount > 0 && (
                <Badge variant="outline" className="font-mono text-xs bg-amber-500/15 text-amber-600 border-amber-500/30">
                  {unreadCount} Unread
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Autonomous notifications when new roles match your watch criteria or existing postings refresh.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                className="h-8 font-mono text-xs gap-1.5 border-border/80 cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark All Read
              </Button>
            )}
          </div>
        </div>

        {/* Alerts Feed */}
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs font-mono text-muted-foreground">Loading lifecycle alerts...</p>
          </div>
        ) : alerts.length > 0 ? (
          <div className="max-w-4xl mx-auto space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                onClick={() => !alert.isRead && handleMarkRead(alert.id)}
                className={`rounded-xl border p-4 sm:p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer shadow-xs ${
                  alert.isRead
                    ? "border-border/60 bg-card/60 opacity-80"
                    : "border-primary/40 bg-card ring-1 ring-primary/20"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getTransitionBadge(alert.transitionType)}
                    <h3 className="text-sm font-bold text-foreground">
                      {alert.title}
                    </h3>
                    <span className="text-xs font-semibold text-primary font-mono">
                      @ {alert.companyName}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground font-mono">
                    {alert.message}
                  </p>

                  <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <Link href={`/app/opportunities/${alert.opportunityId}`}>
                    <Button variant="outline" size="sm" className="h-7 px-2.5 font-mono text-xs gap-1 cursor-pointer">
                      <span>View Dossier</span>
                    </Button>
                  </Link>

                  {alert.opportunity?.primaryApplyUrl && (
                    <a
                      href={alert.opportunity.primaryApplyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button size="sm" className="h-7 px-2.5 font-mono text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs">
                        <span>Apply</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="py-20 text-center space-y-4 max-w-md mx-auto rounded-2xl border border-dashed border-border/70 p-8 bg-card/40">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bell className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-foreground">No Alerts Right Now</h2>
              <p className="text-xs text-muted-foreground">
                Your autonomous watch is actively scanning. When fresh matching jobs or updated listings appear, alerts will be recorded here.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Link href="/app/watch">
                <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 cursor-pointer">
                  Configure Watch
                </Button>
              </Link>
              <Link href="/app">
                <Button size="sm" className="font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs">
                  <Compass className="h-3.5 w-3.5" />
                  Discover Roles
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
