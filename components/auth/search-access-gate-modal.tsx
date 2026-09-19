"use client";

import React, { useEffect, useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Zap, 
  Sparkles, 
  Cpu, 
  LogIn, 
  X, 
  Check, 
  Loader2, 
  ArrowRight,
  ShieldCheck,
  Key,
  Puzzle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export interface SearchAccessGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProviders?: () => void;
  onConnected?: () => void;
  queryAttempted?: string;
}

export function SearchAccessGateModal({
  isOpen,
  onClose,
  onOpenProviders,
  onConnected,
  queryAttempted,
}: SearchAccessGateModalProps) {
  const router = useRouter();
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [activeInlineKey, setActiveInlineKey] = useState<"gemini" | "deepseek" | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const clickLockRef = useRef(false);

  // Reset states on open/close
  useEffect(() => {
    if (isOpen) {
      setConnectingProvider(null);
      setActiveInlineKey(null);
      setApiKeyInput("");
      clickLockRef.current = false;
    }
  }, [isOpen]);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !connectingProvider && !isSavingKey) {
        onClose();
      }
    },
    [onClose, connectingProvider, isSavingKey]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleKeyDown]);

  const acquireLock = () => {
    if (clickLockRef.current || connectingProvider || isSavingKey) {
      return false;
    }
    clickLockRef.current = true;
    return true;
  };

  const releaseLock = () => {
    clickLockRef.current = false;
    setConnectingProvider(null);
  };

  const handleConnectPuter = async () => {
    if (!acquireLock()) return;
    setConnectingProvider("puter");

    try {
      if (typeof window === "undefined") {
        releaseLock();
        return;
      }

      // Check if Puter SDK is available
      let puter = (window as any).puter;
      if (!puter?.auth) {
        // Attempt fast script injection if not loaded
        await new Promise<void>((resolve, reject) => {
          const existingScript = document.querySelector('script[src*="puter.com"]');
          if (existingScript) {
            let attempts = 0;
            const interval = setInterval(() => {
              attempts++;
              if ((window as any).puter?.auth) {
                clearInterval(interval);
                resolve();
              } else if (attempts > 20) {
                clearInterval(interval);
                reject(new Error("Puter SDK timed out loading"));
              }
            }, 100);
          } else {
            const script = document.createElement("script");
            script.src = "https://js.puter.com/v2/";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Puter SDK"));
            document.head.appendChild(script);
          }
        }).catch(() => null);
        puter = (window as any).puter;
      }

      if (puter?.auth) {
        const authRes = await puter.auth.signIn();
        const token = puter.authToken || (authRes && typeof authRes === "object" ? (authRes as any).token : null) || localStorage.getItem("puter.auth.token.v2");

        if (token) {
          localStorage.setItem("puter.auth.token.v2", token);
          // Sync with backend provider connection
          await fetch("/api/account/providers/puter", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, username: "Puter User" }),
          }).catch(() => {});

          toast.success("Puter Connected", {
            description: "Free 1-click Puter AI reasoning connected successfully.",
          });

          window.dispatchEvent(new CustomEvent("browserai:provider-updated", { detail: { provider: "PUTER" } }));
          window.dispatchEvent(new CustomEvent("browserai:refresh-state"));

          onConnected?.();
          onClose();
          return;
        }
      }

      // If Puter auth window was dismissed or failed, fallback gracefully
      toast.info("Puter Connection", {
        description: "You can also add a Gemini or DeepSeek API key directly.",
      });
    } catch (err: any) {
      console.warn("[SearchAccessGate] Puter sign-in error:", err);
      toast.error("Puter Connection Failed", {
        description: err?.message || "Could not connect to Puter. Please try Gemini or DeepSeek BYOK.",
      });
    } finally {
      releaseLock();
    }
  };

  const handleSaveApiKey = async (provider: "gemini" | "deepseek") => {
    const key = apiKeyInput.trim();
    if (!key) {
      toast.error("Please enter a valid API key");
      return;
    }

    setIsSavingKey(true);
    try {
      const storageKey = provider === "gemini" ? "browserpilot_gemini_key" : "browserpilot_deepseek_key";
      localStorage.setItem(storageKey, key);

      // Persist to backend if authenticated
      await fetch("/api/account/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider === "gemini" ? "GEMINI_BYOK" : "DEEPSEEK_BYOK",
          apiKey: key,
        }),
      }).catch(() => {});

      toast.success(`${provider === "gemini" ? "Google Gemini" : "DeepSeek"} Key Saved`, {
        description: "API key stored securely for live autonomous searches.",
      });

      window.dispatchEvent(new CustomEvent("browserai:provider-updated", { detail: { provider, key } }));
      window.dispatchEvent(new CustomEvent("browserai:refresh-state"));

      onConnected?.();
      onClose();
    } catch {
      toast.error("Failed to save key. Please retry.");
    } finally {
      setIsSavingKey(false);
    }
  };

  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);

  const handleSignIn = () => {
    if (!acquireLock()) return;
    setConnectingProvider("signin");
    onClose();
    router.push("/login?callbackUrl=/app");
  };

  const handleOpenConnectors = () => {
    if (!acquireLock()) return;
    setConnectingProvider("connectors");
    onClose();
    router.push("/app/plugins");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="access-gate-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !connectingProvider && !isSavingKey && onClose()}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl z-10 font-sans"
          >
            {/* Top Accent Gradient Line */}
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

            <div className="p-6 space-y-5">
              {/* Header: Clean Single-Line Focus */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 id="access-gate-title" className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                    Please connect to access the platform
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Connect Puter or add an API key to execute verified autonomous searches.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={Boolean(connectingProvider || isSavingKey)}
                  aria-label="Close modal"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {queryAttempted && (
                <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground truncate">
                  <span className="text-foreground font-semibold">Search:</span> &ldquo;{queryAttempted}&rdquo;
                </div>
              )}

              {/* Icon & Logo Action Grid */}
              <div className="grid grid-cols-1 gap-2.5">
                {/* 1. Puter Free 1-Click */}
                <button
                  type="button"
                  disabled={Boolean(connectingProvider || isSavingKey)}
                  onClick={handleConnectPuter}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border/80 bg-background/60 hover:bg-muted/70 hover:border-cyan-500/40 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-500/25 shrink-0">
                      {connectingProvider === "puter" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
                      ) : (
                        <Zap className="h-4 w-4 fill-cyan-500/20 text-cyan-500 stroke-[2]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          Connect Puter
                        </span>
                        <span className="rounded-full bg-cyan-500/10 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                          1-Click Free
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        Zero-cost serverless AI reasoning via client session
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </button>

                {/* 2. Google Gemini BYOK */}
                <div className="rounded-xl border border-border/80 bg-background/60 transition-all overflow-hidden">
                  <button
                    type="button"
                    disabled={Boolean(connectingProvider || isSavingKey)}
                    onClick={() => {
                      if (activeInlineKey === "gemini") {
                        setActiveInlineKey(null);
                      } else {
                        setActiveInlineKey("gemini");
                        setApiKeyInput(localStorage.getItem("browserpilot_gemini_key") || "");
                      }
                    }}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/70 transition-colors cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/25 shrink-0">
                        <Sparkles className="h-4 w-4 text-emerald-500 stroke-[2]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            Google Gemini
                          </span>
                          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            BYOK
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Enter free Gemini Flash API key for instant quota
                        </p>
                      </div>
                    </div>
                    <Key className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-2" />
                  </button>

                  {/* Inline Key Input for Gemini */}
                  {activeInlineKey === "gemini" && (
                    <div className="px-3 pb-3 pt-1 border-t border-border/40 space-y-2 bg-muted/20">
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="Paste AIzaSy... API key"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          className="h-8 text-xs font-mono"
                          autoFocus
                          disabled={isSavingKey}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveApiKey("gemini")}
                          disabled={isSavingKey || !apiKeyInput.trim()}
                          className="h-8 text-xs font-medium shrink-0 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {isSavingKey ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Get a free key from <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="underline text-foreground">Google AI Studio</a>.
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. DeepSeek BYOK */}
                <div className="rounded-xl border border-border/80 bg-background/60 transition-all overflow-hidden">
                  <button
                    type="button"
                    disabled={Boolean(connectingProvider || isSavingKey)}
                    onClick={() => {
                      if (activeInlineKey === "deepseek") {
                        setActiveInlineKey(null);
                      } else {
                        setActiveInlineKey("deepseek");
                        setApiKeyInput(localStorage.getItem("browserpilot_deepseek_key") || "");
                      }
                    }}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/70 transition-colors cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/25 shrink-0">
                        <Cpu className="h-4 w-4 text-indigo-500 stroke-[2]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            DeepSeek API
                          </span>
                          <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            BYOK
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Enter your DeepSeek V3 / R1 reasoning key
                        </p>
                      </div>
                    </div>
                    <Key className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-2" />
                  </button>

                  {/* Inline Key Input for DeepSeek */}
                  {activeInlineKey === "deepseek" && (
                    <div className="px-3 pb-3 pt-1 border-t border-border/40 space-y-2 bg-muted/20">
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="Paste sk-... DeepSeek key"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          className="h-8 text-xs font-mono"
                          autoFocus
                          disabled={isSavingKey}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveApiKey("deepseek")}
                          disabled={isSavingKey || !apiKeyInput.trim()}
                          className="h-8 text-xs font-medium shrink-0 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          {isSavingKey ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. AI Connectors & Plugins Navigation (or Sign In if guest) */}
                {isLoggedIn ? (
                  <button
                    type="button"
                    disabled={Boolean(connectingProvider || isSavingKey)}
                    onClick={handleOpenConnectors}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-border/80 bg-background/60 hover:bg-muted/70 hover:border-primary/40 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                        <Puzzle className="h-4 w-4 stroke-[2]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            Configure in AI Connectors
                          </span>
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.2 text-[9px] font-mono font-semibold text-primary border border-primary/20">
                            Dashboard
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Manage all AI API keys, scraper integrations & plugins
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(connectingProvider || isSavingKey)}
                    onClick={handleSignIn}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-border/80 bg-background/60 hover:bg-muted/70 hover:border-primary/40 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                        <LogIn className="h-4 w-4 stroke-[2]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            Sign In with Account
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Sign in or register to sync your watches and keys
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
                <span className="text-[11px]">
                  Keys are stored locally in your browser
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onClose}
                  disabled={Boolean(connectingProvider || isSavingKey)}
                  className="h-7 text-xs font-medium cursor-pointer"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
