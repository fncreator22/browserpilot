import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { 
  Building2, 
  MapPin, 
  Clock, 
  ExternalLink, 
  Compass, 
  CheckCircle2, 
  MessageSquare, 
  Mail, 
  Phone,
  Share2, 
  ArrowRight, 
  ArrowLeft,
  ShieldCheck, 
  Globe, 
  Layers, 
  Sparkles, 
  UserCheck, 
  Briefcase, 
  Hash 
} from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getOpportunityWithSourceListings, isOpportunitySaved, getSavedOpportunities } from "@/lib/db/opportunities";
import { enrichOpportunityData } from "@/lib/discovery/enrichment/opportunityEnrichmentService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InfoBadge } from "@/components/ui/info-badge";
import { OpportunityActionToolbar } from "@/components/result/opportunity-action-toolbar";
import { getAtsSourceInfo } from "@/components/result/job-dossier-deck";
import type { PipelineStage } from "@/app/app/saved/page";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage(props: {
  params: Promise<{ id: string }>;
  isInsideApp?: boolean;
}) {
  const params = await props.params;
  const oppId = params.id;
  const isInsideApp = props.isInsideApp ?? false;

  if (!oppId) {
    notFound();
  }

  const opp = await getOpportunityWithSourceListings(oppId);
  if (!opp) {
    notFound();
  }

  const session = await getServerSession(authOptions).catch(() => null);
  const userId = (session?.user as { id?: string })?.id;
  let isSaved = false;
  let currentStage: PipelineStage = "SAVED";

  if (userId) {
    try {
      isSaved = await isOpportunitySaved(userId, opp.id);
      if (isSaved) {
        const savedOpps = await getSavedOpportunities(userId);
        const record = savedOpps.find((s) => s.opportunity?.id === opp.id || (s as any).opportunityId === opp.id);
        if (record?.notes) {
          try {
            const parsed = JSON.parse(record.notes);
            if (parsed.stage && ["SAVED", "APPLIED", "INTERVIEWING", "OFFER"].includes(parsed.stage)) {
              currentStage = parsed.stage as PipelineStage;
            }
          } catch {
            if (["SAVED", "APPLIED", "INTERVIEWING", "OFFER"].includes(record.notes)) {
              currentStage = record.notes as PipelineStage;
            }
          }
        }
      }
    } catch {
      // Non-fatal bookmark check
    }
  }

  const enriched = await enrichOpportunityData({
    opportunityId: opp.id,
    canonicalHash: opp.canonicalHash || opp.id,
    companyName: opp.companyName,
    title: opp.title,
  }).catch(() => null);

  const contacts = enriched?.companyContacts || [];
  const primaryApplyUrl = opp.primaryApplyUrl || (opp.sourceListings && opp.sourceListings[0]?.sourceUrl) || "#";

  const skills: string[] = opp.skills
    ? typeof opp.skills === "string"
      ? (() => { try { return JSON.parse(opp.skills); } catch { return [opp.skills]; } })()
      : Array.isArray(opp.skills) ? opp.skills : []
    : [];

  const requirements: string[] = opp.requirements
    ? typeof opp.requirements === "string"
      ? (() => { try { return JSON.parse(opp.requirements); } catch { return [opp.requirements]; } })()
      : Array.isArray(opp.requirements) ? opp.requirements : []
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Top Header: Conditional based on in-app shell vs public dossier view */}
      {isInsideApp ? (
        <div className="border-b border-border/60 bg-card/40 backdrop-blur-md px-4 sm:px-6 py-3">
          <div className="container mx-auto max-w-5xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground truncate">
              <Link href="/app" className="hover:text-foreground transition-colors">Workspace</Link>
              <span>/</span>
              <Link href="/app/saved" className="hover:text-foreground transition-colors">Opportunities</Link>
              <span>/</span>
              <span className="text-foreground truncate max-w-[200px] sm:max-w-md font-medium">{opp.title}</span>
            </div>
            <Link href="/app/saved">
              <Button size="sm" variant="ghost" className="text-xs font-mono gap-1.5 h-8 cursor-pointer">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <header className="border-b border-border/60 bg-card/60 backdrop-blur-md sticky top-0 z-20">
          <div className="container mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
            <Link href="/app" className="flex items-center gap-2 font-semibold text-sm tracking-tight">
              <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <Compass className="h-4 w-4" />
              </div>
              <span>BrowserPilot</span>
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/app">
                <Button size="sm" variant="outline" className="text-xs font-mono gap-1.5 border-border/80 cursor-pointer">
                  <span>Explore Jobs</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-8">
        {/* Header Hero Card */}
        <div className="rounded-2xl border border-border/70 bg-card p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-medium">
                  {opp.workMode || "Flexible"}
                </Badge>
                {opp.experienceLevel && (
                  <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                    {opp.experienceLevel.replace(/_/g, " ")}
                  </Badge>
                )}
                {opp.lastVerifiedAt && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified Opening
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{opp.title}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap pt-1">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-foreground">{opp.companyName}</span>
                </div>
                {opp.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{opp.location}</span>
                  </div>
                )}
                {(opp.salaryMin || opp.salaryMax) && (
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {opp.salaryCurrency || "$"}
                    {opp.salaryMin ? opp.salaryMin.toLocaleString() : ""}
                    {opp.salaryMin && opp.salaryMax ? " - " : ""}
                    {opp.salaryMax ? opp.salaryMax.toLocaleString() : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Interactive Action Toolbar: Apply, Save/Bookmark, Stage Selector & Share */}
            <div className="shrink-0">
              <OpportunityActionToolbar
                opportunityId={opp.id}
                initialSaved={isSaved}
                initialStage={currentStage}
                primaryApplyUrl={primaryApplyUrl}
                companyName={opp.companyName}
                title={opp.title}
                shareUrl={enriched?.shareUrl}
              />
            </div>
          </div>
        </div>

        {/* 2-Column Grid: Description & Hiring Team */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Dossier, Overview, Skills, Citations */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Verification Evidence & Truth-Gate Claims */}
            <div className="rounded-xl border border-border/70 bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>Verification Evidence & Claims</span>
                </h2>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                    Truth-Gate Verified
                  </Badge>
                  <InfoBadge
                    title="Truth-Gate Verification Telemetry"
                    description="Cryptographic discovery audit trail confirming this opening is authentic, live, and verified on employer ATS infrastructure."
                    details={{
                      "Status": opp.status || "ACTIVE",
                      "Canonical Hash": opp.canonicalHash || opp.id,
                      "First Discovered": new Date(opp.firstSeenAt).toLocaleString(),
                      "Last Verified": new Date(opp.lastVerifiedAt).toLocaleString(),
                      "Primary ATS": opp.sourceListings?.[0]?.sourcePlatform || "Direct ATS",
                      "Total Citations": opp.sourceListings?.length || 1,
                    }}
                    rawPayload={{
                      opportunityId: opp.id,
                      canonicalHash: opp.canonicalHash,
                      status: opp.status,
                      firstSeenAt: opp.firstSeenAt,
                      lastVerifiedAt: opp.lastVerifiedAt,
                      sourceListings: opp.sourceListings,
                    }}
                    variant="pill"
                    label="Audit Trail"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Listing Status</span>
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {opp.status || "ACTIVE"} (Verified Live)
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Last Verified</span>
                  <span className="font-semibold text-foreground">
                    {new Date(opp.lastVerifiedAt).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                  <span className="text-muted-foreground block text-[11px]">First Discovered</span>
                  <span className="font-semibold text-foreground">
                    {new Date(opp.firstSeenAt).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-1">
                  <span className="text-muted-foreground block text-[11px]">Canonical Hash</span>
                  <span className="font-mono text-[10px] text-muted-foreground truncate block" title={opp.canonicalHash}>
                    {opp.canonicalHash ? opp.canonicalHash.slice(0, 18) + "..." : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Job Description */}
            <div className="rounded-xl border border-border/70 bg-card p-6 space-y-4">
              <h2 className="text-base font-bold tracking-tight text-foreground">Role Overview</h2>
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-line font-sans text-sm">
                {opp.description || "No extended job description provided."}
              </div>
            </div>

            {/* 3. Skills & Requirements */}
            {(skills.length > 0 || requirements.length > 0) && (
              <div className="rounded-xl border border-border/70 bg-card p-6 space-y-4">
                <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Skills & Requirements</span>
                </h2>

                {skills.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-mono text-muted-foreground block">Key Skills</span>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map((s, idx) => (
                        <Badge key={idx} variant="secondary" className="font-mono text-xs px-2.5 py-1">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {requirements.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-mono text-muted-foreground block">Qualifications</span>
                    <ul className="space-y-1.5 text-xs text-muted-foreground font-sans">
                      {requirements.map((req, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 4. Multi-Source Citations */}
            {opp.sourceListings && opp.sourceListings.length > 0 && (
              <div className="rounded-xl border border-border/70 bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <span>Verified Source Citations</span>
                  </h2>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {opp.sourceListings.length} Sources
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {opp.sourceListings.map((listing, idx) => {
                    const ats = getAtsSourceInfo(listing.sourcePlatform, listing.applyUrl || listing.sourceUrl);
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg border border-border/60 bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border ${ats.className}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${ats.dotColor}`} />
                              {ats.name}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                              {listing.verificationStatus || "VERIFIED"}
                            </Badge>
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground block truncate max-w-md">
                            {listing.sourceUrl}
                          </span>
                        </div>

                        <a
                          href={listing.applyUrl || listing.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <Button size="sm" variant="outline" className="h-8 text-xs font-mono gap-1.5 border-border/80">
                            <span>Open Source</span>
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Hiring Team & Outreach */}
          <div className="space-y-6">
            {contacts.length > 0 && (
              <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-emerald-500" />
                    <span>Hiring Team & Personnel</span>
                  </h3>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    {contacts.length} Found
                  </Badge>
                </div>
                <div className="space-y-3">
                  {contacts.map((contact, idx) => (
                    <div key={idx} className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-xs text-foreground">{contact.fullName}</p>
                          <p className="text-[11px] text-muted-foreground">{contact.roleTitle}</p>
                          {contact.department && (
                            <p className="text-[10px] font-mono text-muted-foreground/80">{contact.department}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-[9px] font-mono shrink-0">
                          {contact.contactType || "RECRUITER"}
                        </Badge>
                      </div>

                      {/* Personal & Work Credentials */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {contact.whatsappUrl && (
                          <a
                            href={contact.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-medium hover:bg-emerald-500/20 transition-colors"
                          >
                            <MessageSquare className="h-3 w-3" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted text-foreground text-[10px] font-medium hover:bg-muted/80 border border-border/60 transition-colors"
                          >
                            <Mail className="h-3 w-3" />
                            <span>Work Email</span>
                          </a>
                        )}
                        {contact.personalEmail && (
                          <a
                            href={`mailto:${contact.personalEmail}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-medium hover:bg-purple-500/20 transition-colors"
                          >
                            <Mail className="h-3 w-3" />
                            <span>Personal Email</span>
                          </a>
                        )}
                        {contact.phone && (
                          <a
                            href={`tel:${contact.phone}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted text-foreground text-[10px] font-medium hover:bg-muted/80 border border-border/60 transition-colors"
                          >
                            <Phone className="h-3 w-3" />
                            <span>{contact.phone}</span>
                          </a>
                        )}
                        {contact.profileUrl && (
                          <a
                            href={contact.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-medium hover:bg-blue-500/20 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Profile</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Social Share Box */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3 shadow-sm text-xs">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Share2 className="h-3.5 w-3.5 text-primary" />
                <span>Share Opportunity</span>
              </h3>
              <p className="text-muted-foreground text-[11px]">
                Share this verified role directly with your professional network.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 font-medium">
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://browserpilot.dev/opportunities/${opp.id}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-border text-center hover:bg-muted/40 transition-colors text-blue-500 dark:text-blue-400"
                >
                  LinkedIn
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${opp.title} at ${opp.companyName} on BrowserPilot!`)}&url=${encodeURIComponent(`https://browserpilot.dev/opportunities/${opp.id}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg border border-border text-center hover:bg-muted/40 transition-colors text-foreground"
                >
                  Twitter / X
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
