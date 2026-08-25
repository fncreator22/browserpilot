"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  User, 
  Mail, 
  Sparkles, 
  KeyRound, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  X
} from "lucide-react";
import { toast } from "sonner";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { data: session, update: updateSession } = useSession();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load profile data when modal opens
  useEffect(() => {
    if (isOpen && session?.user) {
      setName(session.user.name || "");
      setEmail(session.user.email || "");
      setErrorMsg(null);
      setSuccessMsg(null);
      setCurrentPassword("");
      setNewPassword("");
      setGeminiApiKey("");

      fetch("/api/user/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            if (data.name) setName(data.name);
            if (data.email) setEmail(data.email);
            setHasKey(data.hasGeminiKey || false);
            setMaskedKey(data.maskedKey || null);
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, session]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setErrorMsg("Password is required to confirm and save profile changes.");
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim() ? email.trim().toLowerCase() : undefined,
          geminiApiKey: geminiApiKey.trim() ? geminiApiKey.trim() : undefined,
          currentPassword,
          newPassword: newPassword.trim() ? newPassword.trim() : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMsg(data.message || "Failed to update profile.");
        return;
      }

      setSuccessMsg("Profile and Gemini API Key updated successfully!");
      toast.success("Profile updated successfully!");

      if (data.user) {
        setHasKey(data.user.hasGeminiKey);
        setMaskedKey(data.user.maskedKey);
        setGeminiApiKey("");
        setCurrentPassword("");
        setNewPassword("");
      }

      // Refresh session
      updateSession();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 text-foreground shadow-2xl z-10 overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-border/60">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-foreground font-mono">
                  User Profile & Settings
                </h3>
                <p className="text-xs text-muted-foreground">
                  Manage your credentials and BYOK Gemini API key
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="py-10 flex flex-col items-center justify-center space-y-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs font-mono text-muted-foreground">Loading profile...</p>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4 pt-3">
                {errorMsg && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 font-mono flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-mono flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Name & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5 font-mono">
                      <User className="h-3 w-3 text-muted-foreground" />
                      Full Name
                    </label>
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Developer"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5 font-mono">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      Email Address
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="developer@example.com"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* BYOK Gemini API Key Section */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 font-mono">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Gemini API Key (BYOK)
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 font-mono"
                    >
                      Get free key <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>

                  {hasKey && maskedKey && (
                    <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-2">
                      <span className="text-emerald-500 font-semibold">● Active:</span>
                      <span className="bg-background/80 px-2 py-0.5 rounded border border-border/60">
                        {maskedKey}
                      </span>
                    </div>
                  )}

                  <div className="relative">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder={hasKey ? "Enter new key to replace existing..." : "AIzaSy..."}
                      className="h-9 text-xs font-mono pr-10 bg-background"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    System automatically detects and selects Gemini 2.5 Flash / 2.0 Flash models.
                  </p>
                </div>

                {/* Optional New Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5 font-mono">
                    <KeyRound className="h-3 w-3 text-muted-foreground" />
                    New Password (Optional)
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="h-9 text-xs font-mono"
                  />
                </div>

                {/* Required Current Password for Security Confirmation */}
                <div className="space-y-1.5 pt-1 border-t border-border/40">
                  <label className="text-xs font-semibold text-rose-400 flex items-center gap-1.5 font-mono">
                    <Lock className="h-3.5 w-3.5" />
                    Current Password (Required to Save) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password to confirm changes"
                    className="h-9 text-xs font-mono border-rose-500/30 focus-visible:ring-rose-500/30"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="font-mono text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSaving || !currentPassword}
                    className="font-mono text-xs gap-1.5 shadow-sm"
                  >
                    {isSaving ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Saving Changes...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
