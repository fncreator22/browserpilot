"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Puzzle, 
  CheckCircle2, 
  ExternalLink, 
  Lock, 
  RotateCw, 
  Sparkles, 
  ShieldCheck, 
  Globe, 
  Layers, 
  Briefcase, 
  Search,
  Check,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MARKETPLACE_PLUGINS, type MarketplacePlugin, type UserPluginStatus } from "@/lib/plugins/pluginTypes";

export default function PluginsMarketplacePage() {
  const [plugins, setPlugins] = useState<UserPluginStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPlugins = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/plugins");
      if (res.ok) {
        const data = await res.json();
        setPlugins(data.plugins || []);
      } else {
        // Fallback to local definitions with disconnected default
        setPlugins(MARKETPLACE_PLUGINS.map(p => ({
          ...p,
          isConnected: p.id === "greenhouse" || p.id === "lever",
          status: (p.id === "greenhouse" || p.id === "lever") ? "CONNECTED" : (p.type === "DIRECT_FREE" ? "DISCONNECTED" : "REQUIRES_AUTH"),
          connectedAt: (p.id === "greenhouse" || p.id === "lever") ? new Date().toISOString() : null,
        })));
      }
    } catch {
      setPlugins(MARKETPLACE_PLUGINS.map(p => ({
        ...p,
        isConnected: p.id === "greenhouse",
        status: p.id === "greenhouse" ? "CONNECTED" : "DISCONNECTED",
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const handleTogglePlugin = async (plugin: UserPluginStatus) => {
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
                  connectedAt: newAction === "CONNECT" ? new Date().toISOString() : null,
                }
              : p
          )
        );
      } else {
        toast.error("Plugin Action Failed", {
          description: data.message || "Could not update plugin status.",
        });
      }
    } catch {
      toast.error("Network Error", { description: "Failed to communicate with plugin manager." });
    } finally {
      setConnectingId(null);
    }
  };

  const filteredPlugins = plugins.filter((p) => {
    const matchesCat = activeCategory === "ALL" || p.category === activeCategory;
    const matchesSearch = p.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const connectedCount = plugins.filter((p) => p.isConnected).length;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted border border-border text-foreground">
                <Puzzle className="h-4 w-4" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Plugins Marketplace
              </h1>
              <Badge variant="outline" className="text-xs font-medium border-border/80 text-foreground bg-muted/50">
                {connectedCount} Connected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Connect external ATS platforms, recruiter networks, and developer communities.
            </p>
          </div>

          {/* Quick Search */}
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plugins..."
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-border bg-card text-xs font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
              />
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
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
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                activeCategory === cat.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/70 bg-muted/40 text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Plugins Grid: Compact 1/4 size cards (Notion / Claude style) */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground font-sans text-xs">
            <RotateCw className="h-5 w-5 animate-spin text-foreground" />
            Loading plugins catalog...
          </div>
        ) : filteredPlugins.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            No plugins match your filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredPlugins.map((plugin) => {
              const isProcessingThis = connectingId === plugin.id;

              return (
                <div
                  key={plugin.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                    plugin.isConnected
                      ? "bg-card border-foreground/30 shadow-2xs"
                      : "bg-card/50 border-border/70 hover:border-border hover:bg-card"
                  }`}
                >
                  <div className="space-y-1.5">
                    {/* Header: Icon, Name, Connection Dot */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-foreground shrink-0 border border-border/60">
                          <Puzzle className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-xs font-semibold text-foreground truncate">
                            {plugin.displayName}
                          </h3>
                        </div>
                      </div>
                      {plugin.isConnected && (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Connected" />
                      )}
                    </div>
                    {/* 1-Line Description */}
                    <p className="text-[11px] text-muted-foreground line-clamp-1 leading-snug">
                      {plugin.description}
                    </p>
                  </div>

                  {/* Card Bottom: Category Label + Connect/Disconnect Action */}
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono truncate">
                      {plugin.category.replace(/_/g, " ")}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={plugin.isConnected ? "outline" : "default"}
                      onClick={() => handleTogglePlugin(plugin)}
                      disabled={isProcessingThis}
                      className={`h-7 px-2.5 text-[11px] rounded-lg font-medium transition-colors cursor-pointer ${
                        plugin.isConnected
                          ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {isProcessingThis ? (
                        <RotateCw className="h-3 w-3 animate-spin" />
                      ) : plugin.isConnected ? (
                        "Disconnect"
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
