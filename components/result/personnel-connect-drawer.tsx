"use client";

import { useState } from "react";
import { 
  X, 
  MessageSquare, 
  Mail, 
  Phone, 
  Globe, 
  CheckCircle2, 
  Building2, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  UserCheck 
} from "lucide-react";
import { LinkedInIcon, TwitterIcon, GitHubIcon } from "@/components/ui/social-icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface ContactPersonnelItem {
  id?: string;
  fullName: string;
  roleTitle: string;
  department?: string | null;
  email?: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  whatsappUrl?: string | null;
  profileUrl?: string | null;
  twitterUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  contactType?: string | null;
  isVerified?: boolean;
}

interface PersonnelConnectDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  jobTitle: string;
  location?: string;
  contacts?: ContactPersonnelItem[];
}

export function PersonnelConnectDrawer({
  isOpen,
  onClose,
  companyName,
  jobTitle,
  location,
  contacts = [],
}: PersonnelConnectDrawerProps) {
  const [filterType, setFilterType] = useState<"ALL" | "HR" | "ENGINEERING">("ALL");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} Copied`, {
      description: text,
    });
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const filteredContacts = contacts.filter((c) => {
    if (filterType === "ALL") return true;
    if (filterType === "HR") {
      return (
        c.contactType === "HR_RECRUITER" ||
        c.roleTitle.toLowerCase().includes("recruiter") ||
        c.roleTitle.toLowerCase().includes("talent") ||
        c.roleTitle.toLowerCase().includes("people") ||
        c.roleTitle.toLowerCase().includes("hr")
      );
    }
    if (filterType === "ENGINEERING") {
      return (
        c.contactType === "ENGINEERING_LEAD" ||
        c.roleTitle.toLowerCase().includes("lead") ||
        c.roleTitle.toLowerCase().includes("engineer") ||
        c.roleTitle.toLowerCase().includes("director") ||
        c.roleTitle.toLowerCase().includes("cto") ||
        c.roleTitle.toLowerCase().includes("founder")
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in-50">
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Drawer Container: Slide-over on Desktop (>=768px), Bottom Sheet on Mobile (<768px) */}
      <div 
        className="relative z-10 flex flex-col bg-card border-border shadow-2xl w-full max-w-lg h-full md:h-full md:border-l overflow-hidden animate-in md:slide-in-from-right slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
        aria-label="Direct Recruiter and Employee Outreach"
      >
        {/* Mobile Grab Handle Bar */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-border/80 flex items-start justify-between gap-3 bg-card shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-base text-foreground tracking-tight">
                {companyName} Outreach
              </h2>
              <Badge variant="outline" className="text-[10px] font-mono border-border">
                {contacts.length} Found
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Role: <span className="text-foreground font-medium">{jobTitle}</span> {location ? `• ${location}` : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-border/60 bg-muted/20 flex items-center gap-1.5 shrink-0">
          {[
            { id: "ALL", label: `All (${contacts.length})` },
            { id: "HR", label: "Talent & HR" },
            { id: "ENGINEERING", label: "Engineering & Leads" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                filterType === tab.id
                  ? "bg-primary text-primary-foreground border-primary font-semibold"
                  : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Personnel Contact List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {filteredContacts.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <UserCheck className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p>No verified personnel profiles matching this filter.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterType("ALL")}
                className="text-xs h-7 mt-2"
              >
                Show All Personnel
              </Button>
            </div>
          ) : (
            filteredContacts.map((contact, idx) => {
              const cleanPhone = contact.phone?.replace(/[^\d+]/g, "");
              const isHR = contact.contactType === "HR_RECRUITER" || contact.roleTitle.toLowerCase().includes("talent") || contact.roleTitle.toLowerCase().includes("recruiter");

              return (
                <div
                  key={contact.id || `${contact.fullName}-${idx}`}
                  className="rounded-xl border border-border/80 bg-background/50 hover:bg-muted/30 p-3.5 space-y-3 transition-colors shadow-2xs"
                >
                  {/* Personnel Info Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-xs sm:text-sm text-foreground">
                          {contact.fullName}
                        </span>
                        {contact.isVerified && (
                          <span title="Verified Professional">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                          isHR 
                            ? "bg-blue-500/10 text-blue-500 border-blue-500/20" 
                            : "bg-purple-500/10 text-purple-500 border-purple-500/20"
                        }`}>
                          {isHR ? "Recruiter" : "Team Lead"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {contact.roleTitle} {contact.department ? `• ${contact.department}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Credentials / Direct Channels */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* Work Email */}
                    {contact.email && (
                      <div className="flex items-center justify-between gap-1.5 bg-muted/40 px-2.5 py-1.5 rounded-lg border border-border/60">
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate font-mono text-[11px]">{contact.email}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopy(contact.email!, "Work Email", `work-${idx}`)}
                            className="p-1 hover:text-foreground text-muted-foreground cursor-pointer"
                            title="Copy Email"
                          >
                            {copiedKey === `work-${idx}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                          <a
                            href={`mailto:${contact.email}?subject=${encodeURIComponent(`Application regarding ${jobTitle} at ${companyName}`)}`}
                            className="p-1 hover:text-foreground text-muted-foreground"
                            title="Send Work Email"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Personal Email */}
                    {contact.personalEmail && (
                      <div className="flex items-center justify-between gap-1.5 bg-muted/40 px-2.5 py-1.5 rounded-lg border border-border/60">
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="h-3 w-3 text-amber-500 shrink-0" />
                          <span className="truncate font-mono text-[11px]">{contact.personalEmail}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopy(contact.personalEmail!, "Personal Email", `personal-${idx}`)}
                            className="p-1 hover:text-foreground text-muted-foreground cursor-pointer"
                            title="Copy Personal Email"
                          >
                            {copiedKey === `personal-${idx}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                          <a
                            href={`mailto:${contact.personalEmail}?subject=${encodeURIComponent(`Inquiry for ${contact.fullName} regarding ${companyName}`)}`}
                            className="p-1 hover:text-foreground text-muted-foreground"
                            title="Send Personal Email"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Phone Number */}
                    {contact.phone && (
                      <div className="flex items-center justify-between gap-1.5 bg-muted/40 px-2.5 py-1.5 rounded-lg border border-border/60">
                        <div className="flex items-center gap-1.5 truncate">
                          <Phone className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="truncate font-mono text-[11px]">{contact.phone}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopy(contact.phone!, "Phone Number", `phone-${idx}`)}
                            className="p-1 hover:text-foreground text-muted-foreground cursor-pointer"
                            title="Copy Phone"
                          >
                            {copiedKey === `phone-${idx}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                          <a
                            href={`tel:${cleanPhone}`}
                            className="p-1 hover:text-foreground text-muted-foreground"
                            title="Call Phone"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 1-Click Action Shortcuts Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
                    {/* WhatsApp */}
                    {contact.phone && (
                      <a
                        href={`https://wa.me/${cleanPhone?.replace(/^\+/, "")}?text=${encodeURIComponent(`Hi ${contact.fullName}, I came across your profile and the ${jobTitle} opening at ${companyName}. Would love to connect!`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/30 cursor-pointer"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>WhatsApp</span>
                      </a>
                    )}

                    {/* LinkedIn */}
                    {contact.profileUrl && (
                      <a
                        href={contact.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/30 cursor-pointer"
                      >
                        <LinkedInIcon className="h-3 w-3" />
                        <span>LinkedIn</span>
                      </a>
                    )}

                    {/* Twitter / X */}
                    {contact.twitterUrl && (
                      <a
                        href={contact.twitterUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors border border-border/80 cursor-pointer"
                      >
                        <TwitterIcon className="h-3 w-3" />
                        <span>X / Twitter</span>
                      </a>
                    )}

                    {/* GitHub */}
                    {contact.githubUrl && (
                      <a
                        href={contact.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors border border-border/80 cursor-pointer"
                      >
                        <GitHubIcon className="h-3 w-3" />
                        <span>GitHub</span>
                      </a>
                    )}

                    {/* Portfolio */}
                    {contact.portfolioUrl && (
                      <a
                        href={contact.portfolioUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors border border-border/80 cursor-pointer"
                      >
                        <Globe className="h-3 w-3" />
                        <span>Portfolio</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer Note */}
        <div className="p-3 border-t border-border/70 bg-card text-[11px] text-muted-foreground flex items-center justify-between shrink-0">
          <span>Encrypted via BrowserPilot DeepReach Personnel Engine</span>
          <Button variant="outline" size="sm" onClick={onClose} className="h-7 text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
