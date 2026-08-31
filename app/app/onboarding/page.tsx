"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { 
  Bot, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Sparkles, 
  Compass, 
  GraduationCap, 
  Briefcase, 
  Search, 
  Building2, 
  Rocket, 
  Users, 
  BookOpen, 
  Globe, 
  Share2, 
  Code, 
  HelpCircle,
  Laptop,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ACQUISITION_OPTIONS = [
  { id: "SEARCH_ENGINE", label: "Search Engine (Google, etc.)", icon: Search },
  { id: "GITHUB", label: "GitHub / Open Source", icon: Code },
  { id: "SOCIAL_MEDIA", label: "Social Media (X, LinkedIn)", icon: Share2 },
  { id: "FRIEND_COLLEAGUE", label: "Friend or Colleague", icon: Users },
  { id: "UNIVERSITY", label: "University / College", icon: GraduationCap },
  { id: "COMMUNITY", label: "Developer Community", icon: Globe },
  { id: "PRODUCT_RECOMMENDATION", label: "Product Recommendation", icon: Sparkles },
  { id: "OTHER", label: "Other Source", icon: HelpCircle },
];

const USER_CATEGORY_OPTIONS = [
  { id: "STUDENT", label: "Student", desc: "Enrolled in college, university, or bootcamp", icon: GraduationCap },
  { id: "JOB_SEEKER", label: "Job Seeker", desc: "Actively looking for my next role", icon: Search },
  { id: "PROFESSIONAL", label: "Working Professional", desc: "Employed and exploring opportunities", icon: Briefcase },
  { id: "FOUNDER", label: "Founder / Entrepreneur", desc: "Building a company or hiring talent", icon: Rocket },
  { id: "RECRUITER", label: "Recruiter / Talent Lead", desc: "Sourcing candidate pools", icon: Users },
  { id: "COMPANY_ORG", label: "Company / Organization", desc: "Enterprise discovery & monitoring", icon: Building2 },
  { id: "RESEARCHER", label: "Researcher / Academic", desc: "Market & technology research", icon: BookOpen },
  { id: "OTHER", label: "Other", desc: "General exploratory usage", icon: Compass },
];

const USAGE_CONTEXT_OPTIONS = [
  { id: "INTERNSHIPS", label: "Looking for Internships", desc: "Summer & off-season student programs" },
  { id: "FULL_TIME_JOBS", label: "Looking for Full-Time Roles", desc: "Permanent engineering and product positions" },
  { id: "CONTRACT_OPPORTUNITIES", label: "Contract & Freelance", desc: "Flexible remote project engagements" },
  { id: "MONITORING_COMPANIES", label: "Monitoring Specific Companies", desc: "Track target startups and tech leaders" },
  { id: "EXPLORING_OPPORTUNITIES", label: "Exploring the Job Market", desc: "Passive discovery and salary benchmarking" },
  { id: "RECRUITING", label: "Hiring & Talent Sourcing", desc: "Discovering candidates and market postings" },
  { id: "RESEARCH_MARKET", label: "Market Research & Intelligence", desc: "Industry analysis and talent movement" },
  { id: "OTHER", label: "General Exploration", desc: "Navigating opportunities across platforms" },
];

const EXPERIENCE_LEVELS = [
  { id: "INTERN", label: "Intern / Student" },
  { id: "ENTRY_LEVEL", label: "Entry Level (0-2 yrs)" },
  { id: "MID_LEVEL", label: "Mid Level (3-5 yrs)" },
  { id: "SENIOR", label: "Senior Level (5-8 yrs)" },
  { id: "EXECUTIVE", label: "Lead / Executive (8+ yrs)" },
];

const WORK_MODE_OPTIONS = [
  { id: "ANY", label: "Any Work Mode" },
  { id: "REMOTE", label: "Remote Only" },
  { id: "HYBRID", label: "Hybrid" },
  { id: "ON_SITE", label: "On-Site" },
];

