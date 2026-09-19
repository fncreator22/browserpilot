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
  AlertCircle,
  Zap,
  Cpu,
  Key
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MARKETPLACE_PLUGINS, type MarketplacePlugin, type UserPluginStatus } from "@/lib/plugins/pluginTypes";

export default function PluginsMarketplacePage() {
  const [plugins, setPlugins] = useState<UserPluginStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // AI Reasoning Connectors State (Puter, Gemini BYOK, DeepSeek BYOK)
  const [puterConnected, setPuterConnected] = useState(false);
  const [isConnectingPuter, setIsConnectingPuter] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [deepseekKeyInput, setDeepseekKeyInput] = useState("");
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [hasDeepseekKey, setHasDeepseekKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const pToken = localStorage.getItem("puter.auth.token.v2") || (window as any).puter?.authToken;
      setPuterConnected(Boolean(pToken));
      const gKey = localStorage.getItem("browserpilot_gemini_key");
      if (gKey) {
        setHasGeminiKey(true);
        setGeminiKeyInput(gKey);
      }
      const dKey = localStorage.getItem("browserpilot_deepseek_key");
      if (dKey) {
        setHasDeepseekKey(true);
        setDeepseekKeyInput(dKey);
      }
    }
  }, []);

  const handleConnectPuter = async () => {
    setIsConnectingPuter(true);
    try {
      let puter = (window as any).puter;
      if (!puter?.auth) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://js.puter.com/v2/";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Puter SDK"));
          document.head.appendChild(s);
        }).catch(() => null);
        puter = (window as any).puter;
      }

      if (puter?.auth) {
        const authRes = await puter.auth.signIn();
        const token = puter.authToken || (authRes && typeof authRes === "object" ? (authRes as any).token : null) || localStorage.getItem("puter.auth.token.v2");
        if (token) {
          localStorage.setItem("puter.auth.token.v2", token);
          await fetch("/api/account/providers/puter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, username: "Puter User" }),
          }).catch(() => {});
          setPuterConnected(true);
          toast.success("Puter Connected", { description: "Free 1-click Puter AI reasoning connected successfully." });
          window.dispatchEvent(new CustomEvent("browserai:provider-updated", { detail: { provider: "PUTER" } }));
          return;
        }
      }
      toast.info("Puter Connection", { description: "You can also add a Gemini or DeepSeek API key directly." });
    } catch (err: any) {
      toast.error("Puter Connection Failed", { description: err?.message || "Could not connect to Puter." });
    } finally {
      setIsConnectingPuter(false);
    }
  };

  const handleDisconnectPuter = () => {
    localStorage.removeItem("puter.auth.token.v2");
    setPuterConnected(false);
    toast.success("Puter Disconnected");
    window.dispatchEvent(new CustomEvent("browserai:provider-updated", { detail: { provider: "PUTER", disconnected: true } }));
  };

  const handleSaveBYOKKey = async (provider: "gemini" | "deepseek", key: string) => {
    const trimmed = key.trim();
    if (!trimmed) {
      toast.error("Please enter a valid API key");
      return;
    }
    setIsSavingKey(true);
    try {
      const storageKey = provider === "gemini" ? "browserpilot_gemini_key" : "browserpilot_deepseek_key";
      localStorage.setItem(storageKey, trimmed);
      await fetch("/api/account/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider === "gemini" ? "GEMINI_BYOK" : "DEEPSEEK_BYOK",
          apiKey: trimmed,
        }),
      }).catch(() => {});
      if (provider === "gemini") setHasGeminiKey(true);
      if (provider === "deepseek") setHasDeepseekKey(true);
      toast.success(`${provider === "gemini" ? "Google Gemini" : "DeepSeek"} Key Saved`, {
        description: "API key stored securely for live autonomous searches.",
      });
      window.dispatchEvent(new CustomEvent("browserai:provider-updated", { detail: { provider, key: trimmed } }));
    } catch {
      toast.error("Failed to save key. Please retry.");
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleRemoveBYOKKey = (provider: "gemini" | "deepseek") => {
    const storageKey = provider === "gemini" ? "browserpilot_gemini_key" : "browserpilot_deepseek_key";
    localStorage.removeItem(storageKey);
    if (provider === "gemini") {
      setHasGeminiKey(false);
      setGeminiKeyInput("");
    }
    if (provider === "deepseek") {
      setHasDeepseekKey(false);
      setDeepseekKeyInput("");
    }
    toast.info(`${provider === "gemini" ? "Google Gemini" : "DeepSeek"} Key Removed`);
    window.dispatchEvent(new CustomEvent("browserai:provider-updated", { detail: { provider, removed: true } }));
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border/70">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted border border-border text-foreground">
              <Puzzle className="h-4 w-4" />
            </span>
            <Badge variant="outline" className="text-xs font-medium border-border/80 text-foreground bg-muted/50 font-mono">
              {connectedCount} Connected
            </Badge>
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

        {/* AI Reasoning Connectors Cluster */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  AI Reasoning Providers & API Keys
                </h2>
                <p className="text-xs text-muted-foreground">
                  Connect Puter (1-click free) or enter your Gemini / DeepSeek API keys to execute verified autonomous searches.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Puter 1-Click */}
            <div className="p-3.5 rounded-xl border border-border bg-background/60 flex flex-col justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25">
                      <Zap className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-bold text-foreground">Puter.com</span>
                  </div>
                  {puterConnected ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 font-bold">
                      CONNECTED
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
                      1-CLICK FREE
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Serverless client AI reasoning without personal API keys.
                </p>
              </div>
              <div className="pt-2 border-t border-border/40 flex justify-end">
                {puterConnected ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDisconnectPuter}
                    className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 cursor-pointer"
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConnectPuter}
                    disabled={isConnectingPuter}
                    className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer"
                  >
                    {isConnectingPuter ? <RotateCw className="h-3 w-3 animate-spin" /> : "Connect Puter"}
                  </Button>
                )}
              </div>
            </div>

            {/* 2. Google Gemini BYOK */}
            <div className="p-3.5 rounded-xl border border-border bg-background/60 flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-bold text-foreground">Google Gemini</span>
                  </div>
                  {hasGeminiKey ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 font-bold">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
                      BYOK
                    </span>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder="Paste AIzaSy... key"
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                {hasGeminiKey && (
                  <button
                    type="button"
                    onClick={() => handleRemoveBYOKKey("gemini")}
                    className="text-[10px] text-destructive hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSaveBYOKKey("gemini", geminiKeyInput)}
                  disabled={isSavingKey || !geminiKeyInput.trim()}
                  className="h-7 text-xs ml-auto bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  {hasGeminiKey ? "Update" : "Save Key"}
                </Button>
              </div>
            </div>

            {/* 3. DeepSeek BYOK */}
            <div className="p-3.5 rounded-xl border border-border bg-background/60 flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                      <Cpu className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-bold text-foreground">DeepSeek API</span>
                  </div>
                  {hasDeepseekKey ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 font-bold">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
                      BYOK
                    </span>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder="Paste sk-... key"
                  value={deepseekKeyInput}
                  onChange={(e) => setDeepseekKeyInput(e.target.value)}
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                {hasDeepseekKey && (
                  <button
                    type="button"
                    onClick={() => handleRemoveBYOKKey("deepseek")}
                    className="text-[10px] text-destructive hover:underline cursor-pointer"
                  >
                    Remove
                  </button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSaveBYOKKey("deepseek", deepseekKeyInput)}
                  disabled={isSavingKey || !deepseekKeyInput.trim()}
                  className="h-7 text-xs ml-auto bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  {hasDeepseekKey ? "Update" : "Save Key"}
                </Button>
              </div>
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
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? "border-primary bg-primary text-primary-foreground shadow-marble-1 font-semibold"
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
            <RotateCw className="h-5 w-5 animate-spin text-primary" />
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
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 shadow-marble-1 hover:shadow-marble-2 ${
                    plugin.isConnected
                      ? "bg-card border-primary/30"
                      : "bg-card/50 border-border hover:border-primary/40 hover:bg-card"
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
                          : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-marble-1"
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
