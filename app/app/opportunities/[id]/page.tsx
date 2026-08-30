"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Building,
  CheckCircle2,
  ExternalLink,
  Layers,
  MapPin,
  Maximize2,
  ShieldCheck,
  Sparkles,
  Camera,
  Calendar,
  DollarSign,
  Briefcase,
  X,
  RotateCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface SourceListingItem {
  id?: string;
  sourcePlatform: string;
  sourceUrl: string;
  applyUrl?: string | null;
  externalJobId?: string | null;
  verificationStatus?: string | null;
  screenshotPath?: string | null;
  rawSnippet?: string | null;
  seenAt: string;
}

interface OpportunityDetail {
  id: string;
  canonicalHash: string;
  title: string;
  companyName: string;
  location?: string | null;
  workMode?: string | null;
  experienceLevel?: string | null;
  opportunityType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  description?: string | null;
  requirements?: string[];
  skills?: string[];
  primaryApplyUrl?: string | null;
  status: string;
  firstSeenAt: string;
  lastVerifiedAt?: string | null;
  saved: boolean;
  sourceListings: SourceListingItem[];
}

export default function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const oppId = resolvedParams.id;
  const router = useRouter();

  const [opportunity, setOpportunity] = useState<OpportunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const handleRevalidate = async () => {
    if (!opportunity) return;
    try {
      setIsRevalidating(true);
      const res = await fetch(`/api/opportunities/${opportunity.id}/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("Please sign in to revalidate opportunities.");
          return;
        }
        throw new Error("Revalidation failed");
      }
      const data = await res.json();
      if (data.opportunity) {
        setOpportunity(data.opportunity);
      }
      const summary = data.revalidation;
      if (summary?.newStatus === "EXPIRED") {
        toast.error("Status updated: All sources have expired or been closed.");
      } else if (summary?.newStatus === "ACTIVE") {
        toast.success("Live status verified: Opportunity is active!");
      } else {
        toast.info(`Revalidation complete: ${summary?.newStatus || "Checked"}`);
      }
    } catch {
      toast.error("Could not complete live revalidation.");
    } finally {
      setIsRevalidating(false);
    }
  };

  useEffect(() => {
    async function loadOpportunity() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/opportunities/${oppId}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Opportunity not found.");
          }
          throw new Error("Failed to load opportunity details.");
        }
        const data = await res.json();
        setOpportunity(data.opportunity);
        setIsSaved(data.opportunity.saved || false);
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    if (oppId) {
      loadOpportunity();
    }
  }, [oppId]);

  const handleToggleSave = async () => {
    if (!opportunity) return;
    const targetState = !isSaved;
    setIsSaving(true);
    setIsSaved(targetState); // Optimistic UI update

    try {
      if (targetState) {
        const res = await fetch(`/api/opportunities/${opportunity.id}/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "" }),
        });
        if (!res.ok) {
          if (res.status === 401) {
            setIsSaved(false);
            toast.error("Please sign in to save opportunities.");
            return;
          }
          throw new Error("Failed to save");
        }
        toast.success("Saved to your workspace!");
      } else {
        const res = await fetch(`/api/opportunities/${opportunity.id}/save`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to unsave");
        toast.success("Removed from saved opportunities.");
      }
    } catch {
      setIsSaved(!targetState);
      toast.error("Could not update bookmark state.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-6 py-4 flex items-center gap-3">
          <Link href="/app">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <span className="text-xs text-muted-foreground font-mono">Loading opportunity details...</span>
        </header>
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground font-mono">Retrieving verified opportunity record...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-6 py-4 flex items-center gap-3">
          <Link href="/app">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Search
            </Button>
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3 max-w-md">
            <h3 className="text-base font-semibold text-foreground">Opportunity Not Available</h3>
            <p className="text-xs text-muted-foreground">{error || "The requested opportunity could not be found."}</p>
            <Button onClick={() => router.push("/app")} size="sm" className="mt-2">
              Return to Discovery
            </Button>
          </div>
        </main>
      </div>
    );
  }

  let salaryFormatted: string | null = null;
  if (typeof opportunity.salaryMin === "number") {
    const min = opportunity.salaryMin;
    const max = opportunity.salaryMax;
    const curr = opportunity.salaryCurrency || "USD";
    salaryFormatted =
      typeof max === "number" && max !== min
        ? `${curr} ${min.toLocaleString()} - ${max.toLocaleString()}`
        : `${curr} ${min.toLocaleString()}`;
  }

  // Find verified evidence screenshot across source listings
  const verifiedListingWithScreenshot = opportunity.sourceListings.find(
    (l) => l.screenshotPath && l.screenshotPath.length > 0
  );

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <span className="text-xs font-mono text-muted-foreground">Opportunity Workspace</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevalidate}
            disabled={isRevalidating}
            className="gap-1.5 font-mono text-xs"
            title="Revalidate live status across all sources"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isRevalidating ? "animate-spin text-primary" : ""}`} />
            <span>{isRevalidating ? "Checking..." : "Check Status"}</span>
          </Button>

          <Button
            variant={isSaved ? "secondary" : "outline"}
            size="sm"
            onClick={handleToggleSave}
            disabled={isSaving}
            className={`gap-1.5 font-mono text-xs ${isSaved ? "text-primary border-primary/40" : ""}`}
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="h-4 w-4 text-primary" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                <span>Save Opportunity</span>
              </>
            )}
          </Button>

          {opportunity.primaryApplyUrl && (
            <a href={opportunity.primaryApplyUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1.5 font-mono text-xs shadow-xs">
                <span>Apply Now</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Title & Metadata Hero */}
        <div className="space-y-4 border-b border-border pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
                {opportunity.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground font-mono">
                <span className="flex items-center gap-1.5 text-foreground font-medium">
                  <Building className="h-4 w-4 text-primary" />
                  {opportunity.companyName}
                </span>
                {opportunity.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-muted-foreground/70" />
                    {opportunity.location}
                  </span>
                )}
                {opportunity.firstSeenAt && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-muted-foreground/70" />
                    Discovered {new Date(opportunity.firstSeenAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {opportunity.status === "EXPIRED" ? (
                <Badge variant="destructive" className="font-mono text-xs uppercase px-2.5 py-0.5 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Expired
                </Badge>
              ) : opportunity.status === "ACTIVE" ? (
                <Badge variant="outline" className="font-mono text-xs uppercase px-2.5 py-0.5 text-emerald-500 border-emerald-500/30 bg-emerald-500/10 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </Badge>
              ) : null}

              {opportunity.workMode && (
                <Badge variant="outline" className="font-mono text-xs uppercase px-2.5 py-0.5">
                  {opportunity.workMode}
                </Badge>
              )}
              {opportunity.opportunityType && (
                <Badge variant="outline" className="font-mono text-xs uppercase px-2.5 py-0.5">
                  {opportunity.opportunityType}
                </Badge>
              )}
              {opportunity.experienceLevel && (
                <Badge variant="outline" className="font-mono text-xs uppercase px-2.5 py-0.5">
                  {opportunity.experienceLevel}
                </Badge>
              )}
            </div>
          </div>

          {salaryFormatted && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-mono text-xs font-semibold">
              <DollarSign className="h-3.5 w-3.5" />
              <span>{salaryFormatted}</span>
            </div>
          )}
        </div>

        {/* 2-Column Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left / Main Details Column (2 Cols) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Job Description */}
            {opportunity.description && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground font-mono flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  About the Role
                </h3>
                <div className="bg-card border border-border rounded-xl p-5 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {opportunity.description}
                </div>
              </section>
            )}

            {/* Requirements & Qualifications */}
            {Array.isArray(opportunity.requirements) && opportunity.requirements.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground font-mono flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Qualifications & Responsibilities
                </h3>
                <div className="bg-card border border-border rounded-xl p-5">
                  <ul className="space-y-2.5">
                    {opportunity.requirements.map((req, rIdx) => (
                      <li key={rIdx} className="flex items-start gap-2.5 text-xs md:text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Skills & Tech Stack */}
            {Array.isArray(opportunity.skills) && opportunity.skills.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground font-mono flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Relevant Skills & Technologies
                </h3>
                <div className="flex flex-wrap gap-2">
                  {opportunity.skills.map((skill, sIdx) => (
                    <Badge
                      key={sIdx}
                      variant="secondary"
                      className="font-mono text-xs px-3 py-1 bg-primary/10 text-primary border-primary/20"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right / Evidence & Sources Column (1 Col) */}
          <div className="space-y-6">
            {/* Discovered Sources Card */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Discovery Sources ({opportunity.sourceListings.length})
              </h4>

              <div className="space-y-3">
                {opportunity.sourceListings.map((listing, lIdx) => (
                  <div
                    key={lIdx}
                    className="p-3.5 rounded-lg border border-border bg-background space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {listing.sourcePlatform}
                      </span>
                      {listing.verificationStatus === "VERIFIED" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          <ShieldCheck className="h-3 w-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                          Discovered
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 text-xs font-mono">
                      {listing.applyUrl && (
                        <a
                          href={listing.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1 truncate"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">Direct Apply URL</span>
                        </a>
                      )}
                      {listing.sourceUrl && (
                        <a
                          href={listing.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:underline inline-flex items-center gap-1 truncate text-[11px]"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">Original Listing</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Evidence Snapshot Card */}
            {verifiedListingWithScreenshot && verifiedListingWithScreenshot.screenshotPath && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" />
                    Visual Proof
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLightboxImageUrl(verifiedListingWithScreenshot.screenshotPath!)}
                    className="h-6 text-[11px] font-mono gap-1 text-muted-foreground"
                  >
                    <Maximize2 className="h-3 w-3" />
                    Zoom
                  </Button>
                </div>

                <div
                  className="rounded-lg overflow-hidden border border-border/80 bg-black/40 cursor-pointer group relative"
                  onClick={() => setLightboxImageUrl(verifiedListingWithScreenshot.screenshotPath!)}
                >
                  <img
                    src={verifiedListingWithScreenshot.screenshotPath}
                    alt={`${opportunity.title} Visual Evidence`}
                    className="w-full h-auto object-cover object-top max-h-56 group-hover:opacity-90 transition-opacity"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-mono bg-background/90 text-foreground px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1">
                      <Maximize2 className="h-3 w-3" /> Click to expand
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Lightbox Modal */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] bg-card border border-border rounded-xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-border flex items-center justify-between bg-muted/40 px-4">
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-primary" />
                Verified Evidence Proof
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLightboxImageUrl(null)}
                className="h-7 w-7 p-0 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-auto p-2 bg-black/90 flex items-center justify-center max-h-[80vh]">
              <img
                src={lightboxImageUrl}
                alt="Full Verification Evidence"
                className="max-w-full h-auto rounded-md shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
