"use client";

import { useState, useEffect } from "react";
import { 
  Brain, 
  RotateCw, 
  Plus, 
  Trash2, 
  Edit2, 
  Sparkles, 
  Search, 
  Tag, 
  Briefcase, 
  CheckCircle2, 
  Layers, 
  BookOpen, 
  ArrowRight,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface TaxonomyRole {
  canonicalTitle: string;
  aliases: string[];
  seniorityLevels?: string[];
  coOccurringSkills: string[];
  observedCount: number;
  isDynamicallyLearned: boolean;
  discoveredFromPortals: string[];
  firstObservedAt: string;
  lastObservedAt: string;
}

interface TaxonomyCategory {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  roles: Record<string, TaxonomyRole>;
}

interface TaxonomyDepartment {
  id: string;
  name: string;
  description: string;
  categories: Record<string, TaxonomyCategory>;
}

interface TaxonomySummary {
  version: string;
  lastUpdatedAt: string;
  totalDepartments: number;
  totalCategories: number;
  totalRoles: number;
  dynamicallyLearnedRoles: number;
}

export default function AdminTaxonomyPage() {
  const [departments, setDepartments] = useState<Record<string, TaxonomyDepartment>>({});
  const [summary, setSummary] = useState<TaxonomySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState("");

  // New Category Form Modal State
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatId, setNewCatId] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatKeywords, setNewCatKeywords] = useState("");

  // New Role Form State
  const [activeCatForNewRole, setActiveCatForNewRole] = useState<string | null>(null);
  const [newRoleTitle, setNewRoleTitle] = useState("");
  const [newRoleAliases, setNewRoleAliases] = useState("");
  const [newRoleSkills, setNewRoleSkills] = useState("");

  const getAdminKey = () => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("admin_key");
    }
    return null;
  };

  const loadTaxonomy = async () => {
    setLoading(true);
    try {
      const adminKey = getAdminKey();
      const url = `/api/ops-sec-7f9c2d1b8e4a/taxonomy${adminKey ? `?admin_key=${adminKey}` : ""}`;
      const res = await fetch(url, {
        headers: adminKey ? { "x-admin-key": adminKey } : {},
      });

      if (!res.ok) {
        throw new Error(`Failed to load taxonomy (HTTP ${res.status})`);
      }

      const data = await res.json();
      setDepartments(data.departments || {});
      setSummary(data.summary || null);
      if (!selectedDeptId && data.departments) {
        const firstDept = Object.keys(data.departments)[0];
        if (firstDept) setSelectedDeptId(firstDept);
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Error fetching career taxonomy");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaxonomy();
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId || !newCatName.trim()) {
      toast.error("Department and Category name required");
      return;
    }

    const generatedId = newCatId.trim() || newCatName.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
    const adminKey = getAdminKey();

    try {
      const res = await fetch(`/api/ops-sec-7f9c2d1b8e4a/taxonomy${adminKey ? `?admin_key=${adminKey}` : ""}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {}),
        },
        body: JSON.stringify({
          action: "ADD_CATEGORY",
          departmentId: selectedDeptId,
          id: generatedId,
          name: newCatName.trim(),
          description: newCatDesc.trim(),
          keywords: newCatKeywords.split(",").map((k) => k.trim()).filter(Boolean),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to create category");
      }

      toast.success(`Category '${newCatName}' created successfully!`);
      setShowAddCategoryModal(false);
      setNewCatId("");
      setNewCatName("");
      setNewCatDesc("");
      setNewCatKeywords("");
      loadTaxonomy();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to create category");
    }
  };

  const handleCreateRole = async (catId: string) => {
    if (!newRoleTitle.trim()) {
      toast.error("Role title required");
      return;
    }

    const adminKey = getAdminKey();
    try {
      const res = await fetch(`/api/ops-sec-7f9c2d1b8e4a/taxonomy${adminKey ? `?admin_key=${adminKey}` : ""}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {}),
        },
        body: JSON.stringify({
          action: "ADD_ROLE",
          departmentId: selectedDeptId,
          categoryId: catId,
          canonicalTitle: newRoleTitle.trim(),
          aliases: newRoleAliases.split(",").map((a) => a.trim()).filter(Boolean),
          coOccurringSkills: newRoleSkills.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to add role");
      }

      toast.success(`Role '${newRoleTitle}' added to taxonomy!`);
      setActiveCatForNewRole(null);
      setNewRoleTitle("");
      setNewRoleAliases("");
      setNewRoleSkills("");
      loadTaxonomy();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to add role");
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (!confirm(`Are you sure you want to delete category '${catName}'? All nested roles will be removed.`)) return;

    const adminKey = getAdminKey();
    try {
      const res = await fetch(`/api/ops-sec-7f9c2d1b8e4a/taxonomy${adminKey ? `?admin_key=${adminKey}` : ""}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {}),
        },
        body: JSON.stringify({
          action: "DELETE_CATEGORY",
          departmentId: selectedDeptId,
          categoryId: catId,
        }),
      });

      if (!res.ok) throw new Error("Failed to delete category");
      toast.info(`Deleted category '${catName}'`);
      loadTaxonomy();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete category");
    }
  };

  const handleDeleteRole = async (catId: string, roleSlug: string, roleTitle: string) => {
    if (!confirm(`Remove role '${roleTitle}' from brain taxonomy?`)) return;

    const adminKey = getAdminKey();
    try {
      const res = await fetch(`/api/ops-sec-7f9c2d1b8e4a/taxonomy${adminKey ? `?admin_key=${adminKey}` : ""}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(adminKey ? { "x-admin-key": adminKey } : {}),
        },
        body: JSON.stringify({
          action: "DELETE_ROLE",
          departmentId: selectedDeptId,
          categoryId: catId,
          roleSlug,
        }),
      });

      if (!res.ok) throw new Error("Failed to delete role");
      toast.info(`Removed role '${roleTitle}'`);
      loadTaxonomy();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete role");
    }
  };

  const currentDept = departments[selectedDeptId];
  const categoriesList = currentDept ? Object.values(currentDept.categories) : [];

  const filteredCategories = categoriesList.filter((cat) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const inName = cat.name.toLowerCase().includes(q);
    const inDesc = cat.description.toLowerCase().includes(q);
    const inKeywords = cat.keywords.some((k) => k.toLowerCase().includes(q));
    const inRoles = Object.values(cat.roles).some(
      (r) =>
        r.canonicalTitle.toLowerCase().includes(q) ||
        r.aliases.some((a) => a.toLowerCase().includes(q)) ||
        r.coOccurringSkills.some((s) => s.toLowerCase().includes(q))
    );
    return inName || inDesc || inKeywords || inRoles;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-200">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Job Category Brain & Taxonomy
              </h1>
              <p className="text-xs text-muted-foreground">
                Self-expanding career knowledge graph: tune departments, categories, and real-time learned market roles.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadTaxonomy}
            disabled={loading}
            className="h-8 text-xs font-mono gap-1.5"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddCategoryModal(true)}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3.5 border-border/70 bg-card">
            <span className="text-[11px] font-mono text-muted-foreground uppercase">Total Departments</span>
            <div className="text-xl font-bold font-mono text-foreground mt-0.5">{summary.totalDepartments}</div>
          </Card>
          <Card className="p-3.5 border-border/70 bg-card">
            <span className="text-[11px] font-mono text-muted-foreground uppercase">Categories</span>
            <div className="text-xl font-bold font-mono text-foreground mt-0.5">{summary.totalCategories}</div>
          </Card>
          <Card className="p-3.5 border-border/70 bg-card">
            <span className="text-[11px] font-mono text-muted-foreground uppercase">Standard Roles</span>
            <div className="text-xl font-bold font-mono text-foreground mt-0.5">{summary.totalRoles}</div>
          </Card>
          <Card className="p-3.5 border-purple-200/80 bg-purple-50/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-purple-700 uppercase">Self-Learned Roles</span>
              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <div className="text-xl font-bold font-mono text-purple-900 mt-0.5">{summary.dynamicallyLearnedRoles}</div>
          </Card>
        </div>
      )}

      {/* Department Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {Object.values(departments).map((dept) => (
            <button
              key={dept.id}
              onClick={() => setSelectedDeptId(dept.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedDeptId === dept.id
                  ? "bg-emerald-600 text-white shadow-xs font-semibold"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {dept.name} ({Object.keys(dept.categories).length})
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search roles or skills..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="h-8 pl-8 font-sans text-xs bg-card"
          />
        </div>
      </div>

      {/* Categories Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-muted-foreground">Loading brain taxonomy...</div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
          No categories or roles match the current filter in this department.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredCategories.map((cat) => {
            const rolesList = Object.entries(cat.roles);
            return (
              <Card key={cat.id} className="border-border/70 shadow-xs overflow-hidden">
                <CardHeader className="bg-muted/30 pb-3.5 border-b border-border/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold text-foreground">{cat.name}</CardTitle>
                        <Badge variant="outline" className="font-mono text-[10px] bg-background">
                          {rolesList.length} roles
                        </Badge>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        {cat.description}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveCatForNewRole(activeCatForNewRole === cat.id ? null : cat.id)}
                        className="h-7 text-xs font-sans gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add Role
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Keywords Badges */}
                  {cat.keywords.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2">
                      <span className="text-[10px] font-mono text-muted-foreground">Keywords:</span>
                      {cat.keywords.map((k) => (
                        <span
                          key={k}
                          className="text-[10px] font-mono bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded border border-border/40"
                        >
                          #{k}
                        </span>
                      ))}
                    </div>
                  )}
                </CardHeader>

                {/* Inline Add Role Form */}
                {activeCatForNewRole === cat.id && (
                  <div className="p-4 bg-muted/20 border-b border-border/60 space-y-3">
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 text-primary" />
                      Add Role to {cat.name}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <Input
                        placeholder="Role Title (e.g. Staff DevOps Engineer)"
                        value={newRoleTitle}
                        onChange={(e) => setNewRoleTitle(e.target.value)}
                        className="h-8 text-xs font-sans"
                      />
                      <Input
                        placeholder="Aliases comma-separated (e.g. SRE, Cloud SWE)"
                        value={newRoleAliases}
                        onChange={(e) => setNewRoleAliases(e.target.value)}
                        className="h-8 text-xs font-sans"
                      />
                      <Input
                        placeholder="Skills comma-separated (e.g. Terraform, AWS, K8s)"
                        value={newRoleSkills}
                        onChange={(e) => setNewRoleSkills(e.target.value)}
                        className="h-8 text-xs font-sans"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveCatForNewRole(null)}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleCreateRole(cat.id)}
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Save Role
                      </Button>
                    </div>
                  </div>
                )}

                {/* Roles Table */}
                <CardContent className="p-0">
                  <div className="divide-y divide-border/40 text-xs">
                    {rolesList.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground font-mono">
                        No roles configured in this category yet.
                      </div>
                    ) : (
                      rolesList.map(([roleSlug, role]) => (
                        <div
                          key={roleSlug}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/15 transition-colors"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground font-sans">
                                {role.canonicalTitle}
                              </span>
                              {role.isDynamicallyLearned && (
                                <Badge className="bg-purple-100 text-purple-800 text-[10px] font-mono border-purple-200">
                                  Auto-Learned
                                </Badge>
                              )}
                              <span className="text-[10px] font-mono text-muted-foreground">
                                Observed: {role.observedCount}x
                              </span>
                            </div>

                            {/* Aliases */}
                            {role.aliases.length > 0 && (
                              <div className="text-[11px] text-muted-foreground">
                                <span className="font-mono text-[10px] text-foreground/70">Aliases: </span>
                                {role.aliases.join(", ")}
                              </div>
                            )}

                            {/* Co-occurring Skills */}
                            {role.coOccurringSkills.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {role.coOccurringSkills.slice(0, 8).map((sk) => (
                                  <span
                                    key={sk}
                                    className="text-[10px] font-mono bg-background text-foreground/80 px-1.5 py-0.5 rounded border border-border/50"
                                  >
                                    {sk}
                                  </span>
                                ))}
                                {role.coOccurringSkills.length > 8 && (
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    +{role.coOccurringSkills.length - 8} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteRole(cat.id, roleSlug, role.canonicalTitle)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border shadow-lg max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div>
              <h3 className="text-base font-bold text-foreground">Add New Job Category</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Register a category in department &apos;{currentDept?.name}&apos; to widen natural language targeting.
              </p>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Category Name *</label>
                <Input
                  placeholder="e.g. Autonomous AI & Agentic Systems"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="text-xs font-sans"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Category Slug ID (Optional)</label>
                <Input
                  placeholder="e.g. autonomous_ai_systems"
                  value={newCatId}
                  onChange={(e) => setNewCatId(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <Input
                  placeholder="Scope of roles and architectures in this domain..."
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="text-xs font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Keywords (comma-separated)</label>
                <Input
                  placeholder="agentic, autonomous, swarm, langchain, crewai, llm"
                  value={newCatKeywords}
                  onChange={(e) => setNewCatKeywords(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Create Category
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
