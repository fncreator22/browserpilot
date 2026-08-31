"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { 
  Eye, 
  Clock, 
  RotateCw, 
  CheckCircle2, 
  Sliders, 
  ShieldCheck, 
  Briefcase, 
  MapPin, 
  Zap, 
  Building2, 
  Plus, 
  X, 
  Sparkles,
  Calendar,
  Layers,
  ArrowUpRight
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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

interface DiscoveryRunItem {
  id: string;
  status: string;
  durationMs: number;
  triggerType: string;
  candidatesFound: number;
  newOpportunities: number;
  newSources: number;
  alreadyKnown: number;
  reposted: number;
  notificationsCreated: number;
  startedAt: string;
  completedAt?: string | null;
}

interface DiscoveryEventItem {
  id: string;
  classification: string;
  matchScore: number;
  discoveredAt: string;
  opportunity: {
    id: string;
    title: string;
    companyName: string;
    location?: string;
    workMode?: string;
    primaryApplyUrl?: string;
  };
}

export default function WatchPage() {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTriggeringRun, setIsTriggeringRun] = useState(false);

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
    scanIntervalHours: 4,
  });

  const [recentRuns, setRecentRuns] = useState<DiscoveryRunItem[]>([]);
  const [discoveryEvents, setDiscoveryEvents] = useState<DiscoveryEventItem[]>([]);
  const [newCompanyInput, setNewCompanyInput] = useState("");

  const fetchWatchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/discovery/watch");
      if (res.ok) {
        const data = await res.json();
        if (data.watch) {
          setWatchConfig({
            enabled: data.watch.enabled ?? true,
            roles: data.watch.roles || [],
            skills: data.watch.skills || [],
            locations: data.watch.locations || [],
            companies: data.watch.companies || [],
            workModes: data.watch.workModes || ["REMOTE"],
            experienceLevels: data.watch.experienceLevels || ["ENTRY_LEVEL"],
            opportunityTypes: data.watch.opportunityTypes || ["FULL_TIME"],
            preferredSources: data.watch.preferredSources || ["LinkedIn", "Y Combinator", "Indeed"],
            minimumMatchScore: data.watch.minimumMatchScore || 70,
            latestOnly: data.watch.latestOnly || false,
            freshnessWindowHours: data.watch.freshnessWindowHours || 48,
            scanIntervalHours: data.watch.scanIntervalHours || 4,
            lastScannedAt: data.watch.lastScannedAt,
            nextScanAt: data.watch.nextScanAt,
          });
        }
        if (data.recentRuns) {
          setRecentRuns(data.recentRuns);
        }
      }

      // Fetch recent discovery events
      const eventsRes = await fetch("/api/discovery/events?limit=8");
      if (eventsRes.ok) {
        const evData = await eventsRes.json();
        setDiscoveryEvents(evData.events || []);
      }
    } catch {
      // Non-fatal
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchData();
  }, []);

  const handleSaveWatch = async () => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/discovery/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(watchConfig),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save watch settings");
      }

      toast.success("Watch Criteria Saved!", {
        description: `Autonomous monitor set to scan every ${watchConfig.scanIntervalHours}h across ${watchConfig.companies.length || "all"} target companies.`,
      });
      fetchWatchData();
    } catch (err: unknown) {
      toast.error("Save Error", { description: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerRun = async () => {
    try {
      setIsTriggeringRun(true);
      const res = await fetch("/api/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceScan: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Discovery scan failed to trigger");
      }

      toast.success("Discovery Scan Completed!", {
        description: `Found ${data.telemetry?.candidatesFound || 0} candidates (${data.telemetry?.newOpportunities || 0} new opportunities, ${data.telemetry?.notificationsCreated || 0} alerts).`,
      });
      fetchWatchData();
    } catch (err: unknown) {
      toast.error("Scan Error", { description: (err as Error).message });
    } finally {
      setIsTriggeringRun(false);
    }
  };

  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    const comp = newCompanyInput.trim();
    if (!comp) return;
    if (watchConfig.companies.map(c => c.toLowerCase()).includes(comp.toLowerCase())) {
      toast.info("Company already in watch list");
      return;
    }
    setWatchConfig(prev => ({
      ...prev,
      companies: [...prev.companies, comp],
    }));
    setNewCompanyInput("");
  };

  const handleRemoveCompany = (compToRemove: string) => {
    setWatchConfig(prev => ({
      ...prev,
      companies: prev.companies.filter(c => c !== compToRemove),
    }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Workspace Navigation Bar */}
        <WorkspaceNav showNewSearchButton />

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Eye className="h-4 w-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Autonomous Watch
              </h1>
              <Badge 
                variant={watchConfig.enabled ? "default" : "outline"}
                className={`font-mono text-xs ${watchConfig.enabled ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "text-muted-foreground"}`}
              >
                {watchConfig.enabled ? "ACTIVE" : "PAUSED"}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Configure background multi-source discovery. BrowserPilot scans continuously and alerts you when new matching opportunities appear.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerRun}
              disabled={isTriggeringRun || isSaving}
              className="h-8 font-mono text-xs gap-1.5 border-border/80 cursor-pointer"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isTriggeringRun ? "animate-spin text-primary" : ""}`} />
              {isTriggeringRun ? "Scanning..." : "Scan Now"}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveWatch}
              disabled={isSaving || isTriggeringRun}
              className="h-8 font-mono text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSaving ? "Saving..." : "Save Watch"}
            </Button>
          </div>
        </div>

        {/* Watch Configuration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Controls Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status & Schedule Card */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold tracking-tight text-foreground font-mono">
                    Scan Frequency & Active State
                  </h2>
                </div>
                <Button
                  variant={watchConfig.enabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setWatchConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`h-7 px-3 font-mono text-xs cursor-pointer ${
                    watchConfig.enabled ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                  }`}
                >
                  {watchConfig.enabled ? "Enabled" : "Paused"}
                </Button>
              </div>

              {/* Interval Selection */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2 font-mono">
                  Scan Interval
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { hours: 2, label: "Every 2 hours" },
                    { hours: 4, label: "Every 4 hours" },
                    { hours: 6, label: "Every 6 hours" },
                    { hours: 12, label: "Every 12 hours" },
                    { hours: 24, label: "Daily (24h)" },
                  ].map((int) => (
                    <Button
                      key={int.hours}
                      type="button"
                      variant={watchConfig.scanIntervalHours === int.hours ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setWatchConfig(prev => ({ ...prev, scanIntervalHours: int.hours }))}
                      className={`h-9 font-mono text-xs cursor-pointer ${
                        watchConfig.scanIntervalHours === int.hours
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {int.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Freshness Window Filter */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2 font-mono">
                  Freshness Window (Hard Boundary)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { hours: 24, label: "Last 24 hours" },
                    { hours: 48, label: "Last 48 hours" },
                    { hours: 72, label: "Last 3 days" },
                    { hours: 168, label: "This week (7d)" },
                  ].map((f) => (
                    <Button
                      key={f.hours}
                      type="button"
                      variant={watchConfig.freshnessWindowHours === f.hours ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setWatchConfig(prev => ({ ...prev, freshnessWindowHours: f.hours }))}
                      className={`h-9 font-mono text-xs cursor-pointer ${
                        watchConfig.freshnessWindowHours === f.hours
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Minimum Fit Threshold */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-muted-foreground font-mono">
                    Minimum Relevance Fit Score
                  </label>
                  <span className="font-mono text-xs font-bold text-primary">
                    {watchConfig.minimumMatchScore}% match
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[60, 70, 80, 90].map((score) => (
                    <Button
                      key={score}
                      type="button"
                      variant={watchConfig.minimumMatchScore === score ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setWatchConfig(prev => ({ ...prev, minimumMatchScore: score }))}
                      className={`h-8 font-mono text-xs cursor-pointer ${
                        watchConfig.minimumMatchScore === score
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border/60 text-muted-foreground"
                      }`}
                    >
                      {score}%+ fit
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Target Companies Card */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold tracking-tight text-foreground font-mono">
                    Target Companies
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {watchConfig.companies.length} monitored
                </span>
              </div>

              <form onSubmit={handleAddCompany} className="flex gap-2">
                <Input
                  placeholder="e.g. Razorpay, Google, Stripe, Microsoft..."
                  value={newCompanyInput}
                  onChange={(e) => setNewCompanyInput(e.target.value)}
                  className="font-mono text-xs bg-muted/20"
                />
                <Button type="submit" size="sm" variant="secondary" className="font-mono text-xs gap-1 cursor-pointer">
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </form>

              {watchConfig.companies.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {watchConfig.companies.map((comp) => (
                    <Badge
                      key={comp}
                      variant="secondary"
                      className="font-mono text-xs py-1 px-2.5 gap-1.5 bg-primary/10 text-primary border border-primary/20"
                    >
                      <span>{comp}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCompany(comp)}
                        className="hover:text-rose-500 cursor-pointer"
                        aria-label={`Remove ${comp}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-mono italic">
                  No specific company filter. Scanning all companies matching your role and skill criteria.
                </p>
              )}
            </div>

            {/* Target Criteria (Roles, Skills, Locations) */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold tracking-tight text-foreground font-mono">
                    Target Roles, Skills & Work Mode
                  </h2>
                </div>
              </div>

              {/* Roles */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5 font-mono">
                  Roles Monitored
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {watchConfig.roles.map((r) => (
                    <Badge key={r} variant="outline" className="font-mono text-xs bg-muted/30">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5 font-mono">
                  Key Skills
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {watchConfig.skills.map((s) => (
                    <Badge key={s} variant="outline" className="font-mono text-xs bg-muted/30">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Work Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5 font-mono">
                    Work Mode Preference
                  </label>
                  <div className="flex gap-2">
                    {["REMOTE", "HYBRID", "ON_SITE"].map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        variant={watchConfig.workModes.includes(mode) ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => {
                          setWatchConfig(prev => ({
                            ...prev,
                            workModes: prev.workModes.includes(mode)
                              ? prev.workModes.filter(m => m !== mode)
                              : [...prev.workModes, mode],
                          }));
                        }}
                        className={`h-7 px-2.5 font-mono text-[11px] cursor-pointer ${
                          watchConfig.workModes.includes(mode)
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "text-muted-foreground"
                        }`}
                      >
                        {mode}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5 font-mono">
                    Opportunity Type
                  </label>
                  <div className="flex gap-2">
                    {["INTERNSHIP", "FULL_TIME"].map((oppType) => (
                      <Button
                        key={oppType}
                        type="button"
                        variant={watchConfig.opportunityTypes.includes(oppType) ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => {
                          setWatchConfig(prev => ({
                            ...prev,
                            opportunityTypes: prev.opportunityTypes.includes(oppType)
                              ? prev.opportunityTypes.filter(t => t !== oppType)
                              : [...prev.opportunityTypes, oppType],
                          }));
                        }}
                        className={`h-7 px-2.5 font-mono text-[11px] cursor-pointer ${
                          watchConfig.opportunityTypes.includes(oppType)
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "text-muted-foreground"
                        }`}
                      >
                        {oppType === "FULL_TIME" ? "Full Time" : "Internship"}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Schedule Info & Recent Discovery Events */}
          <div className="space-y-6">
            {/* Status Summary Widget */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Monitoring Status
              </h3>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-muted-foreground">State:</span>
                  <span className={watchConfig.enabled ? "text-emerald-500 font-bold" : "text-amber-500"}>
                    {watchConfig.enabled ? "Active Continuous Scan" : "Paused"}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-muted-foreground">Interval:</span>
                  <span>Every {watchConfig.scanIntervalHours} hours</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-muted-foreground">Freshness:</span>
                  <span>Last {watchConfig.freshnessWindowHours}h</span>
                </div>
                {watchConfig.nextScanAt && (
                  <div className="flex items-center justify-between pb-2 border-b border-border/40">
                    <span className="text-muted-foreground">Next Run:</span>
                    <span>{new Date(watchConfig.nextScanAt).toLocaleTimeString()}</span>
                  </div>
                )}
                {watchConfig.lastScannedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last Run:</span>
                    <span>{new Date(watchConfig.lastScannedAt).toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Discovery Activity */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Recent Novel Opportunities
                </h3>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {discoveryEvents.length} detected
                </span>
              </div>

              {discoveryEvents.length > 0 ? (
                <div className="space-y-3">
                  {discoveryEvents.slice(0, 5).map((ev) => (
                    <div key={ev.id} className="p-3 rounded-lg bg-muted/20 border border-border/40 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="font-mono text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          {ev.classification}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {new Date(ev.discoveredAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-foreground line-clamp-1">
                        {ev.opportunity?.title}
                      </h4>
                      <p className="text-[11px] font-mono text-muted-foreground flex items-center justify-between">
                        <span>{ev.opportunity?.companyName}</span>
                        {ev.opportunity?.primaryApplyUrl && (
                          <a
                            href={ev.opportunity.primaryApplyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-0.5"
                          >
                            Apply <ArrowUpRight className="h-3 w-3" />
                          </a>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-mono italic py-4 text-center">
                  No new opportunities detected in recent runs.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
