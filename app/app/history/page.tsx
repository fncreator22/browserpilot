"use client";

import { useState, useEffect, useTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";
import { 
  History, 
  Search, 
  Clock, 
  ArrowUpRight, 
  ExternalLink, 
  Bookmark, 
  BookmarkCheck, 
  Filter, 
  Sparkles, 
  Database, 
  ArrowLeft, 
  Calendar, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Briefcase, 
  MapPin, 
  RotateCw, 
  Trash2, 
  Eye, 
  ChevronRight, 
  X, 
  Bell, 
  AlertTriangle, 
  CheckCheck,
  Radio,
  Sliders,
  ShieldCheck,
  Zap,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { JobDossierDeck, type DossierJobItem } from "@/components/result/job-dossier-deck";
import { toast } from "sonner";

interface SearchHistoryItem {
  id: string;
  rawQuery: string;
  intentType: string;
  parsedRole?: string | null;
  parsedSkills?: string[] | null;
  parsedLocation?: string | null;
  parsedWorkMode?: string | null;
  targetGradYear?: number | null;
  totalFound: number;
  status: string;
  createdAt: string;
}

interface SavedOpportunityRecord {
  savedId: string;
  savedAt: string;
  notes?: string | null;
  opportunity: DossierJobItem;
}

interface LifecycleAlertItem {
  id: string;
  opportunityId: string;
  transitionType: string;
  previousStatus: string;
  newStatus: string;
  title: string;
  companyName: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  opportunity?: DossierJobItem;
}

interface DiscoveryWatchState {
  enabled: boolean;
  roles: string[];
  skills: string[];
  locations: string[];
  companies: string[];
  workModes: string[];
  experienceLevels: string[];
  opportunityTypes: string[];
  preferredSources: string[];
  minimumMatchScore: number;
  latestOnly: boolean;
  freshnessWindowHours: number;
  scanIntervalHours: number;
  lastScannedAt?: string | null;
  nextScanAt?: string | null;
}

interface DiscoveryEventItem {
  id: string;
  runId: string;
  classification: string;
  matchScore: number;
  freshnessClass: string;
  notificationCreated: boolean;
  discoveredAt: string;
  opportunity: DossierJobItem;
}

interface HistoricalSessionDetail {
  id: string;
  rawQuery: string;
  intentType: string;
  status: string;
  createdAt: string;
  totalFound: number;
  results: DossierJobItem[];
}

function HistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as any) || "SAVED";

  const [activeTab, setActiveTab] = useState<"SAVED" | "ALERTS" | "WATCH" | "SEARCHES">(
    ["SAVED", "ALERTS", "WATCH", "SEARCHES"].includes(initialTab) ? initialTab : "SAVED"
  );

  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<SavedOpportunityRecord[]>([]);
  const [lifecycleAlerts, setLifecycleAlerts] = useState<LifecycleAlertItem[]>([]);
  const [discoveryEvents, setDiscoveryEvents] = useState<DiscoveryEventItem[]>([]);
  const [recentDiscoveryRuns, setRecentDiscoveryRuns] = useState<any[]>([]);
  const [watchConfig, setWatchConfig] = useState<DiscoveryWatchState>({
    enabled: true,
    roles: ["Software Engineer", "Frontend Developer"],
    skills: ["React", "TypeScript"],
    locations: ["Remote", "India"],
    companies: [],
    workModes: ["REMOTE", "HYBRID"],
    experienceLevels: ["INTERN", "ENTRY_LEVEL"],
    opportunityTypes: ["INTERNSHIP", "FULL_TIME"],
    preferredSources: ["LinkedIn", "Y Combinator", "Indeed"],
    minimumMatchScore: 70,
    latestOnly: false,
    freshnessWindowHours: 48,
    scanIntervalHours: 6,
  });

  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [noveltyFilter, setNoveltyFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSavingWatch, setIsSavingWatch] = useState(false);

  // Historical Session Inspection Modal State
  const [viewingSession, setViewingSession] = useState<HistoricalSessionDetail | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSearchHistory = async () => {
    try {
      const res = await fetch("/api/search/history");
      if (res.ok) {
        const data = await res.json();
        if (data.history) setSearchHistory(data.history);
      }
    } catch {}
  };

  const fetchSavedOpportunities = async () => {
    try {
      const res = await fetch("/api/opportunities/saved");
      if (res.ok) {
        const data = await res.json();
        if (data.savedOpportunities) setSavedOpportunities(data.savedOpportunities);
      }
    } catch {}
  };

  const fetchLifecycleAlerts = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        if (data.notifications) setLifecycleAlerts(data.notifications);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  };

  const fetchWatchConfigAndEvents = async () => {
    try {
      const [watchRes, eventsRes] = await Promise.all([
        fetch("/api/discovery/watch"),
        fetch("/api/discovery/events"),
      ]);

      if (watchRes.ok) {
        const data = await watchRes.json();
        if (data.watch) setWatchConfig(data.watch);
        if (data.recentRuns) setRecentDiscoveryRuns(data.recentRuns);
      }

      if (eventsRes.ok) {
        const data = await eventsRes.json();
        if (data.events) setDiscoveryEvents(data.events);
      }
    } catch {}
  };

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      fetchSearchHistory(),
      fetchSavedOpportunities(),
      fetchLifecycleAlerts(),
      fetchWatchConfigAndEvents(),
    ]).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const handleRunMonitor = async () => {
    try {
      setIsMonitoring(true);
      const res = await fetch("/api/opportunities/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false, maxCandidates: 10 }),
      });

      if (!res.ok) {
        if (res.status === 401) toast.error("Please sign in to monitor saved opportunities.");
        else toast.error("Freshness check encountered an issue.");
        return;
      }

      const data = await res.json();
      toast.success(
        `Freshness check completed: ${data.revalidatedCount} checked, ${data.alertsCreated} alerts generated.`
      );
      await Promise.all([fetchSavedOpportunities(), fetchLifecycleAlerts()]);
    } catch {
      toast.error("Failed to execute freshness check.");
    } finally {
      setIsMonitoring(false);
    }
  };

  const handleRunAutonomousDiscovery = async () => {
    try {
      setIsDiscovering(true);
      const res = await fetch("/api/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        toast.error("Failed to run autonomous discovery.");
        return;
      }

      const data = await res.json();
      if (data.status === "SKIPPED_LOCKED") {
        toast.info("A discovery scan is already active.");
      } else {
        toast.success(
          `Discovery completed: ${data.telemetry?.newOpportunities || 0} new opportunities, ${data.telemetry?.newSources || 0} new sources found.`
        );
        await Promise.all([fetchWatchConfigAndEvents(), fetchLifecycleAlerts()]);
      }
    } catch {
      toast.error("Autonomous discovery encountered an issue.");
    } finally {
      setIsDiscovering(false);
    }
  };

  // Input states for watch chip tags
  const [newRoleInput, setNewRoleInput] = useState("");
  const [newSkillInput, setNewSkillInput] = useState("");
  const [newLocationInput, setNewLocationInput] = useState("");
  const [newCompanyInput, setNewCompanyInput] = useState("");

  const addRole = (role: string) => {
    const trimmed = role.trim();
    if (trimmed && !watchConfig.roles.includes(trimmed)) {
      setWatchConfig({ ...watchConfig, roles: [...watchConfig.roles, trimmed] });
      setNewRoleInput("");
    }
  };

  const removeRole = (role: string) => {
    setWatchConfig({ ...watchConfig, roles: watchConfig.roles.filter((r) => r !== role) });
  };

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !watchConfig.skills.includes(trimmed)) {
      setWatchConfig({ ...watchConfig, skills: [...watchConfig.skills, trimmed] });
      setNewSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setWatchConfig({ ...watchConfig, skills: watchConfig.skills.filter((s) => s !== skill) });
  };

  const addLocation = (loc: string) => {
    const trimmed = loc.trim();
    if (trimmed && !watchConfig.locations.includes(trimmed)) {
      setWatchConfig({ ...watchConfig, locations: [...watchConfig.locations, trimmed] });
      setNewLocationInput("");
    }
  };

  const removeLocation = (loc: string) => {
    setWatchConfig({ ...watchConfig, locations: watchConfig.locations.filter((l) => l !== loc) });
  };

  const addCompany = (comp: string) => {
    const trimmed = comp.trim();
    if (trimmed && !watchConfig.companies.includes(trimmed)) {
      setWatchConfig({ ...watchConfig, companies: [...watchConfig.companies, trimmed] });
      setNewCompanyInput("");
    }
  };

  const removeCompany = (comp: string) => {
    setWatchConfig({ ...watchConfig, companies: watchConfig.companies.filter((c) => c !== comp) });
  };

  const toggleWorkMode = (mode: string) => {
    const exists = watchConfig.workModes.includes(mode);
    const updated = exists ? watchConfig.workModes.filter((m) => m !== mode) : [...watchConfig.workModes, mode];
    setWatchConfig({ ...watchConfig, workModes: updated.length > 0 ? updated : ["ANY"] });
  };

  const toggleOpportunityType = (type: string) => {
    const exists = watchConfig.opportunityTypes.includes(type);
    const updated = exists ? watchConfig.opportunityTypes.filter((t) => t !== type) : [...watchConfig.opportunityTypes, type];
    setWatchConfig({ ...watchConfig, opportunityTypes: updated.length > 0 ? updated : ["FULL_TIME"] });
  };

  const toggleSource = (src: string) => {
    const exists = watchConfig.preferredSources.includes(src);
    const updated = exists ? watchConfig.preferredSources.filter((s) => s !== src) : [...watchConfig.preferredSources, src];
    setWatchConfig({ ...watchConfig, preferredSources: updated.length > 0 ? updated : ["LinkedIn"] });
  };

  const handleSaveWatchConfig = async () => {
    try {
      setIsSavingWatch(true);
      const res = await fetch("/api/discovery/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(watchConfig),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.watch) {
          setWatchConfig(data.watch);
        }
        toast.success("Autonomous Discovery Watch preferences saved.");
        await fetchWatchConfigAndEvents();
      } else {
        toast.error("Failed to save watch preferences.");
      }
    } catch {
      toast.error("Failed to update watch settings.");
    } finally {
      setIsSavingWatch(false);
    }
  };

  const handleMarkAlertRead = async (alertId: string) => {
    try {
      const res = await fetch(`/api/notifications/${alertId}/read`, { method: "POST" });
      if (res.ok) {
        setLifecycleAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {}
  };

  const handleMarkAllAlertsRead = async () => {
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (res.ok) {
        setLifecycleAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
        setUnreadCount(0);
        toast.success("All lifecycle alerts marked as read.");
      }
    } catch {}
  };

  const handleOpenHistoricalSession = async (searchId: string) => {
    try {
      setIsLoadingSession(true);
      const res = await fetch(`/api/search/history/${searchId}`);
      if (res.ok) {
        const data = await res.json();
        setViewingSession(data.session);
      } else {
        toast.error("Failed to load historical session details.");
      }
    } catch {
      toast.error("Error retrieving historical search session.");
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handleDeleteHistorySession = async (searchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDeletingId(searchId);
      const res = await fetch(`/api/search/history/${searchId}`, { method: "DELETE" });
      if (res.ok) {
        setSearchHistory((prev) => prev.filter((item) => item.id !== searchId));
        toast.success("Search history session removed.");
        if (viewingSession?.id === searchId) setViewingSession(null);
      } else {
        toast.error("Failed to delete search session.");
      }
    } catch {
      toast.error("Failed to delete search session.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredHistory = searchHistory.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.rawQuery.toLowerCase().includes(q) ||
      item.parsedRole?.toLowerCase().includes(q) ||
      item.parsedLocation?.toLowerCase().includes(q)
    );
  });

  const filteredSaved = savedOpportunities.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const opp = item.opportunity;
    return (
      opp.title.toLowerCase().includes(q) ||
      opp.companyName?.toLowerCase().includes(q) ||
      opp.location?.toLowerCase().includes(q)
    );
  });

  const filteredAlerts = lifecycleAlerts.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.companyName.toLowerCase().includes(q) ||
      item.message.toLowerCase().includes(q)
    );
  });

  const filteredDiscoveryEvents = discoveryEvents.filter((item) => {
    if (noveltyFilter !== "ALL" && item.classification !== noveltyFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const opp = item.opportunity;
    return (
      opp.title.toLowerCase().includes(q) ||
      opp.companyName?.toLowerCase().includes(q) ||
      opp.location?.toLowerCase().includes(q)
    );
  });

  const handleBookmarkRemoved = (opportunityId: string) => {
    setSavedOpportunities((prev) => prev.filter((s) => s.opportunity.id !== opportunityId));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-8">
        {/* Header Navigation & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link href="/app">
                <Button variant="ghost" size="sm" className="h-8 px-2 font-mono text-xs gap-1 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Workspace
                </Button>
              </Link>
              <span className="text-muted-foreground/60">/</span>
              <span className="text-xs font-mono font-medium text-foreground">Saved & History</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Database className="h-6 w-6 text-primary" />
              Saved Opportunities & Autonomous Watch
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure continuous opportunity watches, review novel discoveries, track lifecycle alerts, and inspect past searches.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "WATCH" && (
              <Button
                variant="default"
                size="sm"
                onClick={handleRunAutonomousDiscovery}
                disabled={isDiscovering}
                className="font-mono text-xs gap-1.5 shadow-xs"
              >
                <Zap className={`h-3.5 w-3.5 ${isDiscovering ? "animate-spin text-primary-foreground" : ""}`} />
                <span>{isDiscovering ? "Scanning Swarm..." : "Run Discovery Now"}</span>
              </Button>
            )}

            {activeTab === "SAVED" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunMonitor}
                disabled={isMonitoring || savedOpportunities.length === 0}
                className="font-mono text-xs gap-1.5"
                title="Scan saved opportunities and revalidate stale postings"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isMonitoring ? "animate-spin text-primary" : ""}`} />
                <span>{isMonitoring ? "Monitoring..." : "Run Freshness Check"}</span>
              </Button>
            )}

            <Link href="/app">
              <Button size="sm" variant="outline" className="font-mono text-xs gap-1.5 shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
                New Search
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          <Button
            variant={activeTab === "WATCH" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("WATCH")}
            className="font-mono text-xs gap-1.5"
          >
            <Radio className="h-4 w-4" />
            Autonomous Job Watch ({discoveryEvents.length})
          </Button>

          <Button
            variant={activeTab === "SAVED" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("SAVED")}
            className="font-mono text-xs gap-1.5"
          >
            <BookmarkCheck className="h-4 w-4" />
            Saved Opportunities ({savedOpportunities.length})
          </Button>

          <Button
            variant={activeTab === "ALERTS" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("ALERTS")}
            className="font-mono text-xs gap-1.5 relative"
          >
            <Bell className={`h-4 w-4 ${unreadCount > 0 ? "text-amber-500" : ""}`} />
            <span>Lifecycle Alerts ({lifecycleAlerts.length})</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px] font-bold">
                {unreadCount}
              </Badge>
            )}
          </Button>

          <Button
            variant={activeTab === "SEARCHES" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("SEARCHES")}
            className="font-mono text-xs gap-1.5"
          >
            <History className="h-4 w-4" />
            Search History ({searchHistory.length})
          </Button>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border/80 shadow-xs">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={
                activeTab === "WATCH"
                  ? "Filter novel opportunities by title, company..."
                  : activeTab === "SAVED"
                  ? "Filter saved jobs by title, company, location..."
                  : activeTab === "ALERTS"
                  ? "Filter alerts by keyword, company..."
                  : "Filter past searches by keyword..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {activeTab === "WATCH" && (
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {["ALL", "NEW_OPPORTUNITY", "NEW_SOURCE", "REPOSTED"].map((nov) => (
                  <Button
                    key={nov}
                    variant={noveltyFilter === nov ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setNoveltyFilter(nov)}
                    className="font-mono text-[10px] h-7 px-2"
                  >
                    {nov.replace("_", " ")}
                  </Button>
                ))}
              </div>
            )}

            {activeTab === "SEARCHES" && (
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {["ALL", "COMPLETED", "FAILED"].map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className="font-mono text-[10px] h-7 px-2"
                  >
                    {status}
                  </Button>
                ))}
              </div>
            )}

            {activeTab === "ALERTS" && unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAlertsRead}
                className="font-mono text-xs gap-1 h-8"
              >
                <CheckCheck className="h-3.5 w-3.5 text-primary" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Tab 1: AUTONOMOUS JOB WATCH */}
        {activeTab === "WATCH" && (
          <div className="space-y-6">
            {/* Watch Configuration & Telemetry Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 rounded-2xl border border-border/80 bg-card p-5 space-y-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Continuous Discovery Configuration</h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs font-mono text-muted-foreground">
                      {watchConfig.enabled ? "Active (Monitoring)" : "Paused"}
                    </span>
                    <input
                      type="checkbox"
                      checked={watchConfig.enabled}
                      onChange={(e) => setWatchConfig({ ...watchConfig, enabled: e.target.checked })}
                      className="h-4 w-4 rounded-sm border-border text-primary focus:ring-primary accent-primary"
                    />
                  </label>
                </div>

                {/* 1. Target Roles Editor */}
                <div className="space-y-2 text-xs font-mono">
                  <label className="text-muted-foreground font-semibold flex items-center justify-between">
                    <span>Target Roles ({watchConfig.roles.length})</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Press Enter to add</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-md border border-border/70 bg-background/50">
                    {watchConfig.roles.map((role) => (
                      <Badge key={role} variant="secondary" className="gap-1 text-[11px] font-mono pr-1">
                        {role}
                        <button
                          type="button"
                          onClick={() => removeRole(role)}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <input
                      type="text"
                      placeholder="+ Add role (e.g. AI Engineer)..."
                      value={newRoleInput}
                      onChange={(e) => setNewRoleInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addRole(newRoleInput);
                        }
                      }}
                      className="flex-1 min-w-[140px] bg-transparent text-foreground placeholder:text-muted-foreground/60 text-xs outline-hidden"
                    />
                  </div>
                </div>

                {/* 2. Target Skills Editor */}
                <div className="space-y-2 text-xs font-mono">
                  <label className="text-muted-foreground font-semibold flex items-center justify-between">
                    <span>Target Skills ({watchConfig.skills.length})</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Press Enter to add</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-md border border-border/70 bg-background/50">
                    {watchConfig.skills.map((skill) => (
                      <Badge key={skill} variant="outline" className="gap-1 text-[11px] font-mono pr-1 border-primary/40 text-primary">
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeSkill(skill)}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <input
                      type="text"
                      placeholder="+ Add skill (e.g. Next.js, Python)..."
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSkill(newSkillInput);
                        }
                      }}
                      className="flex-1 min-w-[140px] bg-transparent text-foreground placeholder:text-muted-foreground/60 text-xs outline-hidden"
                    />
                  </div>
                </div>

                {/* 3. Target Locations & Target Companies */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  {/* Locations */}
                  <div className="space-y-2">
                    <label className="text-muted-foreground font-semibold">Target Locations</label>
                    <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-md border border-border/70 bg-background/50">
                      {watchConfig.locations.map((loc) => (
                        <Badge key={loc} variant="secondary" className="gap-1 text-[11px] font-mono pr-1">
                          {loc}
                          <button
                            type="button"
                            onClick={() => removeLocation(loc)}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      <input
                        type="text"
                        placeholder="+ Location (e.g. Hyderabad, Remote)..."
                        value={newLocationInput}
                        onChange={(e) => setNewLocationInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addLocation(newLocationInput);
                          }
                        }}
                        className="flex-1 min-w-[120px] bg-transparent text-foreground placeholder:text-muted-foreground/60 text-xs outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Companies (Company-Targeted Watching) */}
                  <div className="space-y-2">
                    <label className="text-muted-foreground font-semibold flex items-center justify-between">
                      <span>Target Companies</span>
                      <span className="text-[10px] text-primary/80 font-normal">Optional filter</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-md border border-border/70 bg-background/50">
                      {watchConfig.companies.map((comp) => (
                        <Badge key={comp} className="gap-1 text-[11px] font-mono pr-1 bg-primary/20 text-primary border-primary/40">
                          {comp}
                          <button
                            type="button"
                            onClick={() => removeCompany(comp)}
                            className="text-primary hover:text-foreground cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      <input
                        type="text"
                        placeholder="+ Add company (e.g. Microsoft, Google)..."
                        value={newCompanyInput}
                        onChange={(e) => setNewCompanyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCompany(newCompanyInput);
                          }
                        }}
                        className="flex-1 min-w-[120px] bg-transparent text-foreground placeholder:text-muted-foreground/60 text-xs outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Work Modes & Opportunity Types & Sources */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                  {/* Work Modes */}
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground font-semibold">Work Modes</label>
                    <div className="flex flex-wrap gap-1">
                      {["REMOTE", "HYBRID", "ON_SITE"].map((mode) => (
                        <Button
                          key={mode}
                          type="button"
                          variant={watchConfig.workModes.includes(mode) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleWorkMode(mode)}
                          className="h-7 text-[10px] px-2 font-mono"
                        >
                          {mode}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Opportunity Types */}
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground font-semibold">Opportunity Types</label>
                    <div className="flex flex-wrap gap-1">
                      {["INTERNSHIP", "FULL_TIME"].map((type) => (
                        <Button
                          key={type}
                          type="button"
                          variant={watchConfig.opportunityTypes.includes(type) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleOpportunityType(type)}
                          className="h-7 text-[10px] px-2 font-mono"
                        >
                          {type}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Preferred Sources */}
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground font-semibold">Discovery Sources</label>
                    <div className="flex flex-wrap gap-1">
                      {["LinkedIn", "Y Combinator", "Indeed"].map((src) => (
                        <Button
                          key={src}
                          type="button"
                          variant={watchConfig.preferredSources.includes(src) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleSource(src)}
                          className="h-7 text-[10px] px-2 font-mono"
                        >
                          {src}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 5. Frequency & Relevance Score */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono pt-2 border-t border-border/40">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground font-semibold">Scan Frequency</label>
                    <select
                      value={watchConfig.scanIntervalHours}
                      onChange={(e) =>
                        setWatchConfig({ ...watchConfig, scanIntervalHours: parseInt(e.target.value, 10) })
                      }
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground text-xs"
                    >
                      <option value={2}>Every 2 Hours (Ultra Fast)</option>
                      <option value={4}>Every 4 Hours</option>
                      <option value={6}>Every 6 Hours (Recommended)</option>
                      <option value={12}>Every 12 Hours</option>
                      <option value={24}>Daily (Every 24 Hours)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-muted-foreground font-semibold">Min Fit Relevance Score (% Match)</label>
                    <select
                      value={watchConfig.minimumMatchScore}
                      onChange={(e) =>
                        setWatchConfig({ ...watchConfig, minimumMatchScore: parseFloat(e.target.value) })
                      }
                      className="w-full rounded-md border border-border bg-background p-2 text-foreground text-xs"
                    >
                      <option value={60}>60%+ Match (Broad Discovery)</option>
                      <option value={70}>70%+ Match (Balanced Fit)</option>
                      <option value={80}>80%+ Match (High Fit)</option>
                      <option value={90}>90%+ Match (Strict Fit)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border/40">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-mono select-none">
                    <input
                      type="checkbox"
                      checked={watchConfig.latestOnly}
                      onChange={(e) => setWatchConfig({ ...watchConfig, latestOnly: e.target.checked })}
                      className="h-4 w-4 rounded-sm border-border text-primary focus:ring-primary accent-primary"
                    />
                    <span>Latest Postings Only ({watchConfig.freshnessWindowHours}h window)</span>
                  </label>

                  <Button
                    size="sm"
                    onClick={handleSaveWatchConfig}
                    disabled={isSavingWatch}
                    className="font-mono text-xs gap-1.5 cursor-pointer shadow-sm"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>{isSavingWatch ? "Saving..." : "Save Watch Settings"}</span>
                  </Button>
                </div>
              </div>

              {/* Status Telemetry Card */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-3.5 shadow-xs font-mono text-xs">
                <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                  <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-semibold text-foreground">Discovery Telemetry</h3>
                </div>

                <div className="space-y-2 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Watch Status:</span>
                    <span className={watchConfig.enabled ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                      {watchConfig.enabled ? "ACTIVE (SCHEDULED)" : "PAUSED"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Scan:</span>
                    <span className="text-foreground">
                      {watchConfig.lastScannedAt ? new Date(watchConfig.lastScannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Never"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Next Scan:</span>
                    <span className="text-foreground">
                      {watchConfig.nextScanAt ? new Date(watchConfig.nextScanAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Scheduled"}
                    </span>
                  </div>
                  {recentDiscoveryRuns.length > 0 && (
                    <div className="flex justify-between">
                      <span>Last Run:</span>
                      <span className={recentDiscoveryRuns[0].status === "SUCCESS" ? "text-emerald-500 font-medium" : recentDiscoveryRuns[0].status === "PARTIAL_SUCCESS" ? "text-amber-500 font-medium" : "text-rose-500 font-medium"}>
                        {recentDiscoveryRuns[0].triggerType || "SCHEDULED"} ({recentDiscoveryRuns[0].status})
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Novel Opportunities:</span>
                    <span className="text-primary font-bold">{discoveryEvents.length}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground flex justify-between items-center">
                  <span>Sources: <span className="text-foreground">{watchConfig.preferredSources.join(" • ") || "Multi-Source Swarm"}</span></span>
                  <span className="text-[10px] text-emerald-400 font-mono" title="Direct zero-token multi-source web extraction">0 AI Tokens (Swarm)</span>
                </div>
              </div>
            </div>

            {/* Novel Opportunities Feed */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Newly Discovered Opportunities ({filteredDiscoveryEvents.length})
              </h3>

              {filteredDiscoveryEvents.length === 0 ? (
                <div className="py-16 text-center space-y-4 rounded-2xl border border-dashed border-border p-8 bg-card/40">
                  <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    <Radio className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">No autonomous discovery events yet</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      BrowserPilot will automatically scan configured providers on your schedule and surface newly discovered opportunities here.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleRunAutonomousDiscovery}
                    disabled={isDiscovering}
                    className="mt-2 text-xs font-mono gap-1.5"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Launch Discovery Swarm Now
                  </Button>
                </div>
              ) : (
                <JobDossierDeck
                  jobs={filteredDiscoveryEvents.map((ev) => ({
                    ...ev.opportunity,
                    matchScore: ev.matchScore,
                    matchReason: (ev as any).matchReason || (ev.opportunity as any).matchReason,
                    classification: ev.classification,
                    postedAgoText: (ev.opportunity as any).postedAgoText,
                    freshnessClass: ev.freshnessClass,
                  }))}
                  jobId="autonomous_discovery"
                  swarmSummary={{
                    sourcesCount: 3,
                    totalFound: filteredDiscoveryEvents.length,
                    deduplicatedCount: 0,
                    tokenCost: "0 Tokens",
                  }}
                  onBookmarkChange={(oppId, isSaved) => {
                    if (!isSaved) handleBookmarkRemoved(oppId);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Tab 2: SAVED OPPORTUNITIES */}
        {activeTab === "SAVED" && (
          <div>
            {filteredSaved.length === 0 ? (
              <div className="py-20 text-center space-y-4 rounded-2xl border border-dashed border-border p-8 bg-card/40">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <Bookmark className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">No saved opportunities found</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {searchQuery
                      ? "No bookmarked opportunities match your filter."
                      : "You haven't saved any opportunities yet. Bookmark opportunities from search results to monitor their status."}
                  </p>
                </div>
                <Link href="/app">
                  <Button size="sm" className="mt-2 text-xs font-mono gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Explore Opportunities
                  </Button>
                </Link>
              </div>
            ) : (
              <JobDossierDeck
                jobs={filteredSaved.map((s) => ({
                  ...s.opportunity,
                  saved: true,
                }))}
                jobId="saved_view"
                onBookmarkChange={(oppId, isSaved) => {
                  if (!isSaved) handleBookmarkRemoved(oppId);
                }}
              />
            )}
          </div>
        )}

        {/* Tab 3: LIFECYCLE ALERTS */}
        {activeTab === "ALERTS" && (
          <div>
            {filteredAlerts.length === 0 ? (
              <div className="py-20 text-center space-y-4 rounded-2xl border border-dashed border-border p-8 bg-card/40">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <Bell className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">No lifecycle alerts</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {searchQuery
                      ? "No alerts match your filter."
                      : "You have no active lifecycle notifications. BrowserPilot will alert you if any saved or watched postings expire or change."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-xl border p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      alert.isRead
                        ? "border-border/60 bg-card/60 opacity-80"
                        : "border-primary/50 bg-primary/5 shadow-xs"
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {alert.transitionType === "NEW_OPPORTUNITY" ? (
                          <Badge variant="outline" className="font-mono text-[10px] uppercase gap-1 text-emerald-400 border-emerald-500/40 bg-emerald-500/10">
                            <Sparkles className="h-3 w-3" />
                            NEW OPPORTUNITY
                          </Badge>
                        ) : alert.transitionType === "NEW_SOURCE" ? (
                          <Badge variant="outline" className="font-mono text-[10px] uppercase gap-1 text-sky-400 border-sky-500/40 bg-sky-500/10">
                            <Globe className="h-3 w-3" />
                            NEW SOURCE
                          </Badge>
                        ) : alert.transitionType === "REPOSTED" ? (
                          <Badge variant="outline" className="font-mono text-[10px] uppercase gap-1 text-purple-400 border-purple-500/40 bg-purple-500/10">
                            <RotateCw className="h-3 w-3" />
                            REPOSTED
                          </Badge>
                        ) : alert.transitionType === "EXPIRED" || alert.transitionType === "REMOVED" ? (
                          <Badge variant="destructive" className="font-mono text-[10px] uppercase gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {alert.transitionType}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-mono text-[10px] uppercase gap-1 text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                            <CheckCircle2 className="h-3 w-3" />
                            {alert.transitionType}
                          </Badge>
                        )}
                        <span className="font-mono text-xs text-muted-foreground">
                          {new Date(alert.createdAt).toLocaleDateString()} at{" "}
                          {new Date(alert.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {!alert.isRead && (
                          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/40 text-[10px] font-mono">
                            NEW
                          </Badge>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-foreground">
                        {alert.title} — <span className="font-normal text-muted-foreground">{alert.companyName}</span>
                      </h4>

                      <p className="text-xs text-muted-foreground font-mono">
                        {alert.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {!alert.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAlertRead(alert.id)}
                          className="font-mono text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground"
                          title="Mark as read"
                        >
                          Mark read
                        </Button>
                      )}

                      <Link href={`/app/opportunities/${alert.opportunityId}`}>
                        <Button size="sm" variant="outline" className="font-mono text-xs h-8 gap-1 shadow-xs">
                          <span>Inspect</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: SEARCH HISTORY */}
        {activeTab === "SEARCHES" && (
          <div>
            {filteredHistory.length === 0 ? (
              <div className="py-20 text-center space-y-4 rounded-2xl border border-dashed border-border p-8 bg-card/40">
                <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <History className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">No search history records found</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {searchQuery
                      ? "No history records match your search filter."
                      : "You haven't executed any searches yet. Enter a query in the workspace to launch your first opportunity discovery."}
                  </p>
                </div>
                <Link href="/app">
                  <Button size="sm" className="mt-2 text-xs font-mono gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Launch Discovery
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleOpenHistoricalSession(item.id)}
                    className="group rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/60 hover:shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={item.status === "COMPLETED" ? "default" : "outline"}
                          className="font-mono text-[10px]"
                        >
                          {item.status}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString()} at {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          {item.totalFound} results found
                        </span>
                      </div>

                      <h4 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        &quot;{item.rawQuery}&quot;
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono">
                        {item.parsedRole && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {item.parsedRole}
                          </span>
                        )}
                        {item.parsedLocation && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {item.parsedLocation}
                          </span>
                        )}
                        {item.parsedWorkMode && item.parsedWorkMode !== "ANY" && (
                          <span className="flex items-center gap-1">
                            <Layers className="h-3 w-3" />
                            {item.parsedWorkMode}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleDeleteHistorySession(item.id, e)}
                        disabled={deletingId === item.id}
                        className="font-mono text-xs h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Delete search history session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenHistoricalSession(item.id)}
                        className="font-mono text-xs h-8 gap-1.5 group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-xs"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect Evidence</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Historical Session Inspection Modal */}
      {viewingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border/60 bg-muted/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    HISTORICAL SESSION
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(viewingSession.createdAt).toLocaleString()}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  &quot;{viewingSession.rawQuery}&quot;
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewingSession(null)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Modal Body: Historical Job Dossier Deck */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <JobDossierDeck jobs={viewingSession.results} jobId={viewingSession.id} />
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                Showing {viewingSession.results.length} canonical opportunities
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingSession(null)}
                className="font-mono text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground font-mono text-sm">
          Loading Saved & History Workspace...
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}
