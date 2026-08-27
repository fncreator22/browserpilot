"use client";

import { useState, useEffect } from "react";
import { Sparkles, Bot, Key, Check, LogIn, LogOut, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePuter } from "@/hooks/usePuter";
import { toast } from "sonner";

export interface AIProviderSelection {
  provider: "puter" | "byok" | "server";
  model: string;
}

interface AIProviderSelectorProps {
  onSelectionChange?: (selection: AIProviderSelection) => void;
  className?: string;
}

const PUTER_MODELS = [
  { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", tag: "Best Reasoning", badge: "Free" },
  { id: "gpt-4o", name: "OpenAI GPT-4o", tag: "Multimodal & Vision", badge: "Free" },
  { id: "deepseek-reasoner", name: "DeepSeek R1", tag: "Deep Logic", badge: "Free" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", tag: "Ultra Fast", badge: "Free" },
];

export function AIProviderSelector({ onSelectionChange, className = "" }: AIProviderSelectorProps) {
  const { isLoaded, isSignedIn, user, isAuthenticating, signIn, signOut } = usePuter();
  const [selectedProvider, setSelectedProvider] = useState<"puter" | "byok" | "server">("puter");
  const [selectedModel, setSelectedModel] = useState<string>("claude-3-7-sonnet");

  // Load saved preference from localStorage
  useEffect(() => {
    try {
      const savedProvider = localStorage.getItem("bp_ai_provider") as "puter" | "byok" | "server" | null;
      const savedModel = localStorage.getItem("bp_ai_model");
      if (savedProvider) setSelectedProvider(savedProvider);
      if (savedModel) setSelectedModel(savedModel);
    } catch {}
  }, []);

  const handleSelectProvider = (provider: "puter" | "byok" | "server", model = selectedModel) => {
    setSelectedProvider(provider);
    setSelectedModel(model);
    try {
      localStorage.setItem("bp_ai_provider", provider);
      localStorage.setItem("bp_ai_model", model);
    } catch {}
    onSelectionChange?.({ provider, model });
  };

  const handlePuterSignIn = async () => {
    try {
      const currentUser = await signIn();
      if (currentUser) {
        toast.success(`Connected Puter account: ${currentUser.username}`);
        handleSelectProvider("puter", selectedModel);
      }
    } catch (err) {
      toast.error((err as Error).message || "Puter authentication failed.");
    }
  };

  const handlePuterSignOut = async () => {
    await signOut();
    toast.info("Disconnected Puter account.");
  };

  return (
    <div className={`rounded-xl border border-border/80 bg-card/60 backdrop-blur-sm p-4 space-y-3 ${className}`}>
      {/* Header with Title and Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold text-foreground tracking-tight">AI Engine & Token Manager</span>
        </div>

        {/* Puter Auth Status Badge */}
        {selectedProvider === "puter" && (
          <div className="flex items-center gap-2">
            {isSignedIn ? (
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="font-mono text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  {user?.username || "Puter Active"}
                </Badge>
                <button
                  onClick={handlePuterSignOut}
                  title="Sign out of Puter"
                  className="text-muted-foreground hover:text-foreground text-[10px]"
                >
                  <LogOut className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePuterSignIn}
                disabled={isAuthenticating || !isLoaded}
                className="h-6 text-[11px] font-mono gap-1 text-primary border-primary/30 hover:bg-primary/10"
              >
                <LogIn className="h-3 w-3" />
                {isAuthenticating ? "Connecting..." : "Connect Free Puter"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Model Selection Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Puter Option */}
        <div
          onClick={() => handleSelectProvider("puter", selectedModel)}
          className={`cursor-pointer rounded-lg border p-2.5 transition-all ${
            selectedProvider === "puter"
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border/60 bg-muted/20 hover:border-border"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Puter AI (Free)</span>
            </div>
            {selectedProvider === "puter" && <Check className="h-3.5 w-3.5 text-primary" />}
          </div>
          <p className="text-[11px] text-muted-foreground">Claude 3.7, GPT-4o, DeepSeek ($0 Server Cost)</p>
        </div>

        {/* Custom Gemini Key Option */}
        <div
          onClick={() => handleSelectProvider("byok", "gemini-3.6-flash")}
          className={`cursor-pointer rounded-lg border p-2.5 transition-all ${
            selectedProvider === "byok"
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border/60 bg-muted/20 hover:border-border"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
              <Key className="h-3.5 w-3.5 text-amber-500" />
              <span>BYOK Gemini</span>
            </div>
            {selectedProvider === "byok" && <Check className="h-3.5 w-3.5 text-primary" />}
          </div>
          <p className="text-[11px] text-muted-foreground">User Google AI Key (Uncapped Quota)</p>
        </div>

        {/* Platform Default Option */}
        <div
          onClick={() => handleSelectProvider("server", "gemini-3.6-flash")}
          className={`cursor-pointer rounded-lg border p-2.5 transition-all ${
            selectedProvider === "server"
              ? "border-primary bg-primary/5 shadow-xs"
              : "border-border/60 bg-muted/20 hover:border-border"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
              <Bot className="h-3.5 w-3.5 text-blue-500" />
              <span>Platform Default</span>
            </div>
            {selectedProvider === "server" && <Check className="h-3.5 w-3.5 text-primary" />}
          </div>
          <p className="text-[11px] text-muted-foreground">Server-managed fallback engine</p>
        </div>
      </div>

      {/* Sub-model selector when Puter is active */}
      {selectedProvider === "puter" && (
        <div className="pt-2 border-t border-border/40 space-y-1.5">
          <label className="text-[11px] font-mono text-muted-foreground">Select Puter Model (Free Daily Token Pool):</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {PUTER_MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelectProvider("puter", m.id)}
                className={`flex flex-col items-start p-2 rounded-md border text-left transition-colors ${
                  selectedModel === m.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 bg-background/50 hover:bg-muted text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-xs text-foreground">{m.name}</span>
                  <Badge variant="secondary" className="text-[9px] font-mono px-1 py-0 h-4 bg-emerald-500/10 text-emerald-500">
                    {m.badge}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5">{m.tag}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