const ORGANIZATION_SIZES = [
  { id: "SOLO", label: "Solo / 1 person" },
  { id: "SIZE_2_10", label: "2 – 10 employees" },
  { id: "SIZE_11_50", label: "11 – 50 employees" },
  { id: "SIZE_51_200", label: "51 – 200 employees" },
  { id: "SIZE_201_500", label: "201 – 500 employees" },
  { id: "SIZE_501_1000", label: "501 – 1,000 employees" },
  { id: "SIZE_1000_PLUS", label: "1,000+ employees" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [step, setStep] = useState(1);
  const [acquisitionSource, setAcquisitionSource] = useState("");
  const [userCategory, setUserCategory] = useState("");
  const [usageContext, setUsageContext] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("ENTRY_LEVEL");
  const [workModes, setWorkModes] = useState<string[]>(["REMOTE"]);
  const [targetSkillsInput, setTargetSkillsInput] = useState("");
  const [preferredRolesInput, setPreferredRolesInput] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSize, setOrganizationSize] = useState("SIZE_2_10");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check if user already completed onboarding
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/account/onboarding")
        .then((r) => r.json())
        .then((data) => {
          if (data.profile) {
            if (data.profile.acquisitionSource) setAcquisitionSource(data.profile.acquisitionSource);
            if (data.profile.userCategory) setUserCategory(data.profile.userCategory);
            if (data.profile.usageContext) setUsageContext(data.profile.usageContext);
            if (data.profile.experienceLevel) setExperienceLevel(data.profile.experienceLevel);
            if (data.profile.organizationName) setOrganizationName(data.profile.organizationName);
            if (data.profile.organizationSize) setOrganizationSize(data.profile.organizationSize);
            if (data.profile.targetSkills?.length) setTargetSkillsInput(data.profile.targetSkills.join(", "));
            if (data.profile.preferredRoles?.length) setPreferredRolesInput(data.profile.preferredRoles.join(", "));
            if (data.profile.preferredWorkModes?.length) setWorkModes(data.profile.preferredWorkModes);
          }
        })
        .catch(() => {});
    }
  }, [status]);

  const isOrgUser = userCategory === "FOUNDER" || userCategory === "RECRUITER" || userCategory === "COMPANY_ORG";

  const handleNext = () => {
    setErrorMsg(null);
    if (step === 1 && !acquisitionSource) {
      setErrorMsg("Please select how you discovered BrowserPilot.");
      return;
    }
    if (step === 2 && !userCategory) {
      setErrorMsg("Please select a category that describes you best.");
      return;
    }
    if (step === 3 && !usageContext) {
      setErrorMsg("Please select your primary goal with BrowserPilot.");
      return;
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const handleBack = () => {
    setErrorMsg(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const parsedSkills = targetSkillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const parsedRoles = preferredRolesInput
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/account/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acquisitionSource: acquisitionSource || "OTHER",
          userCategory: userCategory || "JOB_SEEKER",
          usageContext: usageContext || "EXPLORING_OPPORTUNITIES",
          experienceLevel: !isOrgUser ? experienceLevel : undefined,
          preferredRoles: !isOrgUser ? parsedRoles : undefined,
          preferredWorkModes: !isOrgUser ? workModes : undefined,
          targetSkills: !isOrgUser ? parsedSkills : undefined,
          organizationName: isOrgUser ? organizationName.trim() || undefined : undefined,
          organizationSize: isOrgUser ? organizationSize : undefined,
          onboardingCompleted: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.message || "Failed to save personalization settings.");
        setIsSubmitting(false);
        return;
      }

      router.push("/app");
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  const toggleWorkMode = (mode: string) => {
    if (mode === "ANY") {
      setWorkModes(["ANY"]);
      return;
    }
    setWorkModes((prev) => {
      const filtered = prev.filter((m) => m !== "ANY");
      if (filtered.includes(mode)) {
        const next = filtered.filter((m) => m !== mode);
        return next.length === 0 ? ["ANY"] : next;
      } else {
        return [...filtered, mode];
      }
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-10 font-sans selection:bg-primary/20 selection:text-primary">
      {/* Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-2">
        <Link href="/app" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
            <Bot className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            BrowserPilot
          </span>
        </Link>
        <Link href="/app" className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
          Skip for now →
        </Link>
      </header>

      {/* Main Card Container */}
      <main className="max-w-2xl w-full mx-auto my-auto py-8">
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-xs space-y-6">
          {/* Progress Bar & Step Label */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Step {step} of 5</span>
              <span>{Math.round((step / 5) * 100)}% complete</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>

          {/* STEP 1: Discovery Source */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h1 className="text-lg font-bold tracking-tight text-foreground">
                  How did you hear about BrowserPilot?
                </h1>
                <p className="text-xs text-muted-foreground">
                  Help us understand how you found our autonomous discovery platform.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                {ACQUISITION_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = acquisitionSource === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAcquisitionSource(opt.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left text-xs font-mono transition-colors cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 text-foreground font-semibold"
                          : "border-border/80 bg-background hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 ml-auto text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: User Category */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h1 className="text-lg font-bold tracking-tight text-foreground">
                  How would you describe yourself?
                </h1>
                <p className="text-xs text-muted-foreground">
                  We'll tailor your discovery workspace and ranking model to your role.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                {USER_CATEGORY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = userCategory === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setUserCategory(opt.id)}
                      className={`flex items-start gap-3 p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/80 bg-background hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="text-xs font-semibold font-mono text-foreground flex items-center justify-between">
                          <span>{opt.label}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Usage Purpose */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h1 className="text-lg font-bold tracking-tight text-foreground">
                  What is your primary goal?
                </h1>
                <p className="text-xs text-muted-foreground">
                  Select the main objective you want BrowserPilot to help you accomplish.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                {USAGE_CONTEXT_OPTIONS.map((opt) => {
                  const isSelected = usageContext === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setUsageContext(opt.id)}
                      className={`flex items-start gap-3 p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/80 bg-background hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="text-xs font-semibold font-mono text-foreground flex items-center justify-between">
                          <span>{opt.label}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-tight">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Conditional Career or Organization Context */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h1 className="text-lg font-bold tracking-tight text-foreground">
                  {isOrgUser ? "Organization Context" : "Experience & Discovery Context"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {isOrgUser
                    ? "Provide organization context to assist with candidate sourcing and monitoring."
                    : "Add optional preferences to improve initial search relevance."}
                </p>
              </div>

              {isOrgUser ? (
                /* Organization Fields */
                <div className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono font-semibold text-foreground block">
                      Organization / Company Name
                    </label>
                    <Input
                      placeholder="e.g. Acme AI Labs"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      className="h-9 text-xs font-mono bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono font-semibold text-foreground block">
                      Organization Size
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ORGANIZATION_SIZES.map((sz) => (
                        <button
                          key={sz.id}
                          type="button"
                          onClick={() => setOrganizationSize(sz.id)}
                          className={`p-2 rounded-lg border text-left text-xs font-mono transition-colors cursor-pointer ${
                            organizationSize === sz.id
                              ? "border-primary bg-primary/10 text-foreground font-semibold"
                              : "border-border/80 bg-background hover:bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          {sz.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Individual Career / Student Fields */
                <div className="space-y-4 pt-1">
                  {/* Experience Level */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-semibold text-foreground block">
                      Experience Level
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {EXPERIENCE_LEVELS.map((exp) => (
                        <button
                          key={exp.id}
                          type="button"
                          onClick={() => setExperienceLevel(exp.id)}
                          className={`p-2 rounded-lg border text-left text-xs font-mono transition-colors cursor-pointer ${
                            experienceLevel === exp.id
                              ? "border-primary bg-primary/10 text-foreground font-semibold"
                              : "border-border/80 bg-background hover:bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          {exp.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Work Modes */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-semibold text-foreground block">
                      Preferred Work Mode
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {WORK_MODE_OPTIONS.map((wm) => {
                        const isSel = workModes.includes(wm.id);
                        return (
                          <button
                            key={wm.id}
                            type="button"
                            onClick={() => toggleWorkMode(wm.id)}
                            className={`p-2 rounded-lg border text-center text-xs font-mono transition-colors cursor-pointer ${
                              isSel
                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                : "border-border/80 bg-background hover:bg-muted/40 text-muted-foreground"
                            }`}
                          >
                            {wm.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preferred Roles & Skills */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-semibold text-foreground block">
                        Target Roles (optional)
                      </label>
                      <Input
                        placeholder="e.g. AI Engineer, Full Stack"
                        value={preferredRolesInput}
                        onChange={(e) => setPreferredRolesInput(e.target.value)}
                        className="h-9 text-xs font-mono bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-semibold text-foreground block">
                        Key Skills (optional)
                      </label>
                      <Input
                        placeholder="e.g. React, Python, PyTorch"
                        value={targetSkillsInput}
                        onChange={(e) => setTargetSkillsInput(e.target.value)}
                        className="h-9 text-xs font-mono bg-background"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Review & Confirmation */}
          {step === 5 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Ready to launch BrowserPilot
                </h1>
                <p className="text-xs text-muted-foreground">
                  Review your personalization profile before entering the autonomous discovery workspace.
                </p>
              </div>

              {/* Summary Card */}
              <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-3 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground block">User Category</span>
                    <span className="font-semibold text-foreground">
                      {USER_CATEGORY_OPTIONS.find((c) => c.id === userCategory)?.label || userCategory}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground block">Primary Goal</span>
                    <span className="font-semibold text-foreground">
                      {USAGE_CONTEXT_OPTIONS.find((u) => u.id === usageContext)?.label || usageContext}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground block">Acquisition Source</span>
                    <span className="font-semibold text-foreground">
                      {ACQUISITION_OPTIONS.find((a) => a.id === acquisitionSource)?.label || acquisitionSource}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground block">
                      {isOrgUser ? "Organization" : "Experience Level"}
                    </span>
                    <span className="font-semibold text-foreground">
                      {isOrgUser
                        ? `${organizationName || "Not specified"} (${organizationSize})`
                        : EXPERIENCE_LEVELS.find((e) => e.id === experienceLevel)?.label || experienceLevel}
                    </span>
                  </div>
                </div>

                {!isOrgUser && (preferredRolesInput || targetSkillsInput) && (
                  <div className="pt-2 border-t border-border/50 space-y-1">
                    {preferredRolesInput && (
                      <p className="text-muted-foreground">
                        <span className="text-[10px] uppercase block">Preferred Roles:</span>
                        <span className="text-foreground">{preferredRolesInput}</span>
                      </p>
                    )}
                    {targetSkillsInput && (
                      <p className="text-muted-foreground">
                        <span className="text-[10px] uppercase block">Target Skills:</span>
                        <span className="text-foreground">{targetSkillsInput}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-mono">
              {errorMsg}
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBack}
                className="h-9 px-4 font-mono text-xs gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < 5 ? (
              <Button
                type="button"
                size="sm"
                onClick={handleNext}
                className="h-9 px-5 font-mono text-xs font-semibold gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continue
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="h-9 px-6 font-mono text-xs font-semibold gap-2 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-background border-t-transparent animate-spin" />
                    Launching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Enter Workspace
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs font-mono text-muted-foreground py-4">
        BrowserPilot Autonomous Discovery & Monitoring Platform
      </footer>
    </div>
  );
}
