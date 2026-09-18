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
  ArrowUpRight,
  Radio,
  Globe,
  Server,
  Check,
  Search,
  ExternalLink,
  Command as CommandIcon,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  AlertTriangle,
  Info,
  Puzzle,
  Blocks,
  Lock,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { InfoBadge } from "@/components/ui/info-badge";
import { useUIState } from "@/components/providers/ui-state-provider";
import { getVerificationCornerBadge, type DossierJobItem } from "@/components/result/job-dossier-deck";
import { JobDetailSlideOver } from "@/components/result/job-detail-slideover";
import { PersonnelConnectDrawer } from "@/components/result/personnel-connect-drawer";
import { MARKETPLACE_PLUGINS, type MarketplacePlugin, type UserPluginStatus } from "@/lib/plugins/pluginTypes";
import { 
  humanizeStatus, 
  humanizeConnectorType, 
  humanizeOpportunityType, 
  humanizeWorkMode,
  humanizeClassification
} from "@/lib/utils/display-mappings";

interface DiscoveryWatchState {
  id?: string;
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
    saved?: boolean;
    description?: string;
    skills?: string[];
    requirements?: string[];
    salaryMin?: number;
    salaryMax?: number;
    salaryCurrency?: string;
    experienceLevel?: string;
    opportunityType?: string;
    companyIntelligence?: any;
    companyContacts?: any[];
    trustReport?: any;
    urlAnalysis?: any;
    sourceListings?: Array<{
      sourcePlatform?: string;
      sourceUrl?: string;
      applyUrl?: string;
      verificationStatus?: string;
    }>;
  };
}

function ensureArray(val: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(val)) {
    return val.map((item) => (typeof item === "string" ? item : String(item))).filter(Boolean);
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "[]") return fallback;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => (typeof item === "string" ? item : String(item))).filter(Boolean);
      }
      if (typeof parsed === "string") {
        try {
          const nested = JSON.parse(parsed);
          if (Array.isArray(nested)) {
            return nested.map((item) => (typeof item === "string" ? item : String(item))).filter(Boolean);
          }
        } catch {}
        return parsed ? [parsed] : fallback;
      }
    } catch {
      if (trimmed.includes(",")) {
        return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
      }
      return [trimmed];
    }
  }
  return fallback;
}

