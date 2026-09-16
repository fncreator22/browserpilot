"use client";

import { useState } from "react";
import { MessageSquare, Mail, Phone, ExternalLink, Check, Copy, UserCheck } from "lucide-react";
import { LinkedInIcon, TwitterIcon, GitHubIcon } from "@/components/ui/social-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * PreviewMessagingDrawer - Standalone showcase / landing page animation component.
 * 
 * Features:
 * - Direct recruiter and hiring engineer outreach demonstration
 * - 1-click WhatsApp, corporate/personal email, and phone shortcuts
 * - Social platform profile deep-links
 * - Self-contained interactive state (clipboard copy feedback)
 */
export function PreviewMessagingDrawer() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const mockPerson = {
    name: "Priya Nair",
    title: "Lead Technical Recruiter",
    company: "Swiggy Tech",
    workEmail: "priya.nair@swiggy.in",
    personalEmail: "priya.nair.talent@gmail.com",
    phone: "+91 98450 12345",
    whatsappUrl: "https://wa.me/919845012345?text=Hi%20Priya,%20saw%20the%20engineering%20opening%20on%20BrowserPilot!",
    linkedinUrl: "https://linkedin.com/in/priyanair-recruiter",
    twitterUrl: "https://x.com/priyanair_tech",
    isVerified: true,
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="w-full max-w-md mx-auto rounded-xl border border-border/80 bg-card p-4 shadow-xl space-y-4">
      {/* Contact Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-sm text-primary">
            PN
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm text-foreground">{mockPerson.name}</span>
              <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="text-xs text-muted-foreground">{mockPerson.title} • {mockPerson.company}</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
          VERIFIED
        </Badge>
      </div>

      {/* 1-Click Action Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* WhatsApp */}
        <a
          href={mockPerson.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          <span>WhatsApp Chat</span>
        </a>

        {/* Phone */}
        <a
          href={`tel:${mockPerson.phone.replace(/\s+/g, "")}`}
          className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 text-foreground text-xs font-medium transition-colors"
        >
          <Phone className="h-4 w-4 text-primary" />
          <span>Direct Call</span>
        </a>
      </div>

      {/* Email Channels */}
      <div className="space-y-2 text-xs">
        {/* Work Email */}
        <div className="flex items-center justify-between p-2 rounded-lg border border-border/40 bg-background/50">
          <div className="flex items-center gap-2 truncate">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground truncate font-mono text-[11px]">{mockPerson.workEmail}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => handleCopy("workEmail", mockPerson.workEmail)}
            >
              {copiedKey === "workEmail" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </Button>
            <a href={`mailto:${mockPerson.workEmail}`} className="p-1 text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Personal Email */}
        <div className="flex items-center justify-between p-2 rounded-lg border border-border/40 bg-background/50">
          <div className="flex items-center gap-2 truncate">
            <Mail className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-foreground truncate font-mono text-[11px]">{mockPerson.personalEmail}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => handleCopy("personalEmail", mockPerson.personalEmail)}
            >
              {copiedKey === "personalEmail" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </Button>
            <a href={`mailto:${mockPerson.personalEmail}`} className="p-1 text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Platform Shortcuts */}
      <div className="flex items-center justify-center gap-2 pt-1 border-t border-border/40">
        <a
          href={mockPerson.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <LinkedInIcon className="h-3.5 w-3.5" />
          <span>LinkedIn</span>
        </a>
        <a
          href={mockPerson.twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <TwitterIcon className="h-3.5 w-3.5" />
          <span>Twitter / X</span>
        </a>
      </div>
    </div>
  );
}
