"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { 
  X, 
  Building2, 
  MapPin, 
  Briefcase, 
  ExternalLink, 
  Bookmark, 
  BookmarkCheck, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  RotateCw, 
  Calendar,
  Share2,
  DollarSign,
  Mail,
  Phone,
  MessageSquare,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertOctagon,
  Globe,
  Link2
} from "lucide-react";
import { TwitterIcon, GitHubIcon } from "@/components/ui/social-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUIState } from "@/components/providers/ui-state-provider";
import { getVerificationCornerBadge, type DossierJobItem } from "@/components/result/job-dossier-deck";
import { getAtsSourceInfo, getSocialAuthorHandle } from "@/lib/ats/atsSourceInfo";
import { TrustScoreBadge } from "@/components/result/trust-score-badge";
import { GhostJobBanner } from "@/components/result/ghost-job-banner";
import { CompanyIntelligencePill } from "@/components/result/company-intelligence-pill";
import { 
  humanizeStatus, 
  humanizeOpportunityType, 
  humanizeWorkMode 
} from "@/lib/utils/display-mappings";

interface JobDetailSlideOverProps {
  job: DossierJobItem | null;
  isOpen: boolean;
  onClose: () => void;
  isSaved?: boolean;
  isSaving?: boolean;
  onToggleSave?: () => void;
  onRevalidate?: () => void;
  isRevalidating?: boolean;
  onOpenPersonnelDrawer?: () => void;
}

