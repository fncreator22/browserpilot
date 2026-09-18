"use client";

import React, { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldAlert, 
  KeyRound, 
  LogIn, 
  Zap, 
  Sparkles, 
  X, 
  ArrowRight,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SearchAccessGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProviders?: () => void;
  queryAttempted?: string;
}

export function SearchAccessGateModal({
  isOpen,
  onClose,
  onOpenProviders,
  queryAttempted,
}: SearchAccessGateModalProps) {
  const router = useRouter();

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
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

  const handleSignIn = () => {
    onClose();
    router.push("/login?callbackUrl=/app");
  };

  const handleOpenProviders = () => {
    onClose();
    if (onOpenProviders) {
      onOpenProviders();
    }
  };

  const handleConnectPuter = async () => {
    try {
      if (typeof window !== "undefined" && (window as any).puter?.auth) {
        await (window as any).puter.auth.signIn();
        onClose();
        // Trigger a light reload or toast
        window.location.reload();
      } else {
        handleOpenProviders();
      }
    } catch {
      handleOpenProviders();
    }
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
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl z-10 font-sans"
          >
            {/* Top Accent Gradient Bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

            <div className="p-6 sm:p-7 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <ShieldAlert className="h-6 w-6 stroke-[2]" />
                  </div>
                  <div>
                    <h3 id="access-gate-title" className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                      Authentication or AI Key Required
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      To discover verified roles and unlock live recruiter outreach intelligence, please sign in or connect your AI provider.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close access modal"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {queryAttempted && (
                <div className="rounded-xl border border-border/60 bg-muted/40 px-3.5 py-2 text-xs font-mono text-muted-foreground truncate">
                  <span className="text-foreground font-semibold">Query:</span> &ldquo;{queryAttempted}&rdquo;
                </div>
              )}

              {/* 3 Action Options */}
              <div className="space-y-3">
                {/* Option 1: Portal Login / Register */}
                <div 
                  onClick={handleSignIn}
                  className="group flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-background/50 hover:bg-muted/60 hover:border-emerald-500/40 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <LogIn className="h-4 w-4 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          Sign In or Create Account
                        </span>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Recommended
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Log in to unlock persistent watch radar, saved job bookmarks, and personalized matches.
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>

                {/* Option 2: Add API Key (BYOK) */}
                <div 
                  onClick={handleOpenProviders}
                  className="group flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-background/50 hover:bg-muted/60 hover:border-teal-500/40 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400">
                      <KeyRound className="h-4 w-4 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          Add Gemini or DeepSeek Key (BYOK)
                        </span>
                        <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium text-teal-600 dark:text-teal-400 border border-teal-500/20">
                          Direct AI
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Use your own free Google Gemini or DeepSeek API key for unmetered live searches.
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>

                {/* Option 3: Connect Free Puter AI */}
                <div 
                  onClick={handleConnectPuter}
                  className="group flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-background/50 hover:bg-muted/60 hover:border-cyan-500/40 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                      <Zap className="h-4 w-4 stroke-[2]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                          Connect Free Puter AI
                        </span>
                        <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                          1-Click Free
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Instant zero-cost AI reasoning provided via client-side Puter. No credit card required.
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Free forever for students & job seekers
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onClose}
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
