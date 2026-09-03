"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Brain, 
  Sparkles, 
  Trash2, 
  Edit3, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Building, 
  MapPin, 
  Globe, 
  Briefcase, 
  Layers,
  ArrowRight,
  ShieldCheck,
  Info,
  Clock,
  RotateCw,
  Lightbulb
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/navbar";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { Footer } from "@/components/footer";
import { toast } from "sonner";

interface MemoryItem {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: string;
  importance: number;
  updatedAt?: string;
}

export default function UserMemoryPage() {
  const [preferences, setPreferences] = useState<MemoryItem[]>([]);
  const [recommendations, setRecommendations] = useState<MemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newPreferenceText, setNewPreferenceText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchMemories = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/user/memory");
      if (res.ok) {
        const data = await res.json();
        setPreferences(data.preferences || []);
        setRecommendations(data.recommendations || []);
      }
    } catch {
      toast.error("Failed to load saved preferences.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const handleAddPreference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPreferenceText.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/user/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newPreferenceText.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("Preference remembered successfully", {
          description: `Saved ${data.admittedCount || 1} durable preference(s).`,
        });
        setNewPreferenceText("");
        fetchMemories();
      } else {
        toast.error("Could not save preference", {
          description: data.message || "Memory admission policy rejected this statement.",
        });
      }
    } catch {
      toast.error("Network error saving preference.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/user/memory/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Preference removed", {
          description: "Future searches and AI Brain context will no longer use this memory.",
        });
        setPreferences((prev) => prev.filter((p) => p.id !== id));
        setRecommendations((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast.error("Failed to delete preference.");
      }
    } catch {
      toast.error("Network error deleting preference.");
    }
  };

  const handleStartEdit = (item: MemoryItem) => {
    setEditingId(item.id);
    setEditingValue(item.value);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingValue.trim()) return;
    try {
      setIsSavingEdit(true);
      const res = await fetch(`/api/user/memory/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: editingValue.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Preference updated successfully");
        setEditingId(null);
        fetchMemories();
      } else {
        toast.error("Failed to update preference", {
          description: data.message || "Admission policy rejected update.",
        });
      }
    } catch {
      toast.error("Network error updating preference.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "ROLE_PREFERENCE":
        return <Briefcase className="h-4 w-4 text-primary" />;
      case "LOCATION_PREFERENCE":
        return <MapPin className="h-4 w-4 text-emerald-400" />;
      case "WORK_MODE_PREFERENCE":
        return <Globe className="h-4 w-4 text-sky-400" />;
      case "SKILL_INTEREST":
        return <Sparkles className="h-4 w-4 text-purple-400" />;
      default:
        return <Brain className="h-4 w-4 text-amber-400" />;
    }
  };

  const formatCategoryLabel = (category: string) => {
    return category
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-6">
        <WorkspaceNav />

        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Brain className="h-4 w-4" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
                User Memory Vault & Personalization
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Durable preferences BrowserPilot remembers to personalize your searches. Explicit query constraints always override saved preferences.
            </p>
          </div>

          <Link href="/app">
            <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 cursor-pointer">
              Back to Discover
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {/* Section 1: Add a Preference */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-primary" />
              Add a Durable Preference
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              Passes through Memory Admission
            </span>
          </div>

          <form onSubmit={handleAddPreference} className="flex flex-col sm:flex-row items-stretch gap-2">
            <Input
              type="text"
              value={newPreferenceText}
              onChange={(e) => setNewPreferenceText(e.target.value)}
              placeholder="e.g. Remember that I prefer remote backend engineering roles in India"
              className="font-mono text-xs h-10 flex-1"
            />
            <Button
              type="submit"
              disabled={isSubmitting || !newPreferenceText.trim()}
              className="font-mono text-xs h-10 gap-1.5 cursor-pointer shrink-0"
            >
              {isSubmitting ? (
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Remember Preference
            </Button>
          </form>

          {/* Quick statement suggestions */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] font-mono text-muted-foreground">
            <span>Try:</span>
            {[
              "Remember that I prefer remote roles",
              "Remember that I target backend engineering",
              "Prioritize opportunities in India",
              "I prefer Python and TypeScript roles",
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setNewPreferenceText(suggestion)}
                className="px-2 py-0.5 rounded border border-border/60 bg-muted/20 hover:bg-muted/50 text-foreground cursor-pointer transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: What BrowserPilot Remembers */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground font-mono flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Active Saved Preferences ({preferences.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                These preferences guide intelligent search planning when query constraints are unstated.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchMemories}
              className="h-7 text-xs font-mono gap-1 text-muted-foreground"
            >
              <RotateCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs font-mono text-muted-foreground">
              Loading user memory vault...
            </div>
          ) : preferences.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-border/60 bg-muted/10 space-y-2">
              <Brain className="h-6 w-6 text-muted-foreground mx-auto opacity-60" />
              <p className="text-xs font-mono text-foreground font-medium">
                No durable preferences saved yet.
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                Add a preference above (e.g. &ldquo;Remember that I prefer remote roles&rdquo;) to guide future searches.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {preferences.map((item) => {
                const isEditing = editingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-border/70 bg-muted/10 hover:bg-muted/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="p-2 rounded-lg bg-background border border-border/60 mt-0.5 sm:mt-0 shrink-0">
                        {getCategoryIcon(item.category)}
                      </span>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                            {formatCategoryLabel(item.category)}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                            {item.confidence}
                          </Badge>
                        </div>

                        {isEditing ? (
                          <div className="flex items-center gap-2 pt-1 max-w-md">
                            <Input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="h-8 font-mono text-xs"
                            />
                            <Button
                              size="sm"
                              disabled={isSavingEdit || !editingValue.trim()}
                              onClick={() => handleSaveEdit(item.id)}
                              className="h-8 text-xs font-mono"
                            >
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingId(null)}
                              className="h-8 text-xs font-mono"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm font-semibold text-foreground break-words">
                            {item.value}
                          </p>
                        )}
                      </div>
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(item)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Edit preference"
                          aria-label="Edit preference"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500 cursor-pointer"
                          title="Remove preference"
                          aria-label="Remove preference"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Recommendation Signals (Separated from Preferences) */}
        {recommendations.length > 0 && (
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400 font-mono flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" />
                  Suggested For You (Recommendation Signals)
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Observed from search patterns and feedback. Recommendations are not permanent preferences.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-lg border border-sky-500/20 bg-background/60 flex items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{rec.key}:</span>
                    <span className="font-semibold text-foreground">{rec.value}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleAddPreference({
                          preventDefault: () => {},
                        } as any);
                      }}
                      className="h-7 text-[11px] font-mono"
                    >
                      Promote to Preference
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(rec.id)}
                      className="h-7 text-[11px] font-mono text-muted-foreground hover:text-rose-500"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Privacy & Invariants Notice */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground space-y-1.5 font-mono">
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Info className="h-3.5 w-3.5 text-primary" />
            <span>Memory Privacy & Invariant Guarantees:</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            1. <strong>Explicit Query Authority:</strong> When you search &ldquo;hybrid jobs&rdquo;, your query overrides any saved remote preferences.
            <br />
            2. <strong>Transient Searches:</strong> Routine searches like &ldquo;Find 5 jobs today&rdquo; never become permanent preferences.
            <br />
            3. <strong>Complete Tenant Isolation:</strong> Preferences are strictly isolated to your authenticated account.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
