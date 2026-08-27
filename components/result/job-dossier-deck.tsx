"use client";

import { useState } from "react";
import { 
  Briefcase, 
  Building, 
  MapPin, 
  DollarSign, 
  ExternalLink, 
  Maximize2, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Layers, 
  Download, 
  Filter, 
  Sparkles,
  Camera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { NormalizedJobItem } from "@/lib/scraper/normalizer";

interface JobDossierDeckProps {
  jobs: NormalizedJobItem[];
  jobId: string;
  className?: string;
}

export function JobDossierDeck({ jobs = [], jobId, className = "" }: JobDossierDeckProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(jobs[0]?.id || null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");

  if (!jobs || jobs.length === 0) return null;

  const filteredJobs = jobs.filter((j) => {
    if (filterType === "ALL") return true;
    if (filterType === "REMOTE") return j.workplaceType === "Remote";
    if (filterType === "HYBRID") return j.workplaceType === "Hybrid";
    return true;
  });

  return (
    <div className={`rounded-2xl border border-border/80 bg-card p-6 space-y-6 shadow-md ${className}`}>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase font-mono">
              Verified Autonomous Job Dossier Deck
            </h3>
            <Badge variant="outline" className="font-mono text-xs">
              {jobs.length} Verified Positions
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Multi-page deep extraction with verified descriptions, requirements, and direct application links.
          </p>
        </div>

        {/* Workplace Type Filters */}
        <div className="flex items-center gap-1.5">
          {["ALL", "REMOTE", "HYBRID"].map((type) => (
            <Button
              key={type}
              variant={filterType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType(type)}
              className="h-7 text-xs font-mono px-2.5"
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      {/* Accordion Job Cards List */}
      <div className="space-y-3">
        {filteredJobs.map((job, idx) => {
          const isExpanded = expandedJobId === job.id;

          return (
            <div
              key={job.id}
              className={`rounded-xl border transition-all overflow-hidden ${
                isExpanded
                  ? "border-primary/60 bg-muted/20 shadow-xs"
                  : "border-border/60 bg-card hover:border-border hover:bg-muted/10"
              }`}
            >
              {/* Card Header (Click to toggle) */}
              <button
                onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                className="w-full text-left p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono text-xs font-semibold">
                    {idx + 1}
                  </span>

                  <div className="space-y-0.5 truncate flex-1">
                    <h4 className="text-sm font-medium text-foreground truncate">
                      {job.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono truncate">
                      <span className="flex items-center gap-1">
                        <Building className="h-3 w-3 text-muted-foreground/70" />
                        {job.company}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground/70" />
                        {job.location}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {job.workplaceType && job.workplaceType !== "Unspecified" && (
                    <Badge variant="outline" className="text-[10px] font-mono hidden sm:inline-flex">
                      {job.workplaceType}
                    </Badge>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded Detailed Dossier View */}
              {isExpanded && (
                <div className="p-5 pt-0 border-t border-border/40 space-y-4">
                  {/* Meta Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-3">
                    <Badge variant="outline" className="font-mono text-xs gap-1 bg-background">
                      <Building className="h-3 w-3" />
                      Company: {job.company}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs gap-1 bg-background">
                      <MapPin className="h-3 w-3" />
                      Location: {job.location}
                    </Badge>
                    {job.salary && (
                      <Badge className="font-mono text-xs gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        <DollarSign className="h-3 w-3" />
                        {job.salary}
                      </Badge>
                    )}
                    <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                      Source: {job.sourcePlatform}
                    </Badge>
                  </div>

                  {/* Requirements & Description */}
                  {job.requirements.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
                        Key Responsibilities & Qualifications
                      </h5>
                      <ul className="space-y-1.5 text-xs text-muted-foreground pl-1">
                        {job.requirements.map((req, rIdx) => (
                          <li key={rIdx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Dedicated Viewport Screenshot Proof */}
                  {job.screenshotUrl && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-primary" />
                          Verified Page Snapshot
                        </h5>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLightboxImageUrl(job.screenshotUrl!)}
                          className="h-6 text-[11px] font-mono gap-1 text-muted-foreground"
                        >
                          <Maximize2 className="h-3 w-3" />
                          Zoom Fullscreen
                        </Button>
                      </div>

                      <div 
                        onClick={() => setLightboxImageUrl(job.screenshotUrl!)}
                        className="relative aspect-video max-w-lg rounded-lg border border-border overflow-hidden bg-zinc-950 cursor-zoom-in group"
                      >
                        <img
                          src={job.screenshotUrl}
                          alt={`${job.title} at ${job.company}`}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />
                      </div>
                    </div>
                  )}

                  {/* Action Link Button */}
                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-border/40">
                    <span className="text-[11px] font-mono text-muted-foreground truncate max-w-md">
                      {job.applyUrl}
                    </span>

                    <a
                      href={job.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" className="h-8 text-xs font-mono gap-1.5 shadow-xs">
                        Open & Apply
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {lightboxImageUrl && (
        <div 
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[90vh]">
            <img
              src={lightboxImageUrl}
              alt="Full Resolution Viewport Snapshot"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain border border-zinc-800"
            />
            <p className="text-center text-zinc-400 font-mono text-xs mt-3">
              Click anywhere to close full preview
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
