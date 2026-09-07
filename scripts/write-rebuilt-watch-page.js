const fs = require('fs');
const path = require('path');

const pageContent = `"use client";

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
  ArrowUpRight,
  Radio,
  Globe,
  Server,
  Check,
  Search,
  ExternalLink,
  AlertTriangle,
  Command as CommandIcon
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useUIState } from "@/components/providers/ui-state-provider";
import { getVerificationCornerBadge } from "@/components/result/job-dossier-deck";

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
    status?: string;
    sourceListings?: Array<{
      sourcePlatform?: string;
      sourceUrl?: string;
      applyUrl?: string;
      verificationStatus?: string;
    }>;
  };
}

export default function WatchPage() {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTriggeringRun, setIsTriggeringRun] = useState(false);
  const { connectors, getConnectorMeta, openCommandPalette } = useUIState();

  const [watchConfig, setWatchConfig] = useState<DiscoveryWatchState>({
    enabled: true,
    roles: ["Software Engineer", "Frontend Developer"],
    skills: ["React", "TypeScript", "Next.js"],
    locations: ["Remote", "San Francisco, CA", "Bengaluru"],
    companies: ["Stripe", "Adobe", "Perplexity", "NVIDIA"],
    workModes: ["REMOTE", "HYBRID"],
    experienceLevels: ["ENTRY_LEVEL", "MID_LEVEL"],
    opportunityTypes: ["FULL_TIME"],
    preferredSources: ["Ashby", "Greenhouse", "Lever", "Workable", "LinkedIn"],
    minimumMatchScore: 75,
    latestOnly: false,
    freshnessWindowHours: 48,
    scanIntervalHours: 4,
  });

  const [recentRuns, setRecentRuns] = useState<DiscoveryRunItem[]>([]);
  const [discoveryEvents, setDiscoveryEvents] = useState<DiscoveryEventItem[]>([]);
  const [newCompanyInput, setNewCompanyInput] = useState("");
  const [newRoleInput, setNewRoleInput] = useState("");
  const [newSkillInput, setNewSkillInput] = useState("");

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
            preferredSources: data.watch.preferredSources || ["Ashby", "Greenhouse", "Lever", "Workable", "LinkedIn"],
            minimumMatchScore: data.watch.minimumMatchScore || 75,
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
        description: \`Autonomous monitor set to scan every \${watchConfig.scanIntervalHours}h across \${watchConfig.preferredSources.length} registered connector sources.\`,
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
        description: \`Found \${data.telemetry?.candidatesFound || 0} candidates (\${data.telemetry?.newOpportunities || 0} new opportunities, \${data.telemetry?.notificationsCreated || 0} alerts).\`,
      });
      fetchWatchData();
    } catch (err: unknown) {
      toast.error("Scan Error", { description: (err as Error).message });
    } finally {
      setIsTriggeringRun(false);
    }
  };

  const handleToggleSource = (sourceName: string) => {
    setWatchConfig(prev => {
      const exists = prev.preferredSources.includes(sourceName);
      const updated = exists
        ? prev.preferredSources.filter(s => s !== sourceName)
        : [...prev.preferredSources, sourceName];
      return { ...prev, preferredSources: updated };
    });
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

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    const role = newRoleInput.trim();
    if (!role) return;
    if (watchConfig.roles.map(r => r.toLowerCase()).includes(role.toLowerCase())) {
      toast.info("Role already in watch list");
      return;
    }
    setWatchConfig(prev => ({
      ...prev,
      roles: [...prev.roles, role],
    }));
    setNewRoleInput("");
  };

  const handleRemoveRole = (roleToRemove: string) => {
    setWatchConfig(prev => ({
      ...prev,
      roles: prev.roles.filter(r => r !== roleToRemove),
    }));
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const skill = newSkillInput.trim();
    if (!skill) return;
    if (watchConfig.skills.map(s => s.toLowerCase()).includes(skill.toLowerCase())) {
      toast.info("Skill already in watch list");
      return;
    }
    setWatchConfig(prev => ({
      ...prev,
      skills: [...prev.skills, skill],
    }));
    setNewSkillInput("");
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setWatchConfig(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skillToRemove),
    }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F6F4] text-foreground antialiased selection:bg-[#1F3D2E]/20 selection:text-[#1F3D2E]">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 pb-32 sm:pb-36 sm:px-6 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1F3D2E]/10 text-[#1F3D2E]">
                <Eye className="h-4 w-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-foreground">
                Autonomous Watch
              </h1>
              <Badge 
                variant={watchConfig.enabled ? "default" : "outline"}
                className={\`font-mono text-xs \${watchConfig.enabled ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" : "text-muted-foreground"}\`}
              >
                {watchConfig.enabled ? "ACTIVE SCAN" : "PAUSED"}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Configure background multi-source discovery. BrowserPilot scans continuously across registered ATS platforms and alerts you when new matching opportunities appear.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerRun}
              disabled={isTriggeringRun || isSaving}
              className="h-9 font-mono text-xs gap-1.5 border-border/80 cursor-pointer bg-white hover:bg-slate-50"
            >
              <RotateCw className={\`h-3.5 w-3.5 \${isTriggeringRun ? "animate-spin text-[#1F3D2E]" : ""}\`} />
              {isTriggeringRun ? "Scanning..." : "Scan Now"}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveWatch}
              disabled={isSaving || isTriggeringRun}
              className="h-9 font-mono text-xs gap-1.5 bg-[#1F3D2E] hover:bg-[#162d22] text-white cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSaving ? "Saving..." : "Save Watch"}
            </Button>
          </div>
        </div>

        {/* Watch Configuration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Controls Panel (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Scan Frequency & Schedule Card */}
            <div className="rounded-xl border border-border/70 bg-white p-5 space-y-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#1F3D2E]" />
                  <h2 className="text-sm sm:text-base font-serif font-bold tracking-tight text-foreground">
                    Scan Frequency & Schedule
                  </h2>
                </div>
                <Button
                  variant={watchConfig.enabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setWatchConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={\`h-7 px-3 font-mono text-xs cursor-pointer \${
                    watchConfig.enabled ? "bg-[#1F3D2E] hover:bg-[#162d22] text-white" : ""
                  }\`}
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
                      className={\`h-9 font-mono text-xs cursor-pointer \${
                        watchConfig.scanIntervalHours === int.hours
                          ? "border-[#1F3D2E] bg-[#1F3D2E]/10 text-[#1F3D2E] font-semibold"
                          : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                      }\`}
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
                      className={\`h-9 font-mono text-xs cursor-pointer \${
                        watchConfig.freshnessWindowHours === f.hours
                          ? "border-[#1F3D2E] bg-[#1F3D2E]/10 text-[#1F3D2E] font-semibold"
                          : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                      }\`}
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
                  <span className="font-mono text-xs font-bold text-[#1F3D2E]">
                    {watchConfig.minimumMatchScore}% match threshold
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[60, 70, 75, 80, 85, 90].slice(0, 4).map((score) => (
                    <Button
                      key={score}
                      type="button"
                      variant={watchConfig.minimumMatchScore === score ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setWatchConfig(prev => ({ ...prev, minimumMatchScore: score }))}
                      className={\`h-8 font-mono text-xs cursor-pointer \${
                        watchConfig.minimumMatchScore === score
                          ? "border-[#1F3D2E] bg-[#1F3D2E]/10 text-[#1F3D2E] font-semibold"
                          : "border-border/60 text-muted-foreground"
                      }\`}
                    >
                      {score}%+ fit
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* LIVE CONNECTOR REGISTRY SELECTION CARD */}
            <div className="rounded-xl border border-border/70 bg-white p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-[#1F3D2E]" />
                  <h2 className="text-sm sm:text-base font-serif font-bold tracking-tight text-foreground">
                    Monitored Sources & ATS Connectors
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#1F3D2E] font-medium">
                  {watchConfig.preferredSources.length} of {connectors.length || 10} sources active
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Select which platforms BrowserPilot queries during automated scans. Sourced live from the Connector Registry:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {(connectors && connectors.length > 0 ? connectors : [
                  { id: "src_ashby", name: "ashby", displayName: "Ashby", type: "DIRECT_ATS" },
                  { id: "src_greenhouse", name: "greenhouse", displayName: "Greenhouse", type: "DIRECT_ATS" },
                  { id: "src_lever", name: "lever", displayName: "Lever", type: "DIRECT_ATS" },
                  { id: "src_workable", name: "workable", displayName: "Workable", type: "DIRECT_ATS" },
                  { id: "src_workday", name: "workday", displayName: "Workday CXS", type: "DIRECT_ATS" },
                  { id: "src_apna", name: "apna", displayName: "Apna", type: "CAREER_PORTAL" },
                  { id: "src_linkedin", name: "linkedin", displayName: "LinkedIn", type: "AGGREGATOR" },
                  { id: "src_indeed", name: "indeed", displayName: "Indeed", type: "AGGREGATOR" },
                  { id: "src_company_careers", name: "company_careers", displayName: "Company Careers", type: "CAREER_PORTAL" },
                  { id: "src_generic_portal", name: "generic_portal", displayName: "Generic Career Portal", type: "CAREER_PORTAL" },
                ]).map((conn) => {
                  const label = conn.displayName || conn.name;
                  const isSelected = watchConfig.preferredSources.some(
                    s => s.toLowerCase() === label.toLowerCase() || s.toLowerCase() === conn.name.toLowerCase()
                  );
                  const isIndeed = conn.name.toLowerCase().includes("indeed");
                  const meta = getConnectorMeta(conn.name);

                  return (
                    <button
                      key={conn.id}
                      type="button"
                      onClick={() => handleToggleSource(label)}
                      className={\`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all cursor-pointer \${
                        isSelected 
                          ? "bg-[#1F3D2E]/5 border-[#1F3D2E]/30 text-foreground ring-1 ring-[#1F3D2E]/20" 
                          : "bg-slate-50/60 border-border/60 text-muted-foreground hover:bg-muted/40"
                      }\`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={\`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold font-mono \${
                          isSelected ? "bg-[#1F3D2E] text-white" : "bg-slate-200 text-slate-600"
                        }\`}>
                          {isSelected ? <Check className="h-3.5 w-3.5" /> : label.charAt(0)}
                        </span>
                        <div className="truncate">
                          <span className="text-xs font-medium block truncate text-foreground font-mono">
                            {label}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono block">
                            {conn.type.replace("_", " ")}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {isIndeed && (
                          <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-300">
                            403 BLOCKED
                          </Badge>
                        )}
                        <Badge 
                          variant="outline" 
                          className={\`font-mono text-[10px] px-1.5 py-0 \${
                            isSelected 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold" 
                              : "text-muted-foreground"
                          }\`}
                        >
                          {isSelected ? "Active" : "Excluded"}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Companies Card */}
            <div className="rounded-xl border border-border/70 bg-white p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#1F3D2E]" />
                  <h2 className="text-sm sm:text-base font-serif font-bold tracking-tight text-foreground">
                    Target Companies
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {watchConfig.companies.length} monitored
                </span>
              </div>

              <form onSubmit={handleAddCompany} className="flex gap-2">
                <Input
                  placeholder="e.g. Stripe, NVIDIA, Adobe, Perplexity..."
                  value={newCompanyInput}
                  onChange={(e) => setNewCompanyInput(e.target.value)}
                  className="font-mono text-xs bg-slate-50/50"
                />
                <Button type="submit" size="sm" variant="secondary" className="font-mono text-xs gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200">
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
                      className="font-mono text-xs py-1 px-2.5 gap-1.5 bg-[#1F3D2E]/10 text-[#1F3D2E] border border-[#1F3D2E]/20"
                    >
                      <span>{comp}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCompany(comp)}
                        className="hover:text-rose-500 cursor-pointer ml-1"
                        aria-label={\`Remove \${comp}\`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-mono italic">
                  No specific company filter. Scanning across all available companies on monitored connectors.
                </p>
              )}
            </div>

            {/* Target Criteria (Roles, Skills, Work Mode) */}
            <div className="rounded-xl border border-border/70 bg-white p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-[#1F3D2E]" />
                  <h2 className="text-sm sm:text-base font-serif font-bold tracking-tight text-foreground">
                    Target Roles, Skills & Work Mode
                  </h2>
                </div>
              </div>

              {/* Roles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground block font-mono">
                    Roles Monitored
                  </label>
                  <span className="text-xs text-muted-foreground font-mono">
                    {watchConfig.roles.length} roles
                  </span>
                </div>

                <form onSubmit={handleAddRole} className="flex gap-2">
                  <Input
                    placeholder="e.g. Software Engineer, Frontend Developer, Platform Engineer..."
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    className="font-mono text-xs bg-slate-50/50"
                  />
                  <Button type="submit" size="sm" variant="secondary" className="font-mono text-xs gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200">
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </form>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {watchConfig.roles.map((r) => (
                    <Badge
                      key={r}
                      variant="outline"
                      className="font-mono text-xs bg-slate-50 py-1 px-2.5 gap-1.5 border-border/70"
                    >
                      <span>{r}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRole(r)}
                        className="hover:text-rose-500 cursor-pointer ml-1"
                        aria-label={\`Remove role \${r}\`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {watchConfig.roles.length === 0 && (
                    <p className="text-xs text-muted-foreground font-mono italic">
                      No roles monitored yet. Add roles above to track opportunities.
                    </p>
                  )}
                </div>
              </div>

              {/* Skills */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground block font-mono">
                    Key Skills
                  </label>
                  <span className="text-xs text-muted-foreground font-mono">
                    {watchConfig.skills.length} skills
                  </span>
                </div>

                <form onSubmit={handleAddSkill} className="flex gap-2">
                  <Input
                    placeholder="e.g. React, TypeScript, Next.js, Node.js, Python..."
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    className="font-mono text-xs bg-slate-50/50"
                  />
                  <Button type="submit" size="sm" variant="secondary" className="font-mono text-xs gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200">
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </form>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {watchConfig.skills.map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="font-mono text-xs bg-slate-50 py-1 px-2.5 gap-1.5 border-border/70"
                    >
                      <span>{s}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(s)}
                        className="hover:text-rose-500 cursor-pointer ml-1"
                        aria-label={\`Remove skill \${s}\`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {watchConfig.skills.length === 0 && (
                    <p className="text-xs text-muted-foreground font-mono italic">
                      No specific skills filtered. Add keywords or tools above.
                    </p>
                  )}
                </div>
              </div>

              {/* Work Mode & Opp Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5 font-mono">
                    Work Mode Preference
                  </label>
                  <div className="flex flex-wrap gap-1.5">
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
                        className={\`h-7 px-2.5 font-mono text-[11px] cursor-pointer \${
                          watchConfig.workModes.includes(mode)
                            ? "bg-[#1F3D2E]/10 text-[#1F3D2E] border-[#1F3D2E]/30 font-semibold"
                            : "text-muted-foreground"
                        }\`}
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
                  <div className="flex flex-wrap gap-1.5">
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
                        className={\`h-7 px-2.5 font-mono text-[11px] cursor-pointer \${
                          watchConfig.opportunityTypes.includes(oppType)
                            ? "bg-[#1F3D2E]/10 text-[#1F3D2E] border-[#1F3D2E]/30 font-semibold"
                            : "text-muted-foreground"
                        }\`}
                      >
                        {oppType === "FULL_TIME" ? "Full Time" : "Internship"}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Schedule Info & Recent Novel Opportunities */}
          <div className="space-y-6">
            {/* Status Summary Widget */}
            <div className="rounded-xl border border-border/70 bg-white p-5 space-y-4 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Monitoring Telemetry
              </h3>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-muted-foreground">State:</span>
                  <span className={watchConfig.enabled ? "text-emerald-700 font-bold" : "text-amber-600"}>
                    {watchConfig.enabled ? "Active Continuous Scan" : "Paused"}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-muted-foreground">Scan Cadence:</span>
                  <span className="font-semibold text-foreground">Every {watchConfig.scanIntervalHours} hours</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-muted-foreground">Freshness Cutoff:</span>
                  <span>Last {watchConfig.freshnessWindowHours} hours</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-muted-foreground">Match Threshold:</span>
                  <span>{watchConfig.minimumMatchScore}% relevance</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-muted-foreground">Monitored Sources:</span>
                  <span>{watchConfig.preferredSources.length} connectors</span>
                </div>
                {watchConfig.nextScanAt && (
                  <div className="flex items-center justify-between pb-2 border-b border-border/40">
                    <span className="text-muted-foreground">Next Scheduled Run:</span>
                    <span>{new Date(watchConfig.nextScanAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                {watchConfig.lastScannedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last Scanned:</span>
                    <span>{new Date(watchConfig.lastScannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
              </div>

              {/* Command Palette trigger hint */}
              <div className="pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={openCommandPalette}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-50 hover:bg-slate-100 text-muted-foreground hover:text-foreground text-[11px] font-mono transition-colors border border-border/50 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <CommandIcon className="h-3 w-3" />
                    <span>Command Palette</span>
                  </span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-border text-[10px]">⌘K</kbd>
                </button>
              </div>
            </div>

            {/* Recent Discovery Activity */}
            <div className="rounded-xl border border-border/70 bg-white p-5 space-y-4 shadow-xs">
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
                  {discoveryEvents.slice(0, 5).map((ev) => {
                    const primaryListing = ev.opportunity?.sourceListings?.[0];
                    const connectorMeta = getConnectorMeta(primaryListing?.sourcePlatform, ev.opportunity?.primaryApplyUrl);
                    const verificationBadge = getVerificationCornerBadge(primaryListing?.verificationStatus || ev.opportunity?.status || "VERIFIED_LIVE");

                    return (
                      <div key={ev.id} className="p-3 rounded-lg bg-slate-50 border border-border/60 space-y-2 relative">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="font-mono text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            {ev.classification}
                          </Badge>
                          {verificationBadge}
                        </div>

                        <div>
                          <h4 className="text-xs font-serif font-bold text-foreground line-clamp-1">
                            {ev.opportunity?.title}
                          </h4>
                          <p className="text-[11px] font-mono text-muted-foreground">
                            {ev.opportunity?.companyName} {ev.opportunity?.location ? \`• \${ev.opportunity.location}\` : ""}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] font-mono">
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#1F3D2E]" />
                            {connectorMeta.displayName}
                          </span>
                          {ev.opportunity?.primaryApplyUrl && (
                            <a
                              href={ev.opportunity.primaryApplyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#1F3D2E] font-semibold hover:underline flex items-center gap-0.5"
                            >
                              Apply <ArrowUpRight className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 px-3 space-y-2 bg-slate-50/50 rounded-lg border border-dashed border-border/80">
                  <ShieldCheck className="h-6 w-6 text-[#1F3D2E]/60 mx-auto" />
                  <p className="text-xs font-semibold text-foreground font-serif">
                    No New Opportunities Detected Yet
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono max-w-xs mx-auto leading-relaxed">
                    The background engine is active and will crawl across your {watchConfig.preferredSources.length} selected sources every {watchConfig.scanIntervalHours}h. New verified matches will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../app/app/watch/page.tsx'), pageContent, 'utf8');
console.log('Successfully wrote rebuilt app/app/watch/page.tsx');
