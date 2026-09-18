"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Brain, 
  Sparkles, 
  Trash2, 
  Edit3, 
  MapPin, 
  Globe, 
  Briefcase, 
  ArrowRight,
  ShieldCheck,
  Info,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CareerMemoryForm } from "@/components/profile/career-memory-form";

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
  const [isLoading, setIsLoading] = useState(true);
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
        return <MapPin className="h-4 w-4 text-blue-600" />;
      case "WORK_MODE_PREFERENCE":
        return <Globe className="h-4 w-4 text-sky-600" />;
      case "SKILL_INTEREST":
        return <Sparkles className="h-4 w-4 text-primary" />;
      default:
        return <Brain className="h-4 w-4 text-amber-600" />;
    }
  };

  const formatCategoryLabel = (category: string) => {
    return category
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="flex-1 flex flex-col antialiased">
      <main className="flex-1 container mx-auto max-w-5xl px-4 sm:px-6 py-6 pb-32 space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Brain className="h-4 w-4" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-foreground font-sans">
                Career Memory Vault & Personalization
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-sans">
              <span className="hidden sm:inline">
                Durable career profile context, education, experience, and academic bands BrowserPilot uses to filter and score opportunities.
              </span>
              <span className="sm:hidden">
                Durable career profile context.
              </span>
            </p>
          </div>

          <Link href="/app">
            <Button variant="outline" size="sm" className="font-sans font-medium text-xs gap-1.5 cursor-pointer">
              Back to Discover
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {/* Structured Career Memory Form */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-marble-1">
          <div className="border-b border-border/50 pb-3 mb-5">
            <h2 className="text-sm font-bold text-foreground font-sans flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Verified Background & Preference Constraints
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Specify your target roles, locations, skills, educational major, passing year, and CGPA equivalent percentage.
            </p>
          </div>
          <CareerMemoryForm onSaved={fetchMemories} />
        </div>

        {/* Section 2: What BrowserPilot Remembers */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground font-sans flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Active Stored Memory Vault Keys ({preferences.length})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                These explicit keys guide intelligent search planning and opportunity fit ranking across ATS sources.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchMemories}
              className="h-7 text-xs font-mono gap-1 text-muted-foreground cursor-pointer"
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
                No extra durable memories stored yet.
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                Fill out the structured form above to store your career memory profile.
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
                          <span className="text-[11px] font-sans font-medium text-muted-foreground">
                            {formatCategoryLabel(item.category)}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            ({item.key})
                          </span>
                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-emerald-700 border-emerald-500/30 bg-emerald-500/10">
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
                              className="h-8 text-xs font-mono cursor-pointer"
                            >
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingId(null)}
                              className="h-8 text-xs font-mono cursor-pointer"
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

        {/* Privacy & Invariants Notice */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground space-y-1.5 font-mono">
          <div className="flex items-center gap-1.5 text-foreground font-semibold">
            <Info className="h-3.5 w-3.5 text-primary" />
            <span>Memory Privacy & Invariant Guarantees:</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            1. <strong>Explicit Query Authority:</strong> When you search &ldquo;hybrid jobs&rdquo;, your active query overrides saved remote preferences.
            <br />
            2. <strong>Transient Searches:</strong> Routine searches like &ldquo;Find 5 jobs today&rdquo; never become permanent preferences.
            <br />
            3. <strong>Complete Tenant Isolation:</strong> Career context is strictly isolated to your authenticated account.
          </p>
        </div>
      </main>
    </div>
  );
}
