"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Compass,
  UserCheck,
  Mail,
  X,
  Briefcase,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUIState } from "@/components/providers/ui-state-provider";

interface LifecycleAlertItem {
  id: string;
  opportunityId?: string | null;
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

interface RecruiterContactModalData {
  fullName: string;
  roleTitle: string;
  companyName: string;
  email?: string | null;
  profileUrl: string;
  alertId: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<LifecycleAlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<RecruiterContactModalData | null>(null);
  const [isContactDrawerOpen, setIsContactDrawerOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const { 
    unreadNotificationsCount, 
    setUnreadNotificationsCount, 
    markNotificationAsRead, 
    markAllNotificationsAsRead 
  } = useUIState();

  const fetchAlerts = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.notifications || []);
        setUnreadNotificationsCount(data.unreadCount || 0);
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
      await markAllNotificationsAsRead();
      setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
      toast.success("All alerts marked as read");
    } catch {
      toast.error("Failed to mark alerts read");
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
    } catch {
      // Non-fatal
    }
  };

  const parseRecruiterFromAlert = (alert: LifecycleAlertItem): RecruiterContactModalData => {
    let fullName = alert.title.replace(/^New Recruiter:\s*/i, "").replace(/\s+at\s+.*$/i, "").trim();
    if (!fullName) fullName = "Hiring Contact";

    const roleMatch = alert.message.match(/\((.*?)\)/);
    const roleTitle = roleMatch ? roleMatch[1] : "Talent Partner / Recruiter";

    const emailMatch = alert.message.match(/Contact:\s*([^\s]+)/i);
    const email = emailMatch ? emailMatch[1] : null;

    const urlMatch = alert.message.match(/https?:\/\/[^\s]+/i);
    const profileUrl = urlMatch 
      ? urlMatch[0] 
      : `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(fullName + " " + alert.companyName)}`;

    return {
      fullName,
      roleTitle,
      companyName: alert.companyName,
      email,
      profileUrl,
      alertId: alert.id,
    };
  };

  const handleOpenContactDrawer = (alert: LifecycleAlertItem) => {
    const contactData = parseRecruiterFromAlert(alert);
    setSelectedContact(contactData);
    setIsContactDrawerOpen(true);
    if (!alert.isRead) {
      handleMarkRead(alert.id);
    }
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setIsCopied(true);
    toast.success("Email address copied to clipboard");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getTransitionBadge = (type: string) => {
    switch (type) {
      case "NEW_RECRUITER_CONTACT":
        return (
          <Badge variant="default" className="font-sans text-[10px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1">
            <UserCheck className="h-3 w-3" />
            <span>Recruiter Contact</span>
          </Badge>
        );
      case "UNANNOUNCED_ROLE":
        return (
          <Badge variant="secondary" className="font-sans text-[10px] font-medium bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30 gap-1">
            <Sparkles className="h-3 w-3" />
            <span>Unannounced Role</span>
          </Badge>
        );
      case "UPGRADE_RECOMMENDED":
        return (
          <Badge variant="outline" className="font-sans text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1">
            <Zap className="h-3 w-3" />
            <span>Pro Feature Alert</span>
          </Badge>
        );
      case "SYSTEM_NOTICE":
        return (
          <Badge variant="outline" className="font-sans text-[10px] font-medium bg-blue-500/15 text-blue-700 border-blue-500/30 gap-1">
            <Bell className="h-3 w-3" />
            <span>System Notice</span>
          </Badge>
        );
      case "NEW_OPPORTUNITY":
        return <Badge variant="default" className="font-sans text-[10px] font-medium bg-emerald-500/15 text-emerald-700 border-emerald-500/30">New Match</Badge>;
      case "NEW_SOURCE":
        return <Badge variant="secondary" className="font-sans text-[10px] font-medium bg-blue-500/15 text-blue-700 border-blue-500/30">New Source</Badge>;
      case "REPOSTED":
        return <Badge variant="outline" className="font-sans text-[10px] font-medium bg-amber-500/15 text-amber-700 border-amber-500/30">Reposted</Badge>;
      default:
        return <Badge variant="outline" className="font-sans text-[10px] font-medium">{type}</Badge>;
    }
  };

  return (
    <div className="flex-1 flex flex-col antialiased selection:bg-emerald-500/20 selection:text-emerald-600">
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 pb-32 sm:px-6 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell className="h-4 w-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-sans font-bold tracking-tight text-foreground">
                Lifecycle Alerts
              </h1>
              {unreadNotificationsCount > 0 && (
                <Badge variant="outline" className="font-mono text-xs bg-amber-500/15 text-amber-600 border-amber-500/30">
                  {unreadNotificationsCount} Unread
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              <span className="hidden sm:inline">
                Autonomous notifications when new roles match your watch criteria or existing postings refresh.
              </span>
              <span className="sm:hidden">
                Match and refresh alerts.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {unreadNotificationsCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                className="h-8 font-sans font-medium text-xs gap-1.5 border-border/80 cursor-pointer"
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
                onClick={() => {
                  if (!alert.isRead) handleMarkRead(alert.id);
                  if (alert.opportunityId && alert.transitionType !== "NEW_RECRUITER_CONTACT") {
                    router.push(`/app/opportunities/${encodeURIComponent(alert.opportunityId)}`);
                  }
                }}
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
                  {/* Recruiter Contact View Action */}
                  {alert.transitionType === "NEW_RECRUITER_CONTACT" && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenContactDrawer(alert);
                      }}
                      className="h-7 px-2.5 font-mono text-xs gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer shadow-2xs"
                    >
                      <UserCheck className="h-3 w-3" />
                      <span>View Contact</span>
                    </Button>
                  )}

                  {/* Unannounced Role Direct Apply */}
                  {alert.transitionType === "UNANNOUNCED_ROLE" && (
                    (() => {
                      const urlMatch = alert.message.match(/https?:\/\/[^\s]+/i);
                      const applyUrl = alert.opportunity?.primaryApplyUrl || (urlMatch ? urlMatch[0] : null);
                      if (!applyUrl) return null;
                      return (
                        <a
                          href={applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button size="sm" className="h-7 px-2.5 font-mono text-xs gap-1 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-xs">
                            <span>Apply</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Button>
                        </a>
                      );
                    })()
                  )}

                  {alert.transitionType === "UPGRADE_RECOMMENDED" && (
                    <Link href="/app#settings?tab=subscription" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" className="h-7 px-2.5 font-mono text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs">
                        <Zap className="h-3 w-3" />
                        <span>Upgrade</span>
                      </Button>
                    </Link>
                  )}

                  {alert.opportunityId && alert.transitionType !== "NEW_RECRUITER_CONTACT" && (
                    <Link href={`/app/opportunities/${encodeURIComponent(alert.opportunityId)}`} onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" size="sm" className="h-7 px-2.5 font-mono text-xs gap-1 cursor-pointer">
                        <span>View Dossier</span>
                      </Button>
                    </Link>
                  )}

                  {alert.opportunity?.primaryApplyUrl && alert.transitionType !== "UNANNOUNCED_ROLE" && (
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
                <Button size="sm" className="font-sans font-semibold text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs">
                  <Compass className="h-3.5 w-3.5" />
                  Discover Roles
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Recruiter Contact Slide-Over Drawer */}
        {isContactDrawerOpen && selectedContact && (
          <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in-50" 
              onClick={() => setIsContactDrawerOpen(false)}
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-md transform transition ease-in-out duration-300 bg-card border-l border-border shadow-2xl flex flex-col justify-between">
                {/* Drawer Header */}
                <div className="p-6 border-b border-border/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        <UserCheck className="h-4 w-4" />
                      </span>
                      <Badge variant="outline" className="font-mono text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                        DeepReach Verified
                      </Badge>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsContactDrawerOpen(false)}
                      className="h-8 w-8 p-0 rounded-full hover:bg-muted cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold font-sans text-foreground">
                      {selectedContact.fullName}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      <span>{selectedContact.roleTitle}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mt-1">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{selectedContact.companyName}</span>
                    </div>
                  </div>
                </div>

                {/* Drawer Content */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                  {/* Contact Actions Box */}
                  <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3">
                    <div className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                      Direct Contact Channels
                    </div>

                    {/* Profile Link */}
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-card border border-border/60">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-muted-foreground font-mono">Public Profile</div>
                        <div className="text-xs font-medium text-foreground truncate">{selectedContact.profileUrl}</div>
                      </div>
                      <a
                        href={selectedContact.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 cursor-pointer">
                          <span>Open</span>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </div>

                    {/* Direct Email */}
                    {selectedContact.email && (
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-card border border-border/60">
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-muted-foreground font-mono">Direct Email</div>
                          <div className="text-xs font-medium text-foreground truncate">{selectedContact.email}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleCopyEmail(selectedContact.email!)}
                            className="h-7 px-2 text-xs gap-1 cursor-pointer"
                          >
                            {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          </Button>
                          <a href={`mailto:${selectedContact.email}`}>
                            <Button size="sm" className="h-7 px-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                              <Mail className="h-3 w-3" />
                              <span>Email</span>
                            </Button>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Outreach Template Assistant */}
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary font-mono">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Recommended Outreach Starter</span>
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed font-sans bg-card/60 p-3 rounded-lg border border-border/40 select-all">
                      &ldquo;Hi {selectedContact.fullName}, I saw you lead talent recruiting for {selectedContact.companyName}. I have a strong background in distributed systems and modern web architecture and would love to connect regarding engineering openings on your team.&rdquo;
                    </p>
                  </div>
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-border/70 flex items-center justify-between gap-3 bg-muted/20">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsContactDrawerOpen(false)}
                    className="w-full text-xs cursor-pointer"
                  >
                    Close
                  </Button>
                  <a
                    href={selectedContact.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button 
                      size="sm" 
                      className="w-full text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
                    >
                      <span>View Profile</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