export default function WatchPage() {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTriggeringRun, setIsTriggeringRun] = useState(false);
  const { connectors, getConnectorMeta, openCommandPalette, openProfileModal } = useUIState();

  const [watchConfig, setWatchConfig] = useState<DiscoveryWatchState>({
    enabled: false,
    roles: ["Software Engineer", "Frontend Developer"],
    skills: ["React", "TypeScript", "Next.js"],
    locations: ["San Francisco, CA", "Bengaluru"],
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
  const [newLocationInput, setNewLocationInput] = useState("");
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<UserPluginStatus[]>([]);
  const [isLoadingPlugins, setIsLoadingPlugins] = useState(false);
  const [showPluginDrawer, setShowPluginDrawer] = useState(false);
  const [togglingPluginId, setTogglingPluginId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<DossierJobItem | null>(null);
  const [personnelDrawerJob, setPersonnelDrawerJob] = useState<DossierJobItem | null>(null);
  const [savedStates, setSavedStates] = useState<Record<string, boolean>>({});
  const [savingJobIds, setSavingJobIds] = useState<Record<string, boolean>>({});

  const handleToggleSaveJob = async (jobId: string, currentSaved: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      setSavingJobIds((prev) => ({ ...prev, [jobId]: true }));
      const endpoint = `/api/opportunities/${jobId}/save`;
      const res = await fetch(endpoint, {
        method: currentSaved ? "DELETE" : "POST",
      });
      if (res.ok) {
        setSavedStates((prev) => ({ ...prev, [jobId]: !currentSaved }));
        toast.success(currentSaved ? "Opportunity removed from bookmarks" : "Opportunity saved to bookmarks");
      }
    } catch {
      toast.error("Error updating saved status");
    } finally {
      setSavingJobIds((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const mapEventToDossierJob = (ev: DiscoveryEventItem): DossierJobItem => {
    const opp = ev.opportunity || ({} as any);
    const primaryListing = opp.sourceListings?.[0];
    const isSaved = savedStates[opp.id] ?? opp.saved ?? false;
    return {
      id: opp.id,
      title: opp.title,
      companyName: opp.companyName,
      location: opp.location || "Location Unspecified",
      workMode: opp.workMode,
      experienceLevel: opp.experienceLevel,
      opportunityType: opp.opportunityType,
      salaryMin: opp.salaryMin,
      salaryMax: opp.salaryMax,
      salaryCurrency: opp.salaryCurrency,
      description: opp.description || "",
      requirements: Array.isArray(opp.requirements) ? opp.requirements : [],
      skills: Array.isArray(opp.skills) ? opp.skills : [],
      primaryApplyUrl: opp.primaryApplyUrl || primaryListing?.applyUrl || primaryListing?.sourceUrl,
      applyUrl: opp.primaryApplyUrl || primaryListing?.applyUrl || primaryListing?.sourceUrl,
      verificationStatus: primaryListing?.verificationStatus || opp.status || "VERIFIED_LIVE",
      matchScore: ev.matchScore || 85,
      matchReason: `Discovered by Autonomous Radar with ${Math.round(ev.matchScore || 85)}% role and requirements alignment.`,
      classification: ev.classification,
      companyIntelligence: (opp as any).companyIntelligence,
      companyContacts: (opp as any).companyContacts || [],
      saved: isSaved,
      sourceListings: opp.sourceListings?.map((l: any) => ({
        sourcePlatform: l.sourcePlatform,
        sourceUrl: l.sourceUrl,
        applyUrl: l.applyUrl,
        verificationStatus: l.verificationStatus,
      })) || [],
    };
  };

  const fetchWatchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/discovery/watch");
      if (res.ok) {
        const data = await res.json();
        const draftStr = typeof window !== "undefined" ? localStorage.getItem("browserai:watch_draft") : null;
        let draft: Partial<DiscoveryWatchState> | null = null;
        if (draftStr) {
          try {
            draft = JSON.parse(draftStr);
          } catch {}
        }

        if (data.watch) {
          const rawLocs = draft?.locations && draft.locations.length > 0 ? draft.locations : ensureArray(data.watch.locations, ["San Francisco, CA", "Bengaluru"]);
          const hasRemoteInLocs = rawLocs.some((l) => /^(remote|fully\s*remote|remote-first)$/i.test(l.trim()));
          const cleanLocs = rawLocs.filter((l) => !/^(remote|fully\s*remote|remote-first)$/i.test(l.trim()));
          const rawWorkModes = draft?.workModes && draft.workModes.length > 0 ? draft.workModes : ensureArray(data.watch.workModes, ["REMOTE", "HYBRID"]);
          const cleanWorkModes = hasRemoteInLocs && !rawWorkModes.includes("REMOTE") ? [...rawWorkModes, "REMOTE"] : rawWorkModes;

          setWatchConfig({
            id: data.watch.id,
            enabled: draft?.enabled !== undefined ? draft.enabled : (data.watch.enabled ?? false),
            roles: draft?.roles && draft.roles.length > 0 ? draft.roles : ensureArray(data.watch.roles, ["Software Engineer", "Frontend Developer"]),
            skills: draft?.skills && draft.skills.length > 0 ? draft.skills : ensureArray(data.watch.skills, ["React", "TypeScript"]),
            locations: cleanLocs,
            companies: draft?.companies && draft.companies.length > 0 ? draft.companies : ensureArray(data.watch.companies),
            workModes: cleanWorkModes,
            experienceLevels: draft?.experienceLevels && draft.experienceLevels.length > 0 ? draft.experienceLevels : ensureArray(data.watch.experienceLevels, ["ENTRY_LEVEL"]),
            opportunityTypes: draft?.opportunityTypes && draft.opportunityTypes.length > 0 ? draft.opportunityTypes : ensureArray(data.watch.opportunityTypes, ["FULL_TIME"]),
            preferredSources: draft?.preferredSources && draft.preferredSources.length > 0 ? draft.preferredSources : ensureArray(data.watch.preferredSources, ["Ashby", "Greenhouse", "Lever", "Workable", "LinkedIn"]),
            minimumMatchScore: draft?.minimumMatchScore ?? data.watch.minimumMatchScore ?? 75,
            latestOnly: draft?.latestOnly ?? data.watch.latestOnly ?? false,
            freshnessWindowHours: draft?.freshnessWindowHours ?? data.watch.freshnessWindowHours ?? 48,
            scanIntervalHours: draft?.scanIntervalHours ?? data.watch.scanIntervalHours ?? 4,
            lastScannedAt: data.watch.lastScannedAt,
            nextScanAt: data.watch.nextScanAt,
          });
        }
        if (data.recentRuns) {
          setRecentRuns(data.recentRuns);
        }
      }

      // Fetch active plugins from marketplace
      try {
        const pluginsRes = await fetch("/api/plugins");
        if (pluginsRes.ok) {
          const pData = await pluginsRes.json();
          setPlugins(pData.plugins || []);
        }
      } catch (pErr) {
        console.warn("Could not fetch plugins:", pErr);
      }

      // Fetch recent novel opportunity discovery events
      try {
        const eventsRes = await fetch("/api/discovery/events?limit=10");
        if (eventsRes.ok) {
          const eData = await eventsRes.json();
          if (eData.events && Array.isArray(eData.events)) {
            setDiscoveryEvents(eData.events);
          }
        }
      } catch (eErr) {
        console.warn("Could not fetch discovery events:", eErr);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleWatchPlugin = async (plugin: UserPluginStatus) => {
    if (plugin.type === "AUTH_REQUIRED" && !plugin.isConnected) {
      toast.info(`Authentication required for ${plugin.displayName}`, {
        description: "Redirecting to Plugins Marketplace to authenticate your account...",
        action: {
          label: "Open Plugins",
          onClick: () => { window.location.href = "/app/plugins"; },
        },
      });
      return;
    }

    try {
      setTogglingPluginId(plugin.id);
      const newAction = plugin.isConnected ? "DISCONNECT" : "CONNECT";
      const res = await fetch(`/api/plugins/${plugin.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: newAction }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(newAction === "CONNECT" ? `Connected to ${plugin.displayName}` : `Disconnected from ${plugin.displayName}`, {
          description: "Saved to your active monitored sources.",
        });

        // Update local plugins list
        setPlugins((prev) =>
          prev.map((p) =>
            p.id === plugin.id
              ? {
                  ...p,
                  isConnected: newAction === "CONNECT",
                  status: newAction === "CONNECT" ? "CONNECTED" : (p.type === "DIRECT_FREE" ? "DISCONNECTED" : "REQUIRES_AUTH"),
                }
              : p
          )
        );

        // Synchronize with watchConfig.preferredSources
        setWatchConfig((prev) => {
          const current = prev.preferredSources || [];
          const updated = newAction === "CONNECT"
            ? Array.from(new Set([...current, plugin.name]))
            : current.filter((s) => s.toLowerCase() !== plugin.name.toLowerCase() && s.toLowerCase() !== plugin.id.toLowerCase());
          return { ...prev, preferredSources: updated };
        });
      } else {
        toast.error("Could not update plugin", {
          description: data.message || "Failed to communicate with plugin engine.",
        });
      }
    } catch {
      toast.error("Network error updating plugin status.");
    } finally {
      setTogglingPluginId(null);
    }
  };

  useEffect(() => {
    fetchWatchData();
  }, []);

  // Synchronize unsaved draft changes to localStorage so modal opening or navigating never loses input
  useEffect(() => {
    if (!isLoading && (watchConfig.roles?.length || watchConfig.companies?.length || watchConfig.skills?.length || watchConfig.locations?.length)) {
      try {
        localStorage.setItem("browserai:watch_draft", JSON.stringify(watchConfig));
      } catch {}
    }
  }, [watchConfig, isLoading]);

  const handleSaveWatch = async () => {
    setSaveError(null);
    if (watchConfig.preferredSources.length === 0) {
      const msg = "Please select at least one monitored connector source before saving your watch configuration.";
      setSaveError(msg);
      toast.error("Save Error", { description: msg });
      return;
    }

    try {
      setIsSaving(true);
      const rawWatchLocs = watchConfig.locations || [];
      const hasRemote = rawWatchLocs.some((l) => /^(remote|fully\s*remote|remote-first)$/i.test(l.trim()));
      const cleanWatchLocs = rawWatchLocs.filter((l) => !/^(remote|fully\s*remote|remote-first)$/i.test(l.trim()));
      const cleanWatchModes = [...(watchConfig.workModes || [])];
      if (hasRemote && !cleanWatchModes.includes("REMOTE")) {
        cleanWatchModes.push("REMOTE");
      }

      const payload = {
        ...watchConfig,
        locations: cleanWatchLocs,
        workModes: cleanWatchModes,
      };

      const res = await fetch("/api/discovery/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save watch settings");
      }

      if (typeof window !== "undefined") {
        localStorage.removeItem("browserai:watch_draft");
      }

      toast.success("Watch Criteria Saved!", {
        description: `Autonomous monitor set to scan every ${watchConfig.scanIntervalHours}h across ${watchConfig.preferredSources.length} registered connector sources.`,
      });
      fetchWatchData();
    } catch (err: unknown) {
      const msg = (err as Error).message || "Failed to save watch settings";
      setSaveError(msg);
      toast.error("Save Error", { description: msg });
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

  const handleSaveAndScan = async () => {
    await handleSaveWatch();
    await handleTriggerRun();
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
    if ((watchConfig.companies || []).map(c => c.toLowerCase()).includes(comp.toLowerCase())) {
      toast.info("Company already in watch list");
      return;
    }
    setWatchConfig(prev => ({
      ...prev,
      companies: [...(prev.companies || []), comp],
    }));
    setNewCompanyInput("");
  };

  const handleRemoveCompany = (compToRemove: string) => {
    setWatchConfig(prev => ({
      ...prev,
      companies: (prev.companies || []).filter(c => c !== compToRemove),
    }));
  };

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    const role = newRoleInput.trim();
    if (!role) return;
    if ((watchConfig.roles || []).map(r => r.toLowerCase()).includes(role.toLowerCase())) {
      toast.info("Role already in watch list");
      return;
    }
    setWatchConfig(prev => ({
      ...prev,
      roles: [...(prev.roles || []), role],
    }));
    setNewRoleInput("");
  };

  const handleRemoveRole = (roleToRemove: string) => {
    setWatchConfig(prev => ({
      ...prev,
      roles: (prev.roles || []).filter(r => r !== roleToRemove),
    }));
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const skill = newSkillInput.trim();
    if (!skill) return;
    if ((watchConfig.skills || []).map(s => s.toLowerCase()).includes(skill.toLowerCase())) {
      toast.info("Skill already in watch list");
      return;
    }
    setWatchConfig(prev => ({
      ...prev,
      skills: [...(prev.skills || []), skill],
    }));
    setNewSkillInput("");
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setWatchConfig(prev => ({
      ...prev,
      skills: (prev.skills || []).filter(s => s !== skillToRemove),
    }));
  };

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    const loc = newLocationInput.trim();
    if (!loc) return;

    if (/^(remote|fully\s*remote|remote-first)$/i.test(loc)) {
      setWatchConfig((prev) => ({
        ...prev,
        workModes: (prev.workModes || []).includes("REMOTE")
          ? prev.workModes
          : [...(prev.workModes || []), "REMOTE"],
      }));
      setNewLocationInput("");
      toast.info("'Remote' applied to Work Mode Preference", {
        description: "Target Locations are reserved for physical cities/countries (e.g. Bengaluru, Hyderabad, India). Work mode set to REMOTE.",
      });
      return;
    }

    if ((watchConfig.locations || []).map(l => l.toLowerCase()).includes(loc.toLowerCase())) {
      toast.info("Location already in watch list");
      return;
    }
    setWatchConfig(prev => ({
      ...prev,
      locations: [...(prev.locations || []), loc],
    }));
    setNewLocationInput("");
  };

  const handleRemoveLocation = (locToRemove: string) => {
    setWatchConfig(prev => ({
      ...prev,
      locations: (prev.locations || []).filter(l => l !== locToRemove),
    }));
  };

  const handleSyncCareerMemory = async () => {
    try {
      setIsSyncingProfile(true);
      const [profileRes, memoryRes] = await Promise.all([
        fetch("/api/account/profile").catch(() => null),
        fetch("/api/user/memory").catch(() => null),
      ]);

      let prof: any = null;
      if (profileRes && profileRes.ok) {
        const pData = await profileRes.json().catch(() => ({}));
        prof = pData.profile || pData.personalization;
      }

      const memoryRoles: string[] = [];
      const memorySkills: string[] = [];
      const memoryLocations: string[] = [];
      const memoryWorkModes: string[] = [];
      const memoryCompanies: string[] = [];

      if (memoryRes && memoryRes.ok) {
        const mData = await memoryRes.json().catch(() => ({}));
        const prefs = (mData.preferences || []) as Array<{ category: string; key: string; value: string }>;
        for (const item of prefs) {
          const cat = (item.category || "").toUpperCase();
          const key = (item.key || "").toLowerCase();
          const val = item.value || "";

          let values: string[] = [];
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) values = parsed.map(String);
            else if (typeof parsed === "string") values = [parsed];
          } catch {
            values = val.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
          }

          if (cat === "ROLE_PREFERENCE" || cat === "CAREER_PREFERENCE" || key.includes("role")) {
            memoryRoles.push(...values);
          } else if (cat === "SKILL_INTEREST" || key.includes("skill")) {
            memorySkills.push(...values);
          } else if (cat === "LOCATION_PREFERENCE" || key.includes("location") || key.includes("city")) {
            memoryLocations.push(...values);
          } else if (cat === "WORK_MODE_PREFERENCE" || key.includes("work_mode") || key.includes("remote")) {
            memoryWorkModes.push(...values);
          } else if (cat === "INDUSTRY_INTEREST" || key.includes("company")) {
            memoryCompanies.push(...values);
          }
        }
      }

      let localMem: any = null;
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("browserai:career_memory") || localStorage.getItem("browserai:watch_draft");
          if (raw) localMem = JSON.parse(raw);
        } catch {}
      }

      const mergedRoles = Array.from(new Set([
        ...ensureArray(prof?.preferredRoles),
        ...ensureArray(prof?.targetRoles),
        ...ensureArray(prof?.roles),
        ...memoryRoles,
        ...ensureArray(localMem?.roles),
        ...ensureArray(localMem?.targetRoles),
        ...ensureArray(localMem?.preferredRoles),
      ])).filter(Boolean);

      const mergedSkills = Array.from(new Set([
        ...ensureArray(prof?.targetSkills),
        ...ensureArray(prof?.skills),
        ...ensureArray(prof?.preferredSkills),
        ...memorySkills,
        ...ensureArray(localMem?.skills),
        ...ensureArray(localMem?.targetSkills),
      ])).filter(Boolean);

      const rawMergedLocations = Array.from(new Set([
        ...ensureArray(prof?.preferredLocations),
        ...ensureArray(prof?.locations),
        ...ensureArray(prof?.targetLocations),
        ...memoryLocations,
        ...ensureArray(localMem?.locations),
        ...ensureArray(localMem?.preferredLocations),
      ])).filter(Boolean);

      const hasRemoteInMerged = rawMergedLocations.some((l) => /^(remote|fully\s*remote|remote-first)$/i.test(l.trim()));
      const mergedLocations = rawMergedLocations.filter((l) => !/^(remote|fully\s*remote|remote-first)$/i.test(l.trim()));

      const rawMergedWorkModes = Array.from(new Set([
        ...ensureArray(prof?.preferredWorkModes),
        ...ensureArray(prof?.workModes),
        ...memoryWorkModes,
        ...ensureArray(localMem?.workModes),
        ...ensureArray(localMem?.preferredWorkModes),
      ])).filter(Boolean);
      if (hasRemoteInMerged && !rawMergedWorkModes.includes("REMOTE")) {
        rawMergedWorkModes.push("REMOTE");
      }
      const mergedWorkModes = rawMergedWorkModes;

      const mergedCompanies = Array.from(new Set([
        ...ensureArray(prof?.targetCompanies),
        ...ensureArray(prof?.companies),
        ...ensureArray(prof?.preferredCompanies),
        ...ensureArray(watchConfig.companies),
        ...memoryCompanies,
        ...ensureArray(localMem?.companies),
        ...ensureArray(localMem?.targetCompanies),
      ])).filter(Boolean);

      if (mergedRoles.length === 0 && mergedSkills.length === 0 && mergedLocations.length === 0) {
        const fallbackConfig = {
          ...watchConfig,
          roles: watchConfig.roles && watchConfig.roles.length > 0 ? watchConfig.roles : ["Software Engineer", "Frontend Developer"],
          skills: watchConfig.skills && watchConfig.skills.length > 0 ? watchConfig.skills : ["React", "TypeScript", "Next.js"],
          locations: watchConfig.locations && watchConfig.locations.length > 0 ? watchConfig.locations.filter(l => !/^(remote|fully\s*remote)$/i.test(l)) : ["San Francisco, CA", "Bengaluru"],
          workModes: watchConfig.workModes && watchConfig.workModes.length > 0 ? watchConfig.workModes : ["REMOTE", "HYBRID"],
        };
        setWatchConfig(fallbackConfig);
        if (typeof window !== "undefined") {
          try { localStorage.setItem("browserai:watch_draft", JSON.stringify(fallbackConfig)); } catch {}
        }
        toast.info("Populated with starter career criteria. Customize and click Save Preferences.", {
          action: {
            label: "Open Settings",
            onClick: () => openProfileModal("CAREER_MEMORY"),
          },
        });
        return;
      }

      const updatedConfig: DiscoveryWatchState = {
        ...watchConfig,
        roles: mergedRoles.length > 0 ? mergedRoles : (watchConfig.roles?.length ? watchConfig.roles : ["Software Engineer", "Frontend Developer"]),
        skills: mergedSkills.length > 0 ? mergedSkills : (watchConfig.skills?.length ? watchConfig.skills : ["React", "TypeScript", "Next.js"]),
        locations: mergedLocations.length > 0 ? mergedLocations : (watchConfig.locations?.length ? watchConfig.locations.filter(l => !/^(remote|fully\s*remote)$/i.test(l)) : ["Bengaluru"]),
        workModes: mergedWorkModes.length > 0 ? (mergedWorkModes as any) : (watchConfig.workModes?.length ? watchConfig.workModes : ["REMOTE"]),
        companies: mergedCompanies.length > 0 ? mergedCompanies : watchConfig.companies,
      };

      setWatchConfig(updatedConfig);
      if (typeof window !== "undefined") {
        try { localStorage.setItem("browserai:watch_draft", JSON.stringify(updatedConfig)); } catch {}
      }

      toast.success("Synchronized with Career Memory! Criteria populated. Click Save & Search to scan for opportunities.", {
        action: {
          label: "Save & Search",
          onClick: () => {
            handleSaveAndScan();
          },
        },
      });
    } catch (err: unknown) {
      const msg = (err as Error).message || "Failed to sync from Career Memory";
      toast.error(msg);
    } finally {
      setIsSyncingProfile(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-8 pb-32 sm:pb-36 sm:px-6 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Eye className="h-4 w-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-sans font-bold tracking-tight text-foreground">
                Autonomous Watch
              </h1>
              {isLoading ? (
                <Badge variant="outline" className="font-mono text-xs text-muted-foreground animate-pulse rounded-full">
                  Checking status...
                </Badge>
              ) : (
                <Badge 
                  variant={watchConfig.enabled ? "default" : "outline"}
                  className={`font-mono text-xs rounded-full ${watchConfig.enabled ? "bg-primary/10 text-primary border-primary/30 font-semibold" : "text-muted-foreground"}`}
                >
                  {watchConfig.enabled ? "Active scan" : "Paused"}
                </Badge>
              )}
              <InfoBadge
                title="Autonomous Watch Radar"
                description="Background autonomous job discovery engine driven by cron workers and BullMQ queues."
                details={{
                  "Cadence": `Every ${watchConfig.scanIntervalHours} hours`,
                  "Active ATS Connectors": (watchConfig.preferredSources || []).join(", "),
                  "Match Threshold": `${watchConfig.minimumMatchScore}% minimum score`,
                  "Notification Dispatch": "In-app notifications + optional webhook delivery",
                  "Execution State": watchConfig.enabled ? "Active cron scheduling" : "Suspended",
                }}
                bullets={[
                  "Continuously crawls configured ATS platforms without manual user intervention",
                  "Filters new opportunities through the DeepSeek Harness location and anti-ghost gate",
                  "Deduplicates listings against the canonical opportunity repository",
                ]}
                side="bottom"
              />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground font-sans">
              <span className="hidden sm:inline">
                Configure background multi-source discovery. BrowserPilot scans continuously across registered ATS platforms and alerts you when new matching opportunities appear.
              </span>
              <span className="sm:hidden">
                Continuous discovery and alerts.
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerRun}
              disabled={isTriggeringRun || isSaving}
              className="h-9 font-sans font-medium text-xs gap-1.5 rounded-lg border-border cursor-pointer bg-card hover:bg-muted text-foreground shadow-2xs"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isTriggeringRun ? "animate-spin text-primary" : ""}`} />
              {isTriggeringRun ? "Scanning..." : "Scan Now"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveWatch}
              disabled={isSaving || isTriggeringRun}
              className="h-9 font-sans font-medium text-xs gap-1.5 rounded-lg border-border cursor-pointer bg-card hover:bg-muted text-foreground shadow-2xs"
            >
              {isSaving ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 stroke-[1.75]" />
                  <span>Save Watch</span>
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAndScan}
              disabled={isSaving || isTriggeringRun}
              className="h-9 font-sans font-semibold text-xs gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white cursor-pointer shadow-marble-1 disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isSaving || isTriggeringRun ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5 stroke-[2]" />
                  <span>Save & Search</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error Alert: Failed Watch Save */}
        {saveError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-sans text-destructive flex items-center justify-between gap-3 animate-in fade-in-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <span>{saveError}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveError(null)}
              className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Mobile Summary Hero (Prioritize immediate visibility of activity & telemetry above the fold) */}
        <div className="block lg:hidden rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Eye className="h-4 w-4 stroke-[1.75]" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-sans font-bold text-foreground block truncate">
                  {Array.isArray(watchConfig.roles) && watchConfig.roles.length > 0
                    ? watchConfig.roles.slice(0, 2).join(", ")
                    : "All Monitored Streams"}
                </span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 block truncate">
                  Every {watchConfig.scanIntervalHours}h • {(watchConfig.preferredSources || []).length} sources
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerRun}
                disabled={isTriggeringRun || isSaving}
                className="h-8 px-2 font-sans text-xs gap-1 border-border/80 cursor-pointer shrink-0"
              >
                <RotateCw className={`h-3 w-3 stroke-[1.75] ${isTriggeringRun ? "animate-spin text-emerald-600 dark:text-emerald-400" : ""}`} />
                <span>{isTriggeringRun ? "..." : "Scan"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveWatch}
                disabled={isSaving || isTriggeringRun}
                className="h-8 px-2 font-sans text-xs border-border/80 cursor-pointer shrink-0"
              >
                <span>{isSaving ? "Saving" : "Save"}</span>
              </Button>
              <Button
                size="sm"
                onClick={handleSaveAndScan}
                disabled={isSaving || isTriggeringRun}
                className="h-8 px-2.5 font-sans font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs disabled:opacity-75 disabled:cursor-not-allowed flex items-center gap-1 shrink-0"
              >
                <Search className="h-3 w-3 stroke-[2]" />
                <span>Save & Search</span>
              </Button>
            </div>
          </div>

          {/* Active criteria summary chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[11px] font-sans">
            <span className="px-2 py-0.5 rounded-full bg-muted text-foreground border border-border/70 shrink-0">
              {(watchConfig.roles || []).length} roles
            </span>
            <span className="px-2 py-0.5 rounded-full bg-muted text-foreground border border-border/70 shrink-0">
              {(watchConfig.companies || []).length} target companies
            </span>
            <span className="px-2 py-0.5 rounded-full bg-muted text-foreground border border-border/70 shrink-0">
              {(watchConfig.preferredSources || []).length} ATS sources
            </span>
          </div>

          {/* Toggle to expand full parameters on mobile */}
          <button
            type="button"
            onClick={() => setIsMobileSettingsOpen(!isMobileSettingsOpen)}
            className="w-full flex items-center justify-between pt-2 border-t border-border/50 text-xs font-sans text-foreground font-medium cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 stroke-[1.75]" />
              <span>{isMobileSettingsOpen ? "Hide watch settings" : "Configure schedule & sources"}</span>
            </span>
            {isMobileSettingsOpen ? (
              <ChevronUp className="h-3.5 w-3.5 stroke-[1.75]" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 stroke-[1.75]" />
            )}
          </button>
        </div>

        {/* Watch Configuration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Controls Panel (2 Cols) - Collapsed on mobile by default */}
          <div className={`${isMobileSettingsOpen ? "block" : "hidden"} lg:block lg:col-span-2 space-y-6`}>
            {/* Scan frequency & schedule Card */}
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-marble-1 hover:shadow-marble-2 transition-shadow">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 stroke-[2] text-primary" />
                  <h2 className="text-sm sm:text-base font-sans font-bold tracking-tight text-foreground">
                    Scan frequency and schedule
                  </h2>
                  <InfoBadge
                    title="Scheduled Worker Cadence"
                    description="BullMQ background worker interval controlling how frequently the scraper swarms run."
                    details={{
                      "Worker Engine": "BullMQ + Redis Task Runner",
                      "Default Interval": "4 Hours",
                      "Execution Limit": "1 concurrent worker per user",
                      "Throttling Buffer": "100ms jitter between domain requests",
                    }}
                    side="right"
                  />
                </div>
                <Button
                  variant={watchConfig.enabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setWatchConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`h-7 px-3 font-sans text-xs rounded-lg cursor-pointer transition-all ${
                    watchConfig.enabled ? "bg-primary hover:bg-primary/90 text-white shadow-marble-1" : "border-border text-muted-foreground"
                  }`}
                >
                  {watchConfig.enabled ? "Enabled" : "Paused"}
                </Button>
              </div>

              {/* Interval Selection */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2 font-sans font-medium">
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
                      variant={watchConfig.scanIntervalHours === int.hours ? "default" : "outline"}
                      size="sm"
                      onClick={() => setWatchConfig(prev => ({ ...prev, scanIntervalHours: int.hours }))}
                      className={`h-9 font-sans text-xs rounded-lg cursor-pointer transition-all ${
                        watchConfig.scanIntervalHours === int.hours
                          ? "border-primary bg-primary text-primary-foreground font-semibold shadow-marble-1"
                          : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {int.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Freshness Window Filter */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="text-xs font-semibold text-muted-foreground font-sans font-medium">
                    Freshness Window (Hard Boundary)
                  </label>
                  <div className="group relative inline-flex items-center">
                    <Info className="h-3.5 w-3.5 text-muted-foreground/70 hover:text-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 w-56 p-2 text-[11px] font-sans rounded-lg bg-card text-foreground border border-border shadow-marble-2 pointer-events-none">
                      Strict cutoff boundary: only opportunities posted within this window are evaluated for relevance scoring.
                    </div>
                  </div>
                </div>
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
                      variant={watchConfig.freshnessWindowHours === f.hours ? "default" : "outline"}
                      size="sm"
                      onClick={() => setWatchConfig(prev => ({ ...prev, freshnessWindowHours: f.hours }))}
                      className={`h-9 font-sans text-xs rounded-lg cursor-pointer transition-all ${
                        watchConfig.freshnessWindowHours === f.hours
                          ? "border-primary bg-primary text-primary-foreground font-semibold shadow-marble-1"
                          : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
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
                  <label className="text-xs font-semibold text-muted-foreground font-sans font-medium">
                    Minimum Relevance Fit Score
                  </label>
                  <span className="font-mono text-xs font-bold text-primary">
                    {watchConfig.minimumMatchScore}% match threshold
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[60, 70, 75, 80, 85, 90].slice(0, 4).map((score) => (
                    <Button
                      key={score}
                      type="button"
                      variant={watchConfig.minimumMatchScore === score ? "default" : "outline"}
                      size="sm"
                      onClick={() => setWatchConfig(prev => ({ ...prev, minimumMatchScore: score }))}
                      className={`h-8 font-sans text-xs rounded-lg cursor-pointer transition-all ${
                        watchConfig.minimumMatchScore === score
                          ? "border-primary bg-primary text-primary-foreground font-semibold shadow-marble-1"
                          : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {score}%+ fit
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* GLOBAL MONITORED PLUGINS & SOURCES CARD */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6 space-y-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Puzzle className="h-4 w-4 stroke-[1.75]" />
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-sans font-bold tracking-tight text-foreground flex items-center gap-2">
                      <span>Monitored Plugins & Sources</span>
                      <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30 py-0 px-1.5">
                        High Priority Engine
                      </Badge>
                    </h2>
                    <p className="text-[11px] text-muted-foreground font-sans">
                      Active plugins harvest primary results with high data collection priority (~75%+ yield), supplemented by free open sources.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <Link
                    href="/app/plugins"
                    className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-sans font-medium rounded-lg border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Blocks className="h-3 w-3 stroke-[1.75]" />
                    <span>Plugins Marketplace</span>
                    <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                  </Link>
                </div>
              </div>

              {/* Active Connected Plugins (Priority Yield) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-sans text-muted-foreground">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Active Connected Plugins & Monitored Feeds
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    {(watchConfig.preferredSources || []).length} active
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(watchConfig.preferredSources || []).length > 0 ? (
                    (watchConfig.preferredSources || []).map((source) => {
                      const matchedPlugin = plugins.find(
                        (p) =>
                          p.name.toLowerCase() === source.toLowerCase() ||
                          p.id.toLowerCase() === source.toLowerCase() ||
                          (p.id === "ycombinator" && (source.toLowerCase().includes("y combinator") || source.toLowerCase().includes("yc")))
                      );

                      return (
                        <div
                          key={source}
                          className="inline-flex items-center gap-2 bg-emerald-600/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-xs py-1 px-2.5 rounded-xl font-sans font-medium shadow-2xs transition-all"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                          <span>{source}</span>
                          <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                            {matchedPlugin ? "Plugin • High Priority" : "Active Feed"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (matchedPlugin) {
                                handleToggleWatchPlugin(matchedPlugin);
                              } else {
                                setWatchConfig((prev) => ({
                                  ...prev,
                                  preferredSources: (prev.preferredSources || []).filter((s) => s !== source),
                                }));
                              }
                            }}
                            className="hover:text-rose-500 cursor-pointer ml-0.5 p-0.5"
                            title={`Disconnect ${source}`}
                          >
                            <X className="h-3 w-3 stroke-[1.75]" />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-xs text-muted-foreground italic font-sans">
                      No plugins currently active. Connect plugins below to start high-priority autonomous scanning.
                    </span>
                  )}
                </div>
              </div>

              {/* Available 1-Click Plugins to Connect */}
              <div className="pt-2 border-t border-border/40 space-y-2">
                <div className="flex items-center justify-between text-xs font-sans text-muted-foreground">
                  <span className="font-medium text-muted-foreground">
                    Available Plugins (1-Click Connect & Sign-In)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Click to add to monitored sources
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {MARKETPLACE_PLUGINS.filter(
                    (p) =>
                      !(watchConfig.preferredSources || []).some(
                        (s) =>
                          s.toLowerCase() === p.name.toLowerCase() ||
                          s.toLowerCase() === p.id.toLowerCase() ||
                          (p.id === "ycombinator" && (s.toLowerCase().includes("y combinator") || s.toLowerCase().includes("yc")))
                      )
                  ).slice(0, 6).map((plugin) => {
                    const isConnecting = togglingPluginId === plugin.id;
                    return (
                      <div
                        key={plugin.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate">{plugin.displayName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{plugin.category.replace("_", " ")} • {plugin.type === "DIRECT_FREE" ? "Instant Connect" : "Requires Auth"}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isConnecting}
                          onClick={() => {
                            const statusItem = plugins.find((p) => p.id === plugin.id) || {
                              ...plugin,
                              isConnected: false,
                              status: "DISCONNECTED",
                            };
                            handleToggleWatchPlugin(statusItem as UserPluginStatus);
                          }}
                          className="h-7 px-2 text-[11px] font-sans font-medium gap-1 border-border/70 hover:bg-emerald-500/10 hover:text-emerald-600 cursor-pointer shrink-0"
                        >
                          {isConnecting ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Plus className="h-3 w-3 stroke-[2]" />
                          )}
                          <span>{plugin.type === "DIRECT_FREE" ? "Connect" : "Sign in"}</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Supplemental Free Sources & Priority Distribution */}
              <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted-foreground font-sans">
                <p>
                  <strong className="text-foreground">Harvesting Distribution:</strong> Connected plugins provide ~75%+ of incoming listings with verified company contacts. General web crawlers provide supplemental reach.
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Plugins: High Priority</span>
                  <span className="h-2 w-2 rounded-full bg-slate-400 ml-2" />
                  <span>Web Sources: Supplemental</span>
                </div>
              </div>
            </div>

            {/* Target companies Card */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 stroke-[1.75] text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-sm sm:text-base font-sans font-bold tracking-tight text-foreground">
                    Target companies
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {(watchConfig.companies || []).length} monitored
                </span>
              </div>

              <form onSubmit={handleAddCompany} className="flex gap-2">
                <Input
                  placeholder="e.g. Stripe, NVIDIA, Adobe, Perplexity..."
                  value={newCompanyInput}
                  onChange={(e) => setNewCompanyInput(e.target.value)}
                  className="font-sans text-xs bg-background border-border/80 text-foreground"
                />
                <Button type="submit" size="sm" variant="secondary" className="font-sans text-xs gap-1 cursor-pointer bg-muted hover:bg-muted/80 text-foreground border border-border/70">
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </form>

              {(watchConfig.companies || []).length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {(watchConfig.companies || []).map((comp) => (
                    <Badge
                      key={comp}
                      variant="secondary"
                      className="font-sans text-xs py-1 px-2.5 gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    >
                      <span>{comp}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCompany(comp)}
                        className="hover:text-rose-500 cursor-pointer ml-1"
                        aria-label={`Remove ${comp}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-sans italic">
                  No specific company filter. Scanning across all available companies on monitored connectors.
                </p>
              )}
            </div>

            {/* Target Criteria (Roles, Skills, Work Mode) */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 stroke-[1.75] text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-sm sm:text-base font-sans font-bold tracking-tight text-foreground">
                    Target roles, skills, locations, and work mode
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSyncCareerMemory}
                  disabled={isSyncingProfile}
                  className="text-xs h-7 gap-1.5 font-sans border-border/70 hover:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 cursor-pointer self-start sm:self-auto"
                >
                  <Sparkles className={`h-3.5 w-3.5 stroke-[1.75] ${isSyncingProfile ? "animate-spin text-emerald-600" : "text-amber-600"}`} />
                  {isSyncingProfile ? "Syncing..." : "Sync from Career Memory"}
                </Button>
              </div>

              {/* Roles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground block font-sans font-medium">
                    Roles Monitored
                  </label>
                  <span className="text-xs text-muted-foreground font-mono">
                    {(watchConfig.roles || []).length} roles
                  </span>
                </div>

                <form onSubmit={handleAddRole} className="flex gap-2">
                  <Input
                    placeholder="e.g. Software Engineer, Frontend Developer, Platform Engineer..."
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    className="font-sans text-xs bg-background border-border/80 text-foreground"
                  />
                  <Button type="submit" size="sm" variant="secondary" className="font-sans text-xs gap-1 cursor-pointer bg-muted hover:bg-muted/80 text-foreground border border-border/70">
                    <Plus className="h-3.5 w-3.5 stroke-[1.75]" />
                    Add
                  </Button>
                </form>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(watchConfig.roles || []).map((r) => (
                    <Badge
                      key={r}
                      variant="outline"
                      className="font-sans text-xs bg-muted/60 py-1 px-2.5 gap-1.5 border-border/70 text-foreground"
                    >
                      <span>{r}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRole(r)}
                        className="hover:text-rose-500 cursor-pointer ml-1"
                        aria-label={`Remove role ${r}`}
                      >
                        <X className="h-3 w-3 stroke-[1.75]" />
                      </button>
                    </Badge>
                  ))}
                  {(watchConfig.roles || []).length === 0 && (
                    <p className="text-xs text-muted-foreground font-sans italic">
                      No roles monitored yet. Add roles above to track opportunities.
                    </p>
                  )}
                </div>
              </div>

              {/* Skills */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground block font-sans font-medium">
                    Key Skills
                  </label>
                  <span className="text-xs text-muted-foreground font-mono">
                    {(watchConfig.skills || []).length} skills
                  </span>
                </div>

                <form onSubmit={handleAddSkill} className="flex gap-2">
                  <Input
                    placeholder="e.g. React, TypeScript, Next.js, Node.js, Python..."
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    className="font-sans text-xs bg-background border-border/80 text-foreground"
                  />
                  <Button type="submit" size="sm" variant="secondary" className="font-sans text-xs gap-1 cursor-pointer bg-muted hover:bg-muted/80 text-foreground border border-border/70">
                    <Plus className="h-3.5 w-3.5 stroke-[1.75]" />
                    Add
                  </Button>
                </form>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(watchConfig.skills || []).map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="font-sans text-xs bg-muted/60 py-1 px-2.5 gap-1.5 border-border/70 text-foreground"
                    >
                      <span>{s}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(s)}
                        className="hover:text-rose-500 cursor-pointer ml-1"
                        aria-label={`Remove skill ${s}`}
                      >
                        <X className="h-3 w-3 stroke-[1.75]" />
                      </button>
                    </Badge>
                  ))}
                  {(watchConfig.skills || []).length === 0 && (
                    <p className="text-xs text-muted-foreground font-sans italic">
                      No specific skills filtered. Add keywords or tools above.
                    </p>
                  )}
                </div>
              </div>

              {/* Target Locations */}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <label className="text-xs font-semibold text-muted-foreground block font-sans font-medium">
                      Target Locations Monitored
                    </label>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {(watchConfig.locations || []).length} locations
                  </span>
                </div>

                <form onSubmit={handleAddLocation} className="flex gap-2">
                  <Input
                    placeholder="e.g. Hyderabad, Bengaluru, San Francisco, India..."
                    value={newLocationInput}
                    onChange={(e) => setNewLocationInput(e.target.value)}
                    className="font-sans text-xs bg-background border-border/80 text-foreground"
                  />
                  <Button type="submit" size="sm" variant="secondary" className="font-sans text-xs gap-1 cursor-pointer bg-muted hover:bg-muted/80 text-foreground border border-border/70">
                    <Plus className="h-3.5 w-3.5 stroke-[1.75]" />
                    Add
                  </Button>
                </form>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(watchConfig.locations || []).map((loc) => (
                    <Badge
                      key={loc}
                      variant="outline"
                      className="font-sans text-xs bg-muted/60 py-1 px-2.5 gap-1.5 border-border/70 text-foreground"
                    >
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span>{loc}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLocation(loc)}
                        className="hover:text-rose-500 cursor-pointer ml-1"
                        aria-label={`Remove location ${loc}`}
                      >
                        <X className="h-3 w-3 stroke-[1.75]" />
                      </button>
                    </Badge>
                  ))}
                  {(watchConfig.locations || []).length === 0 && (
                    <p className="text-xs text-muted-foreground font-sans italic">
                      No specific geographic locations filtered (Global scope). Add physical cities or countries above to restrict search. Work modes like Remote are set below.
                    </p>
                  )}
                </div>
              </div>

              {/* Work Mode & Opp Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5 font-sans font-medium">
                    Work Mode Preference
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["REMOTE", "HYBRID", "ON_SITE"].map((mode) => {
                      const isSelected = (watchConfig.workModes || []).includes(mode);
                      return (
                        <Button
                          key={mode}
                          type="button"
                          variant={isSelected ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => {
                            setWatchConfig(prev => ({
                              ...prev,
                              workModes: (prev.workModes || []).includes(mode)
                                ? (prev.workModes || []).filter(m => m !== mode)
                                : [...(prev.workModes || []), mode],
                            }));
                          }}
                          className={`h-7 px-2.5 font-sans text-xs cursor-pointer ${
                            isSelected
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {humanizeWorkMode(mode)}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5 font-sans font-medium">
                    Opportunity Type
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["INTERNSHIP", "FULL_TIME"].map((oppType) => {
                      const isSelected = (watchConfig.opportunityTypes || []).includes(oppType);
                      return (
                        <Button
                          key={oppType}
                          type="button"
                          variant={isSelected ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => {
                            setWatchConfig(prev => ({
                              ...prev,
                              opportunityTypes: (prev.opportunityTypes || []).includes(oppType)
                                ? (prev.opportunityTypes || []).filter(t => t !== oppType)
                                : [...(prev.opportunityTypes || []), oppType],
                            }));
                          }}
                          className={`h-7 px-2.5 font-sans text-xs cursor-pointer ${
                            isSelected
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {humanizeOpportunityType(oppType)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Schedule Info & Recent Novel Opportunities */}
          <div className="space-y-6">
            {/* Status Summary Widget - Flat/Quiet Elevation */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 shadow-none">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-sans font-bold text-foreground">
                  Monitoring telemetry
                </h3>
                <InfoBadge
                  title="Telemetry & Diagnostics"
                  description="Real-time execution stats for autonomous background workers."
                  details={{
                    "Engine Status": watchConfig.enabled ? "RUNNING" : "PAUSED",
                    "Scan Interval": `${watchConfig.scanIntervalHours}h`,
                    "Freshness Window": `${watchConfig.freshnessWindowHours}h`,
                    "Active Roles": (watchConfig.roles || []).length,
                    "Target Companies": (watchConfig.companies || []).length,
                  }}
                  bullets={[
                    "Discovered opportunities trigger deduplicated push notifications",
                    "Runs automatically in isolated worker containers",
                  ]}
                  side="left"
                />
              </div>

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
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] font-mono transition-colors border border-border/70 cursor-pointer shadow-2xs"
                >
                  <span className="flex items-center gap-1.5">
                    <CommandIcon className="h-3.5 w-3.5 stroke-[1.75]" />
                    <span>Command Palette</span>
                  </span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted/70 border border-border text-[10px]">⌘K</kbd>
                </button>
              </div>
            </div>

            {/* Recent Discovery Activity */}
            <div className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <h3 className="text-xs sm:text-sm font-sans font-bold text-foreground">
                  Recent novel opportunities
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
                      <div
                        key={ev.id}
                        onClick={() => setSelectedJob(mapEventToDossierJob(ev))}
                        className="p-3.5 rounded-xl bg-muted/40 border border-border/70 space-y-2 relative shadow-2xs hover:border-emerald-500/50 hover:bg-muted/70 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="font-sans text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                              {humanizeClassification(ev.classification)}
                            </Badge>
                            {ev.matchScore && (
                              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                {Math.round(ev.matchScore)}% fit
                              </span>
                            )}
                          </div>
                          {verificationBadge}
                        </div>

                        <div>
                          <h4 className="text-xs font-sans font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                            {ev.opportunity?.title}
                          </h4>
                          <p className="text-[11px] font-mono text-muted-foreground">
                            {ev.opportunity?.companyName} {ev.opportunity?.location ? `• ${ev.opportunity.location}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-[10px] font-mono">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            {connectorMeta.displayName}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground group-hover:text-foreground font-sans font-medium text-[11px] flex items-center gap-0.5 transition-colors">
                              View full dossier &rarr;
                            </span>
                            {ev.opportunity?.primaryApplyUrl && (
                              <a
                                href={ev.opportunity.primaryApplyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                              >
                                Apply <ArrowUpRight className="h-3 w-3 stroke-[1.75]" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 px-3 space-y-2 bg-muted/30 rounded-xl border border-dashed border-border/80">
                  <ShieldCheck className="h-6 w-6 stroke-[1.75] text-emerald-600 dark:text-emerald-400/60 mx-auto" />
                  <p className="text-xs font-semibold text-foreground font-sans">
                    No new opportunities detected yet
                  </p>
                  <p className="text-[11px] text-muted-foreground font-sans max-w-xs mx-auto leading-relaxed">
                    The background engine is active and will crawl across your {watchConfig.preferredSources.length} selected sources every {watchConfig.scanIntervalHours}h. New verified matches will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Slide-Over Job Dossier Panel */}
        <JobDetailSlideOver
          job={selectedJob}
          isOpen={Boolean(selectedJob)}
          onClose={() => setSelectedJob(null)}
          isSaved={selectedJob ? (savedStates[selectedJob.id!] ?? selectedJob.saved ?? false) : false}
          isSaving={selectedJob ? (savingJobIds[selectedJob.id!] || false) : false}
          onToggleSave={() => selectedJob && handleToggleSaveJob(selectedJob.id!, savedStates[selectedJob.id!] ?? selectedJob.saved ?? false)}
          onOpenPersonnelDrawer={() => selectedJob && setPersonnelDrawerJob(selectedJob)}
        />

        {/* Direct Personnel & Recruiter Outreach Drawer */}
        <PersonnelConnectDrawer
          isOpen={Boolean(personnelDrawerJob)}
          onClose={() => setPersonnelDrawerJob(null)}
          companyName={personnelDrawerJob?.companyName || "Company"}
          jobTitle={personnelDrawerJob?.title || "Role"}
          location={personnelDrawerJob?.location}
          contacts={personnelDrawerJob?.companyContacts}
        />
      </main>
    </div>
  );
}
