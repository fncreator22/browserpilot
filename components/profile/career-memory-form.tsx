"use client";

import { useState, useEffect } from "react";
import { 
  Briefcase, 
  MapPin, 
  Sparkles, 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  Award, 
  Clock, 
  Globe, 
  Check, 
  RotateCw, 
  Plus, 
  X,
  ShieldCheck,
  Building
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface CareerMemoryData {
  preferredRoles: string[];
  preferredLocations: string[];
  preferredWorkModes: string[];
  targetSkills: string[];
  yearsOfExperience: number;
  degree: string;
  coreSubject: string;
  graduationYear: string;
  cgpaBand: string;
}

const CGPA_BANDS = [
  { value: "5.0-5.9", label: "5.0 - 5.9", percentage: "50% - 59%" },
  { value: "6.0-6.9", label: "6.0 - 6.9", percentage: "60% - 69%" },
  { value: "7.0-7.9", label: "7.0 - 7.9", percentage: "70% - 79%" },
  { value: "8.0-8.9", label: "8.0 - 8.9", percentage: "80% - 89%" },
  { value: "9.0-10.0", label: "9.0 - 10.0", percentage: "90% - 100%" },
];

const COMMON_DEGREES = [
  "B.Tech / B.E.",
  "M.Tech / M.S.",
  "B.Sc / BS",
  "BCA / MCA",
  "MBA",
  "Ph.D.",
  "Diploma",
  "Self-Taught / Other",
];

const COMMON_PASSING_YEARS = [
  "2022",
  "2023",
  "2024",
  "2025",
  "2026",
  "2027",
  "2028",
];

const COMMON_CORE_SUBJECTS = [
  "Computer Science & Engineering",
  "Information Technology",
  "Artificial Intelligence & ML",
  "Data Science",
  "Electronics & Communication",
  "Electrical & Electronics",
  "Mechanical Engineering",
  "Mathematics & Computing",
  "Business & Management",
  "Other",
];

const EXPERIENCE_OPTIONS = [
  { value: 0, label: "0 Yrs (Fresher / Student)" },
  { value: 1, label: "1 Year" },
  { value: 2, label: "2 Years" },
  { value: 3, label: "3 Years" },
  { value: 4, label: "4 Years" },
  { value: 5, label: "5 Years" },
  { value: 6, label: "6 Years" },
  { value: 7, label: "7+ Years" },
];

interface CareerMemoryFormProps {
  onSaved?: () => void;
  className?: string;
}

export function CareerMemoryForm({ onSaved, className = "" }: CareerMemoryFormProps) {
  const [preferredRoles, setPreferredRoles] = useState<string[]>([]);
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [preferredWorkModes, setPreferredWorkModes] = useState<string[]>(["REMOTE"]);
  const [targetSkills, setTargetSkills] = useState<string[]>([]);
  const [yearsOfExperience, setYearsOfExperience] = useState<number>(0);
  const [degree, setDegree] = useState("B.Tech / B.E.");
  const [coreSubject, setCoreSubject] = useState("Computer Science & Engineering");
  const [graduationYear, setGraduationYear] = useState("2026");
  const [cgpaBand, setCgpaBand] = useState("8.0-8.9");

  const [newRole, setNewRole] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newSkill, setNewSkill] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing profile & memory attributes
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/account/profile");
        if (res.ok) {
          const data = await res.json();
          const p = data.personalization || data.profile || {};
          const cm = data.careerMemory || {};

          if (isMounted) {
            if (Array.isArray(p.preferredRoles) && p.preferredRoles.length > 0) {
              setPreferredRoles(p.preferredRoles);
            }
            if (Array.isArray(p.preferredLocations) && p.preferredLocations.length > 0) {
              setPreferredLocations(p.preferredLocations);
            }
            if (Array.isArray(p.preferredWorkModes) && p.preferredWorkModes.length > 0) {
              setPreferredWorkModes(p.preferredWorkModes);
            }
            if (Array.isArray(p.targetSkills) && p.targetSkills.length > 0) {
              setTargetSkills(p.targetSkills);
            }
            if (cm.yearsOfExperience !== undefined) {
              setYearsOfExperience(Number(cm.yearsOfExperience) || 0);
            } else if (p.experienceLevel === "ENTRY_LEVEL") {
              setYearsOfExperience(0);
            }
            if (cm.degree) setDegree(cm.degree);
            if (cm.coreSubject) setCoreSubject(cm.coreSubject);
            if (cm.graduationYear || p.graduationYear) {
              setGraduationYear(cm.graduationYear || p.graduationYear);
            }
            if (cm.cgpaBand) setCgpaBand(cm.cgpaBand);
          }
        }
      } catch {
        // Soft fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAddRole = () => {
    const val = newRole.trim();
    if (val && !preferredRoles.includes(val) && preferredRoles.length < 10) {
      setPreferredRoles([...preferredRoles, val]);
      setNewRole("");
    }
  };

  const handleRemoveRole = (role: string) => {
    setPreferredRoles(preferredRoles.filter((r) => r !== role));
  };

  const handleAddLocation = () => {
    const val = newLocation.trim();
    if (val && !preferredLocations.includes(val) && preferredLocations.length < 10) {
      setPreferredLocations([...preferredLocations, val]);
      setNewLocation("");
    }
  };

  const handleRemoveLocation = (loc: string) => {
    setPreferredLocations(preferredLocations.filter((l) => l !== loc));
  };

  const handleAddSkill = () => {
    const val = newSkill.trim();
    if (val && !targetSkills.includes(val) && targetSkills.length < 20) {
      setTargetSkills([...targetSkills, val]);
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setTargetSkills(targetSkills.filter((s) => s !== skill));
  };

  const toggleWorkMode = (mode: string) => {
    if (preferredWorkModes.includes(mode)) {
      if (preferredWorkModes.length > 1) {
        setPreferredWorkModes(preferredWorkModes.filter((m) => m !== mode));
      } else {
        toast.info("At least one work mode must be selected");
      }
    } else {
      setPreferredWorkModes([...preferredWorkModes, mode]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);

      const payload = {
        preferredRoles,
        preferredLocations,
        preferredWorkModes,
        targetSkills,
        yearsOfExperience,
        degree,
        coreSubject,
        graduationYear,
        cgpaBand,
        experienceLevel: yearsOfExperience === 0 ? "ENTRY_LEVEL" : yearsOfExperience < 3 ? "JUNIOR" : yearsOfExperience < 6 ? "MID_LEVEL" : "SENIOR",
        userCategory: yearsOfExperience === 0 ? "STUDENT" : "PROFESSIONAL",
      };

      // 1. Save to profile
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update profile memory");
      }

      // 2. Persist to User Memory Vault for AI Brain retrieval
      const memorySyncPromises = [
        fetch("/api/user/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "CAREER_PREFERENCE",
            key: "years_of_experience",
            value: `${yearsOfExperience} years (${yearsOfExperience === 0 ? "Fresher/Student" : "Experienced"})`,
            confidence: "EXPLICIT",
            importance: 0.95,
          }),
        }),
        fetch("/api/user/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "CAREER_PREFERENCE",
            key: "degree_education",
            value: `${degree} in ${coreSubject}, Class of ${graduationYear}`,
            confidence: "EXPLICIT",
            importance: 0.9,
          }),
        }),
        fetch("/api/user/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "CAREER_PREFERENCE",
            key: "academic_performance",
            value: `CGPA ${cgpaBand} (${CGPA_BANDS.find((b) => b.value === cgpaBand)?.percentage || "Converted Grade"})`,
            confidence: "EXPLICIT",
            importance: 0.85,
          }),
        }),
      ];

      if (preferredRoles.length > 0) {
        memorySyncPromises.push(
          fetch("/api/user/memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: "ROLE_PREFERENCE",
              key: "target_roles",
              value: preferredRoles.join(", "),
              confidence: "EXPLICIT",
              importance: 1.0,
            }),
          })
        );
      }

      if (preferredLocations.length > 0) {
        memorySyncPromises.push(
          fetch("/api/user/memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: "LOCATION_PREFERENCE",
              key: "preferred_locations",
              value: preferredLocations.join(", "),
              confidence: "EXPLICIT",
              importance: 0.9,
            }),
          })
        );
      }

      await Promise.allSettled(memorySyncPromises);

      toast.success("Career Memory Saved Successfully", {
        description: "Discovery search ranking and AI evaluations now use your verified context.",
      });

      onSaved?.();
    } catch (err: unknown) {
      toast.error("Failed to save career memory", {
        description: (err as Error).message || "An unexpected error occurred.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCgpaDetails = CGPA_BANDS.find((b) => b.value === cgpaBand) || CGPA_BANDS[3];

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground font-sans">
        <RotateCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
        <p className="text-xs font-mono">Loading your career profile context...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-5 font-sans ${className}`}>
      {/* Target Roles */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-xs">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            Target Job Roles
          </label>
          <span className="text-[10px] font-mono text-muted-foreground">Up to 10 roles</span>
        </div>
        <div className="flex gap-2">
          <Input
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddRole();
              }
            }}
            placeholder="e.g. Software Engineer, Backend Developer"
            className="text-xs font-sans h-8"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRole}
            className="h-8 text-xs font-sans px-3 shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {preferredRoles.map((role) => (
            <Badge
              key={role}
              variant="outline"
              className="text-xs font-medium py-1 px-2.5 bg-primary/5 text-primary border-primary/20 flex items-center gap-1.5"
            >
              <span>{role}</span>
              <button
                type="button"
                onClick={() => handleRemoveRole(role)}
                className="hover:text-rose-600 cursor-pointer rounded"
                aria-label={`Remove ${role}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {preferredRoles.length === 0 && (
            <span className="text-xs text-muted-foreground italic">No roles added yet. Add roles above to focus discovery.</span>
          )}
        </div>
      </div>

      {/* Target Locations & Work Modes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Preferred Locations */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Target Locations
            </label>
            <span className="text-[10px] font-mono text-muted-foreground">Up to 10</span>
          </div>
          <div className="flex gap-2">
            <Input
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddLocation();
                }
              }}
              placeholder="e.g. Bengaluru, Remote, London"
              className="text-xs font-sans h-8"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLocation}
              className="h-8 text-xs font-sans px-3 shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {preferredLocations.map((loc) => (
              <Badge
                key={loc}
                variant="outline"
                className="text-xs font-medium py-1 px-2.5 bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5"
              >
                <span>{loc}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveLocation(loc)}
                  className="hover:text-rose-600 cursor-pointer rounded"
                  aria-label={`Remove ${loc}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {preferredLocations.length === 0 && (
              <span className="text-xs text-muted-foreground italic">Global / Any Location</span>
            )}
          </div>
        </div>

        {/* Work Modes */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-xs">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-primary" />
            Accepted Work Modes
          </label>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { id: "REMOTE", label: "Remote" },
              { id: "HYBRID", label: "Hybrid" },
              { id: "ON_SITE", label: "On-Site" },
            ].map((mode) => {
              const active = preferredWorkModes.includes(mode.id);
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => toggleWorkMode(mode.id)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/40 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {active && <Check className="h-3 w-3" />}
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Select all modes you are open to accepting.
          </p>
        </div>
      </div>

      {/* Target Skills */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-xs">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Technical & Domain Skills
          </label>
          <span className="text-[10px] font-mono text-muted-foreground">Up to 20 skills</span>
        </div>
        <div className="flex gap-2">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSkill();
              }
            }}
            placeholder="e.g. React, Next.js, Python, PostgreSQL, AWS"
            className="text-xs font-sans h-8"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSkill}
            className="h-8 text-xs font-sans px-3 shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {targetSkills.map((sk) => (
            <Badge
              key={sk}
              variant="outline"
              className="text-xs font-medium py-1 px-2.5 bg-slate-100 text-slate-800 border-slate-200 flex items-center gap-1.5"
            >
              <span>{sk}</span>
              <button
                type="button"
                onClick={() => handleRemoveSkill(sk)}
                className="hover:text-rose-600 cursor-pointer rounded"
                aria-label={`Remove ${sk}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {targetSkills.length === 0 && (
            <span className="text-xs text-muted-foreground italic">Add your core technical skills to sharpen fit scores.</span>
          )}
        </div>
      </div>

      {/* Experience, Degree, Core Subject & Passing Year */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Years of Experience */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Years of Experience
            </label>
            <Badge variant="outline" className="text-[10px] font-mono bg-primary/5 text-primary border-primary/20">
              {yearsOfExperience === 0 ? "Fresher / 0 Yrs" : `${yearsOfExperience} Yrs Exp`}
            </Badge>
          </div>
          <select
            value={yearsOfExperience}
            onChange={(e) => setYearsOfExperience(Number(e.target.value))}
            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-sans text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
          >
            {EXPERIENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            {yearsOfExperience === 0
              ? "Configured for fresh graduate / student hiring filters."
              : `Configured for ${yearsOfExperience}+ year professional criteria.`}
          </p>
        </div>

        {/* Degree */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
            Degree Qualification
          </label>
          <select
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-sans text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
          >
            {COMMON_DEGREES.map((deg) => (
              <option key={deg} value={deg}>
                {deg}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Used to match educational prerequisites on ATS postings.
          </p>
        </div>

        {/* Core Subject / Major */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            Core Subject / Stream
          </label>
          <select
            value={coreSubject}
            onChange={(e) => setCoreSubject(e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-sans text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
          >
            {COMMON_CORE_SUBJECTS.map((subj) => (
              <option key={subj} value={subj}>
                {subj}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Specifies your major for domain specialization checks.
          </p>
        </div>

        {/* Passing Year */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-xs">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            Graduation / Passing Year
          </label>
          <select
            value={graduationYear}
            onChange={(e) => setGraduationYear(e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-sans text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
          >
            {COMMON_PASSING_YEARS.map((yr) => (
              <option key={yr} value={yr}>
                Class of {yr}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Filters out expired batch requisitions and off-campus cohorts.
          </p>
        </div>
      </div>

      {/* CGPA Band & Auto-Computed Percentage Conversion */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-primary" />
              Academic Grade / CGPA Band
            </label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Select your 10-point scale CGPA band. Percentage equivalent is automatically computed for ATS matching.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono shrink-0">
            <span className="font-semibold">{selectedCgpaDetails.label} CGPA</span>
            <span>=</span>
            <span className="font-bold underline">{selectedCgpaDetails.percentage}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
          {CGPA_BANDS.map((band) => {
            const isSelected = cgpaBand === band.value;
            return (
              <button
                key={band.value}
                type="button"
                onClick={() => setCgpaBand(band.value)}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary"
                    : "bg-muted/30 text-foreground border-border hover:border-primary/40 hover:bg-muted/60"
                }`}
              >
                <div className="text-xs font-bold font-mono">{band.label}</div>
                <div className={`text-[10px] mt-0.5 ${isSelected ? "text-primary-foreground/90 font-medium" : "text-muted-foreground font-mono"}`}>
                  {band.percentage}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit Action Bar */}
      <div className="pt-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-sans">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Tenant-isolated and encrypted. Updates discovery fit scoring instantly.</span>
        </div>

        <Button
          type="submit"
          disabled={isSaving}
          className="h-9 font-sans text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg cursor-pointer shadow-marble-1 gap-1.5 px-4"
        >
          {isSaving ? (
            <>
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
              <span>Saving Preferences...</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Save Career Memory</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
