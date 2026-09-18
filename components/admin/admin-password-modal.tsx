"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldAlert, KeyRound, Lock, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void> | void;
  actionTitle: string;
  actionDescription: string;
  expectedConfirmationPhrase?: string;
  affectedCount?: number;
  affectedItemType?: string;
  isDestructive?: boolean;
}

export function AdminPasswordModal({
  isOpen,
  onClose,
  onConfirm,
  actionTitle,
  actionDescription,
  expectedConfirmationPhrase = "CONFIRM PURGE",
  affectedCount,
  affectedItemType = "records",
  isDestructive = true,
}: AdminPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [typedPhrase, setTypedPhrase] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const phraseMatches =
    !expectedConfirmationPhrase ||
    typedPhrase.trim().toUpperCase() === expectedConfirmationPhrase.toUpperCase();

  const canSubmit = password.trim().length > 0 && phraseMatches && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirm(password);
      setPassword("");
      setTypedPhrase("");
      onClose();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Verification failed. Please check credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-modal-title"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md rounded-2xl border border-red-500/30 dark:border-red-500/40 bg-white dark:bg-slate-900 shadow-2xl p-6 text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
              <ShieldAlert className="h-5 w-5 stroke-[2]" />
            </div>
            <div>
              <h3 id="admin-modal-title" className="text-base font-sans font-bold text-foreground">
                {actionTitle}
              </h3>
              <span className="text-[10px] font-mono uppercase tracking-wider text-red-600 dark:text-red-400">
                Security Verification Gate
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Warning & Description */}
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed font-sans">{actionDescription}</p>
          </div>
          {affectedCount !== undefined && (
            <div className="mt-2 pt-2 border-t border-amber-500/20 font-mono text-[11px] text-foreground font-semibold flex items-center justify-between">
              <span>Affected Volume:</span>
              <span className="text-red-600 dark:text-red-400 font-bold">
                {affectedCount.toLocaleString()} {affectedItemType}
              </span>
            </div>
          )}
        </div>

        {/* Verification Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Admin Password Input */}
          <div>
            <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">
              Admin Password or Secret Key
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin authorization secret"
                required
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-slate-50 dark:bg-slate-950 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/40"
              />
            </div>
          </div>

          {/* Type Confirmation Phrase */}
          {expectedConfirmationPhrase && (
            <div>
              <label className="block text-xs font-sans text-muted-foreground mb-1.5">
                Type <span className="font-mono font-bold text-foreground">{expectedConfirmationPhrase}</span> to confirm:
              </label>
              <input
                type="text"
                value={typedPhrase}
                onChange={(e) => setTypedPhrase(e.target.value)}
                placeholder={expectedConfirmationPhrase}
                required
                className="w-full px-3 py-2 rounded-lg border border-border bg-slate-50 dark:bg-slate-950 font-mono text-xs text-foreground uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-red-500/40"
              />
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="text-xs font-mono text-red-500 bg-red-500/10 border border-red-500/20 rounded-md p-2">
              {errorMessage}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs cursor-pointer font-sans"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-sans font-medium cursor-pointer shadow-sm"
            >
              {isSubmitting ? "Verifying..." : "Authorize & Execute"}
            </Button>
          </div>
        </form>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
  );
}
