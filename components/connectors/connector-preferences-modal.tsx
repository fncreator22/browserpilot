"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plug,
  Check,
  RotateCw,
  AlertCircle,
  X,
  ExternalLink,
  ShieldCheck,
  Lock,
  Layers,
  Sparkles,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { type UserPluginStatus } from "@/lib/plugins/pluginTypes";
import { CompanyAvatar } from "@/components/ui/company-avatar";

export interface ConnectorDef {
  id: string;
  name: string;
  displayName: string | null;
  type: string;
  requiresAuth: boolean;
  iconUrl: string | null;
  baseUrl: string;
}

export interface ConnectorPreferencesPanelProps {
  onPreferencesSaved?: (sources: string[]) => void;
  onCancel?: () => void;
  showActions?: boolean;
}

export function ConnectorPreferencesPanel({
  onPreferencesSaved,
  onCancel,
  showActions = true,
}: ConnectorPreferencesPanelProps) {
  const [plugins, setPlugins] = useState<UserPluginStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  const loadData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/plugins");
      if (!res.ok) throw new Error("Failed to load plugins");
      const data = await res.json();
      setPlugins(data.plugins || []);
    } catch (err: unknown) {
      toast.error("Plugin Notice", {
        description: (err as Error).message || "Unable to retrieve plugins. Please retry shortly.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Listen for popup auth messages
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "PLUGIN_CONNECTED") {
        toast.success("Plugin Connected", {
          description: "Session authorization granted.",
        });
        loadData();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleTogglePlugin = async (plugin: UserPluginStatus) => {
    if (plugin.isPrototype) {
      toast.info(`${plugin.displayName} (Prototype)`, {
        description: "This integration is currently in active prototype testing and will be enabled soon.",
      });
      return;
    }

    if (!plugin.isConnected && plugin.type === "AUTH_REQUIRED") {
      // Trigger authentic OAuth popup
      const popup = window.open(
        `/api/auth/plugins/${plugin.id}/login`,
        `auth_popup_${plugin.id}`,
        "width=550,height=650,menubar=no,toolbar=no,location=no,status=no"
      );
      if (!popup) {
        toast.error("Popup Blocked", {
          description: "Please allow popups for BrowserPilot to connect your account.",
        });
      }
      return;
    }

    // Direct toggle (or disconnect)
    setConnectingId(plugin.id);
    const newAction = plugin.isConnected ? "DISCONNECT" : "CONNECT";

    try {
      const res = await fetch(`/api/plugins/${plugin.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: newAction }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(newAction === "CONNECT" ? `Connected to ${plugin.displayName}` : `Disconnected from ${plugin.displayName}`, {
          description: data.message,
        });
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
        const connectedNames = plugins
          .filter((p) => (p.id === plugin.id ? newAction === "CONNECT" : p.isConnected))
          .map((p) => p.name);
        onPreferencesSaved?.(connectedNames);
      } else {
        toast.error("Action Failed", {
          description: data.message || "Could not update plugin status.",
        });
      }
    } catch {
      toast.error("Network Error", { description: "Failed to communicate with plugin manager." });
    } finally {
      setConnectingId(null);
    }
  };

  const connectedCount = plugins.filter((p) => p.isConnected).length;

  const filteredPlugins = plugins.filter((p) => {
    const matchesCat = activeCategory === "ALL" || p.category === activeCategory;
    const matchesSearch =
      (p.displayName || p.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-4 font-sans">
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">
          <RotateCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-xs font-mono">Loading active plugins...</p>
        </div>
      ) : plugins.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl p-6">
          <AlertCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
          <p className="text-xs font-mono">No active plugins available at this time.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Marketplace Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "ALL", label: "All" },
                { id: "ATS_BOARD", label: "ATS Boards" },
                { id: "TECH_COMMUNITY", label: "Tech Communities" },
                { id: "PROFESSIONAL_NETWORK", label: "Social & Professional" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    activeCategory === cat.id
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground border-border/70 hover:border-border"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter plugins..."
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1 font-mono">
            <span>
              Connected: <strong className="text-foreground">{connectedCount}</strong> of {plugins.length} plugins & feeds
            </span>
            <span className="text-[11px] text-muted-foreground/80">
              Only authenticated & direct plugins harvest jobs
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredPlugins.map((plugin) => {
              const isSelected = plugin.isConnected;
              const isWorking = connectingId === plugin.id;

              return (
                <div
                  key={plugin.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-card border-border/80 shadow-xs"
                      : "bg-muted/10 border-border/40 opacity-80"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CompanyAvatar
                      companyName={plugin.displayName || plugin.name}
                      logoUrl={plugin.iconUrl || undefined}
                      size="md"
                      className="shrink-0 ring-1 ring-border/60"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground truncate block">
                          {plugin.displayName || plugin.name}
                        </span>
                        {plugin.isPrototype && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Prototype
                          </span>
                        )}
                        {!plugin.isPrototype && plugin.type === "DIRECT_FREE" && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Direct ATS
                          </span>
                        )}
                        {!plugin.isPrototype && plugin.type === "AUTH_REQUIRED" && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                            OAuth Session
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground block truncate max-w-sm">
                        {plugin.description}
                      </span>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isSelected ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="h-3 w-3 stroke-[2.5]" />
                          Connected
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isWorking}
                          onClick={() => handleTogglePlugin(plugin)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                          title="Disconnect plugin"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isWorking}
                        onClick={() => handleTogglePlugin(plugin)}
                        className={`h-7 text-xs font-mono gap-1 cursor-pointer ${
                          plugin.isPrototype
                            ? "opacity-60 hover:opacity-100"
                            : "hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                        }`}
                      >
                        {isWorking ? (
                          <RotateCw className="h-3 w-3 animate-spin" />
                        ) : plugin.isPrototype ? (
                          "Preview"
                        ) : plugin.type === "AUTH_REQUIRED" ? (
                          <>
                            Connect
                            <ExternalLink className="h-2.5 w-2.5" />
                          </>
                        ) : (
                          "Enable"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showActions && (
        <div className="pt-3 border-t border-border/60 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono">
            Connected plugins harvest opportunities across Discover & Radar.
          </span>
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} className="text-xs font-mono">
              Close
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export interface ConnectorPreferencesModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  onPreferencesSaved?: (sources: string[]) => void;
}

export function ConnectorPreferencesModal({
  isOpen,
  open,
  onClose,
  onOpenChange,
  onPreferencesSaved,
}: ConnectorPreferencesModalProps) {
  const isModalOpen = Boolean(open ?? isOpen);
  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-marble-3">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Manage Plugins & Feeds</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="pt-4">
          <ConnectorPreferencesPanel
            onCancel={handleClose}
            onPreferencesSaved={onPreferencesSaved}
            showActions={true}
          />
        </div>
      </div>
    </div>
  );
}
