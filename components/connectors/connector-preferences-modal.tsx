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
} from "lucide-react";
import { toast } from "sonner";
import { humanizeConnectorType } from "@/lib/utils/display-mappings";

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
  const [connectors, setConnectors] = useState<ConnectorDef[]>([]);
  const [preferredSources, setPreferredSources] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/account/connectors");
      if (!res.ok) throw new Error("Failed to load connector preferences");
      const data = await res.json();

      setConnectors(data.connectors || []);
      setPreferredSources(data.preferredSources || []);
    } catch (err: unknown) {
      toast.error("Failed to load connectors", {
        description: (err as Error).message || "Please check your connection.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleSource = (sourceName: string) => {
    setPreferredSources((prev) => {
      const exists = prev.some((s) => s.toLowerCase() === sourceName.toLowerCase());
      if (exists) {
        if (prev.length <= 1) {
          toast.warning("At least one source required", {
            description: "You must keep at least one discovery connector active.",
          });
          return prev;
        }
        return prev.filter((s) => s.toLowerCase() !== sourceName.toLowerCase());
      } else {
        return [...prev, sourceName];
      }
    });
  };

  const handleSavePreferences = async () => {
    if (preferredSources.length === 0) {
      toast.error("Validation Error", {
        description: "Please select at least one active connector source.",
      });
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch("/api/account/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredSources }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to save preferences");
      }

      toast.success("Connector Preferences Saved", {
        description: `Active sources (${preferredSources.length}) updated across Discover and Autonomous Watch.`,
      });

      onPreferencesSaved?.(preferredSources);
    } catch (err: unknown) {
      toast.error("Save Failed", {
        description: (err as Error).message || "Unable to save connector preferences.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">
          <RotateCw className="h-5 w-5 animate-spin mx-auto mb-2 text-[#1F3D2E]" />
          <p className="text-xs">Loading available connectors...</p>
        </div>
      ) : connectors.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl p-6">
          <AlertCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
          <p className="text-xs">No active connectors available at this time.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Active: <strong className="text-foreground">{preferredSources.length}</strong> of {connectors.length} sources
            </span>
            <span className="text-[11px] text-[#526359]">
              Changes apply immediately to both Discover and Autonomous Watch
            </span>
          </div>

          <div className="grid gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {connectors.map((conn) => {
              const isSelected = preferredSources.some(
                (s) => s.toLowerCase() === conn.name.toLowerCase()
              );

              return (
                <div
                  key={conn.id}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-card border-border/80 shadow-2xs"
                      : "bg-muted/10 border-border/40 opacity-70"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSource(conn.name)}
                      className="h-4 w-4 rounded border-border text-[#1F3D2E] focus:ring-[#1F3D2E] cursor-pointer shrink-0"
                      title={isSelected ? "Disable source" : "Enable source"}
                    />

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 border border-border/60 overflow-hidden">
                      {conn.iconUrl ? (
                        <img src={conn.iconUrl} alt="" className="h-4 w-4 object-contain" />
                      ) : (
                        <Plug className="h-4 w-4 text-[#1F3D2E]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground truncate block">
                          {conn.displayName || conn.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 font-sans border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 shrink-0"
                        >
                          {humanizeConnectorType(conn.type)}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground block truncate">
                        {conn.baseUrl}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] text-muted-foreground font-sans shrink-0">
                    {isSelected ? "Active" : "Excluded"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showActions && (
        <div className="pt-3 border-t border-border/60 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-sans">
            Configured sources govern Discover & Watches simultaneously.
          </span>
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSavePreferences}
              disabled={isSaving || isLoading}
              className="bg-[#1F3D2E] hover:bg-[#162D22] text-white font-sans font-semibold text-xs gap-1.5 cursor-pointer shadow-xs"
            >
              {isSaving ? (
                <>
                  <RotateCw className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 stroke-[2]" />
                  Save Preferences
                </>
              )}
            </Button>
          </div>
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

  return (
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border/80 bg-card text-foreground shadow-2xl z-10 overflow-hidden font-sans"
          >
            <div className="p-5 pb-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
              <div>
                <div className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Plug className="h-4 w-4 text-[#1F3D2E]" />
                  <span>Global Connector Preferences</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Single source of truth for both ad-hoc Discover searches and scheduled Autonomous Watch scans.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <ConnectorPreferencesPanel
                onPreferencesSaved={(sources) => {
                  onPreferencesSaved?.(sources);
                  handleClose();
                }}
                onCancel={handleClose}
                showActions={true}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