export function JobDetailSlideOver({
  job,
  isOpen,
  onClose,
  isSaved = false,
  isSaving = false,
  onToggleSave,
  onRevalidate,
  isRevalidating = false,
  onOpenPersonnelDrawer,
}: JobDetailSlideOverProps) {
  const { getConnectorMeta } = useUIState();
  const [showShareMenu, setShowShareMenu] = React.useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !job) return null;

  const effectivePlatform = job.sourcePlatform || job.sourceListings?.[0]?.sourcePlatform;
  const effectiveUrl = job.applyUrl || job.primaryApplyUrl || job.sourceListings?.[0]?.applyUrl;
  const conn = getConnectorMeta(effectivePlatform, effectiveUrl);
  const atsInfo = getAtsSourceInfo(effectivePlatform, effectiveUrl, job.sourceListings);
  const isSocialMedia = ["REDDIT", "X", "TWITTER", "YOUTUBE", "LINKEDIN"].includes(
    (effectivePlatform || "").toUpperCase()
  ) || /reddit\.com|x\.com|twitter\.com|youtube\.com|youtu\.be/i.test(effectiveUrl || "");
  const socialHandle = isSocialMedia ? getSocialAuthorHandle(job) : null;
  const verificationBadge = getVerificationCornerBadge(job.verificationStatus);

  const parsedSkills = Array.isArray(job.skills) 
    ? job.skills 
    : typeof job.skills === "string" 
      ? JSON.parse(job.skills || "[]") 
      : [];

  const parsedRequirements = Array.isArray(job.requirements) 
    ? job.requirements 
    : typeof job.requirements === "string" 
      ? JSON.parse(job.requirements || "[]") 
      : [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      {/* Dimmed Backdrop Overlay */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300" 
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
        {/* Slide-over Panel (Full width on mobile, max-w-xl on desktop) */}
        <div className="w-screen max-w-full sm:max-w-lg md:max-w-xl bg-card text-card-foreground shadow-marble-3 sm:rounded-l-3xl flex flex-col h-full border-l border-border animate-in slide-in-from-right duration-200">
          
          {/* Top Header Bar */}
          <div className="px-5 py-4 border-b border-border/70 flex items-center justify-between bg-muted/40 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-medium border ${atsInfo.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${atsInfo.dotColor}`} />
                {atsInfo.name}
              </span>
              {socialHandle && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono bg-muted/80 text-foreground font-medium border border-border/60">
                  {socialHandle}
                </span>
              )}
              {job.trustReport && (
                <TrustScoreBadge
                  score={job.trustReport.trustScore}
                  tier={job.trustReport.trustTier}
                  isGhostJob={job.trustReport.isGhostJob}
                />
              )}
              {verificationBadge}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Close panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Title & Company Block */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-semibold text-foreground text-sm">{job.companyName}</span>
                {job.postedAgoText && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {job.postedAgoText}
                    </span>
                  </>
                )}
              </div>

              {(job.companyIntelligence || job.isUndisclosed) && (
                <div className="pt-0.5">
                  <CompanyIntelligencePill
                    companyName={job.companyName}
                    employeeHeadcountBracket={job.companyIntelligence?.employeeHeadcountBracket}
                    headquarters={job.companyIntelligence?.headquarters}
                    officialDomain={job.companyIntelligence?.officialDomain}
                    isUndisclosed={job.isUndisclosed || job.companyIntelligence?.isUndisclosed}
                    employerType={job.companyIntelligence?.employerType}
                  />
                </div>
              )}

              <h2 id="slide-over-title" className="text-xl sm:text-2xl font-sans font-bold text-foreground leading-tight">
                {job.title}
              </h2>

              <div className="flex items-center gap-4 text-xs font-sans text-muted-foreground flex-wrap pt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 stroke-[1.75]" />
                  {job.location || "Remote / Unspecified"}
                </span>
                {job.workMode && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5 stroke-[1.75]" />
                    {humanizeWorkMode(job.workMode)}
                  </span>
                )}
                {job.opportunityType && (
                  <Badge variant="outline" className="font-sans text-[11px] py-0">
                    {humanizeOpportunityType(job.opportunityType)}
                  </Badge>
                )}
              </div>

              {/* Primary Action Row: Apply on [Platform], Save Opportunity, Revalidate Link, Share */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {effectiveUrl ? (
                  <a
                    href={effectiveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[150px] inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-sans font-semibold text-xs shadow-marble-1 transition-colors cursor-pointer"
                  >
                    <span>
                      {isSocialMedia
                        ? (atsInfo.name === "YOUTUBE" ? "Watch Video on YouTube" : `View Post on ${atsInfo.name}`)
                        : `Apply on ${atsInfo.name}`}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <Button disabled className="flex-1 h-9 text-xs font-sans">
                    Apply Link Unavailable
                  </Button>
                )}

                {onToggleSave && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggleSave}
                    disabled={isSaving}
                    className="h-9 px-3 font-sans text-xs gap-1.5 cursor-pointer border-border/80"
                  >
                    {isSaved ? (
                      <>
                        <BookmarkCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Saved</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-3.5 w-3.5" />
                        <span>Save Opportunity</span>
                      </>
                    )}
                  </Button>
                )}

                {onRevalidate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRevalidate}
                    disabled={isRevalidating}
                    className="h-9 px-3 font-sans text-xs gap-1.5 cursor-pointer border-border/80"
                  >
                    <RotateCw className={`h-3.5 w-3.5 stroke-[1.75] ${isRevalidating ? "animate-spin text-emerald-600 dark:text-emerald-400" : ""}`} />
                    <span>{isRevalidating ? "Verifying..." : "Revalidate Link"}</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className={`h-9 px-3 font-sans text-xs gap-1.5 cursor-pointer border-border/80 ${showShareMenu ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                >
                  <Share2 className="h-3.5 w-3.5 stroke-[1.75]" />
                  <span>Share</span>
                </Button>
              </div>

              {/* Collapsible 1-Click Social Share Tray */}
              {showShareMenu && (
                <div className="p-3 rounded-lg border border-border/70 bg-slate-50 dark:bg-slate-900/50 space-y-2 text-xs font-sans animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">Share Opportunity</span>
                    <button
                      type="button"
                      onClick={() => setShowShareMenu(false)}
                      className="text-muted-foreground hover:text-foreground text-[10px]"
                    >
                      Close
                    </button>
                  </div>
                  {(() => {
                    const shareTargetUrl = typeof window !== "undefined"
                      ? `${window.location.origin}/opportunities/${job.id || job.canonicalHash || ""}`
                      : (effectiveUrl || "");
                    const roleShareText = `Check out this role: ${job.title} at ${job.companyName} on BrowserPilot`;

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-medium text-[11px]">
                        {/* LinkedIn */}
                        <a
                          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareTargetUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 p-2 rounded-md bg-[#0077B5]/10 text-[#0077B5] dark:text-blue-400 hover:bg-[#0077B5]/20 transition-colors border border-[#0077B5]/30"
                        >
                          <span>LinkedIn</span>
                        </a>

                        {/* Twitter / X */}
                        <a
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(roleShareText)}&url=${encodeURIComponent(shareTargetUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 p-2 rounded-md bg-foreground/5 text-foreground hover:bg-foreground/10 transition-colors border border-border"
                        >
                          <span>X / Twitter</span>
                        </a>

                        {/* WhatsApp */}
                        <a
                          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${job.title} at ${job.companyName}: `)}%20${encodeURIComponent(shareTargetUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 p-2 rounded-md bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors border border-[#25D366]/30"
                        >
                          <span>WhatsApp</span>
                        </a>

                        {/* Copy Link */}
                        <button
                          type="button"
                          onClick={() => {
                            if (shareTargetUrl) {
                              navigator.clipboard.writeText(shareTargetUrl);
                              toast.success("Direct opportunity link copied!");
                            }
                          }}
                          className="flex items-center justify-center gap-1.5 p-2 rounded-md bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border cursor-pointer"
                        >
                          <Link2 className="h-3 w-3" />
                          <span>Copy Link</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Match Relevance & Reasoning Card */}
            {typeof job.matchScore === "number" && (
              <div className={`rounded-xl border p-4 space-y-2 ${
                job.matchBadge?.label === "Recommendation" || job.matchType?.startsWith("RECOMMENDED")
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-emerald-500/30 bg-emerald-500/10"
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-sans font-semibold flex items-center gap-1.5 ${
                    job.matchBadge?.label === "Recommendation" || job.matchType?.startsWith("RECOMMENDED")
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}>
                    <Sparkles className="h-3.5 w-3.5 stroke-[1.75]" />
                    {job.matchBadge?.label === "Recommendation" ? "AI Recommendation Match" : "Verified Direct Match"}
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-background/80 border border-border px-2 py-0.5 rounded-md">
                    {Math.round(job.matchScore)}% fit
                  </span>
                </div>
                {job.matchBadge?.tagline && (
                  <p className={`text-xs font-sans font-medium ${
                    job.matchBadge?.label === "Recommendation" || job.matchType?.startsWith("RECOMMENDED")
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}>
                    {job.matchBadge.tagline}
                  </p>
                )}
                {job.matchReason && (
                  <p className="text-xs font-sans text-muted-foreground leading-relaxed">
                    {job.matchReason}
                  </p>
                )}
              </div>
            )}

            {/* Trust & Verification Audit Section */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <h4 className="text-xs font-sans font-bold text-foreground">
                    Trust & Verification Audit
                  </h4>
                </div>
                {onRevalidate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRevalidate}
                    disabled={isRevalidating}
                    className="h-6 text-[11px] font-sans text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/10 px-2 cursor-pointer gap-1"
                  >
                    <RotateCw className={`h-3 w-3 stroke-[1.75] ${isRevalidating ? "animate-spin" : ""}`} />
                    {isRevalidating ? "Checking..." : "Revalidate"}
                  </Button>
                )}
              </div>

              {/* Trust Score & Tier breakdown */}
              {job.trustReport && (
                <div className="space-y-2 pb-2 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans text-muted-foreground">Listing Trust Score:</span>
                    <TrustScoreBadge
                      score={job.trustReport.trustScore}
                      tier={job.trustReport.trustTier}
                      isGhostJob={job.trustReport.isGhostJob}
                    />
                  </div>

                  {(job.trustReport.isGhostJob || job.trustReport.trustTier === "GHOST_JOB_AFFILIATE") && (
                    <GhostJobBanner
                      advisoryTitle={job.trustReport.advisoryTitle}
                      advisoryMessage={job.trustReport.advisoryMessage}
                      actionRecommendation={job.trustReport.actionRecommendation}
                      reasons={job.trustReport.reasons}
                      affiliateWarning={job.urlAnalysis?.affiliateWarning}
                      className="mt-2"
                    />
                  )}
                </div>
              )}

              {/* Destination URL & Redirect Analysis */}
              {job.urlAnalysis && (
                <div className="space-y-2 pb-2 border-b border-border/40 text-xs font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      Destination Domain:
                    </span>
                    <span className="font-mono text-[11px] font-medium text-foreground truncate max-w-[180px]">
                      {job.urlAnalysis.destinationDomain}
                    </span>
                  </div>

                  {job.urlAnalysis.isShortLink && (
                    <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md border border-amber-300/60">
                      <span className="flex items-center gap-1 font-medium text-[11px]">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Short Link Unmasked:
                      </span>
                      <span className="font-mono text-[10px] truncate max-w-[160px]" title={job.urlAnalysis.finalUrl}>
                        {job.urlAnalysis.finalUrl}
                      </span>
                    </div>
                  )}

                  {job.urlAnalysis.isAffiliateTrap && (
                    <div className="p-2.5 rounded-lg border border-amber-400/80 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 stroke-[2]" />
                        <span>Aggregator / Affiliate Trap Detected</span>
                      </div>
                      <p className="text-[10px] leading-relaxed text-amber-700/90 dark:text-amber-300/80">
                        {job.urlAnalysis.affiliateWarning || "This URL routes candidates into a registration lead funnel rather than an official applicant tracking system."}
                      </p>
                      {job.urlAnalysis.portalType && (
                        <div className="text-[10px] font-mono text-amber-800 dark:text-amber-200 pt-0.5">
                          Portal Class: {job.urlAnalysis.portalType.replace(/_/g, " ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Source Platform & Real-Time Integrity */}
              <div className="space-y-1.5 text-xs font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Source Platform:</span>
                  <span className="font-medium text-foreground">{conn.displayName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-sans text-emerald-700 font-semibold">{humanizeStatus(job.verificationStatus)}</span>
                </div>
                {job.lastVerifiedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last Verified:</span>
                    <span className="font-mono text-muted-foreground">{new Date(job.lastVerifiedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Skills & Key Tools */}
            {parsedSkills.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-sans font-bold text-foreground">
                  Required and preferred skills
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {parsedSkills.map((skill: string, i: number) => (
                    <span 
                      key={i} 
                      className="px-2.5 py-1 rounded-md text-xs font-sans bg-muted text-foreground border border-border/70"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Key Requirements */}
            {parsedRequirements.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-sans font-bold text-foreground">
                  Key requirements
                </h4>
                <ul className="space-y-1.5 list-disc list-inside text-xs font-sans text-muted-foreground">
                  {parsedRequirements.map((req: string, i: number) => (
                    <li key={i} className="leading-relaxed text-foreground/90">
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key Company Contacts & Hiring Team (DeepReach Verified) */}
            {job.companyContacts && job.companyContacts.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-sans font-bold text-foreground flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Key company contacts & hiring team
                  </h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono">
                      DeepReach Verified
                    </Badge>
                    {onOpenPersonnelDrawer && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onOpenPersonnelDrawer}
                        className="h-6 px-2 text-[11px] font-sans gap-1 text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                      >
                        <UserCheck className="h-3 w-3" />
                        Outreach Drawer
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2.5">
                  {job.companyContacts.map((contact, idx) => {
                    const cleanPhone = contact.phone?.replace(/[^\d+]/g, "");
                    return (
                      <div 
                        key={idx}
                        className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-2.5 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-foreground truncate flex items-center gap-1.5">
                              {contact.fullName}
                              {contact.isVerified && (
                                <span title="Verified Active Profile">
                                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {contact.roleTitle} {contact.department ? `· ${contact.department}` : ""}
                            </div>
                          </div>
                          {contact.profileUrl && (
                            <a
                              href={contact.profileUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="shrink-0 p-1.5 rounded-lg border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                              title="Open Profile"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>

                        {/* Email & Phone Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                          {contact.email && (
                            <a 
                              href={`mailto:${contact.email}`}
                              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 truncate p-1 rounded hover:bg-muted/30 font-mono"
                              title="Work Email"
                            >
                              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{contact.email}</span>
                            </a>
                          )}
                          {contact.personalEmail && (
                            <a 
                              href={`mailto:${contact.personalEmail}`}
                              className="text-amber-500 hover:text-amber-400 inline-flex items-center gap-1.5 truncate p-1 rounded hover:bg-muted/30 font-mono"
                              title="Personal Email"
                            >
                              <Mail className="h-3 w-3 text-amber-500 shrink-0" />
                              <span className="truncate">{contact.personalEmail}</span>
                            </a>
                          )}
                          {contact.phone && (
                            <a 
                              href={`tel:${cleanPhone}`}
                              className="text-emerald-500 hover:text-emerald-400 inline-flex items-center gap-1.5 truncate p-1 rounded hover:bg-muted/30 font-mono"
                              title="Direct Phone"
                            >
                              <Phone className="h-3 w-3 text-emerald-500 shrink-0" />
                              <span className="truncate">{contact.phone}</span>
                            </a>
                          )}
                        </div>

                        {/* Direct Action Shortcuts */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
                          {contact.phone && (
                            <a
                              href={`https://wa.me/${cleanPhone?.replace(/^\+/, "")}?text=${encodeURIComponent(`Hi ${contact.fullName}, I came across the ${job.title} opening at ${job.companyName} on BrowserPilot and would love to connect!`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 cursor-pointer"
                            >
                              <MessageSquare className="h-2.5 w-2.5" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                          {contact.twitterUrl && (
                            <a
                              href={contact.twitterUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground hover:text-foreground border border-border cursor-pointer"
                            >
                              <TwitterIcon className="h-2.5 w-2.5" />
                              <span>Twitter</span>
                            </a>
                          )}
                          {contact.githubUrl && (
                            <a
                              href={contact.githubUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground hover:text-foreground border border-border cursor-pointer"
                            >
                              <GitHubIcon className="h-2.5 w-2.5" />
                              <span>GitHub</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DeepReach Hiring Team & Direct Outreach (100% Free Built-in Intelligence) */}
            {(!job.companyContacts || job.companyContacts.length === 0) && (
              <div className="p-3.5 rounded-xl border border-border/70 bg-gradient-to-br from-card to-muted/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-sans font-semibold text-xs text-foreground">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    Key company contacts & hiring team
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono">
                    DeepReach Verified
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Direct recruiter profiles, talent acquisition managers, and outreach shortcuts for {job.companyName} are free and available via built-in DeepReach intelligence.
                </p>
                <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                  {onOpenPersonnelDrawer ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onOpenPersonnelDrawer}
                      className="h-7 text-xs font-sans gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/10"
                    >
                      <UserCheck className="h-3 w-3" />
                      Direct Recruiter Outreach
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toast.info("DeepReach Intelligence", {
                          description: `DeepReach verified intelligence active for ${job.companyName}.`,
                        });
                      }}
                      className="h-7 text-xs font-sans gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/10"
                    >
                      <Sparkles className="h-3 w-3" />
                      View Recruiter Network
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Job Description */}
            {job.description && (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <h4 className="text-xs font-sans font-bold text-foreground">
                  Role overview and description
                </h4>
                <div className="text-xs font-sans text-foreground/90 leading-relaxed whitespace-pre-line bg-muted/30 p-4 rounded-xl border border-border/60">
                  {job.description}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom Footer: Action Bar */}
          <div className="p-4 border-t border-border/70 bg-card flex items-center justify-between gap-3 shrink-0">
            {onToggleSave && (
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleSave}
                disabled={isSaving}
                className="h-11 sm:h-10 px-4 font-sans text-xs gap-1.5 cursor-pointer border-border/80"
              >
                {isSaved ? (
                  <>
                    <BookmarkCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" />
                    <span>Save</span>
                  </>
                )}
              </Button>
            )}

            {job.id && (
              <Link href={`/app/opportunities/${job.id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 sm:h-10 px-3 text-xs font-mono gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Open dedicated opportunity dossier page"
                >
                  <span>Dossier</span>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            )}

            {effectiveUrl ? (
              <a
                href={effectiveUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={job.urlAnalysis?.isAffiliateTrap ? "Redirects to third-party registration" : undefined}
                className={`flex-1 inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-5 rounded-lg font-sans font-semibold text-xs shadow-marble-1 transition-colors ${
                  job.urlAnalysis?.isAffiliateTrap
                    ? "bg-amber-600 hover:bg-amber-700 text-white border-2 border-amber-400"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                }`}
              >
                {job.urlAnalysis?.isAffiliateTrap ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>Apply via Redirect ({atsInfo.name})</span>
                  </>
                ) : (
                  <>
                    <span>Apply on {atsInfo.name}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </>
                )}
              </a>
            ) : (
              <Button disabled className="flex-1 h-10 text-xs font-sans">
                Direct Apply Link Unavailable
              </Button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
