/**
 * §OPPORTUNITY ENRICHMENT SERVICE (HR RECRUITERS & COMPANY INTELLIGENCE)
 * 
 * Enriches every discovered job/internship/fellowship with:
 * 1. Verified & discovered HR recruiters, talent acquisition leads, hiring managers.
 * 2. Total company employees count / headcount bracket from company intelligence.
 * 3. Canonical share URL and social share links (LinkedIn, X/Twitter, WhatsApp, Reddit).
 */

import { prisma } from "@/lib/db/prisma";
import { normalizeCompany } from "@/lib/scraper/normalizer";
import { getCompanyIntelligence } from "@/lib/discovery/company/companyIntelligence";
import { discoverCompanyRecruiters } from "@/lib/discovery/deepreach/deepReachService";

import { 
  resolveCompanyPersonnel, 
  buildDirectConnectLinks, 
  type DirectConnectLinks 
} from "@/lib/discovery/personnel/companyPersonnelDirectory";

export interface EnrichedCompanyContact {
  id?: string;
  fullName: string;
  roleTitle: string;
  department?: string;
  contactType: "RECRUITER" | "EMPLOYEE";
  profileUrl: string;
  email?: string;
  personalEmail?: string;
  phone?: string;
  whatsappUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  directConnect: DirectConnectLinks;
  isVerified: boolean;
  sourcePlatform: string;
  confidenceScore?: number;
  emailVerificationTier?: "derived" | "mx_verified" | "directory";
  provenance?: string;
  mxRecords?: string[];
}

export interface EnrichedOpportunityData {
  companyContacts: EnrichedCompanyContact[];
  companyEmployeesCount: string;
  shareUrl: string;
  socialShareUrls: {
    direct: string;
    linkedIn: string;
    twitter: string;
    whatsApp: string;
    reddit: string;
  };
  companyProfile?: {
    domain?: string | null;
    headquarters?: string | null;
    atsProvider?: string | null;
    atsUrl?: string | null;
  };
}

// In-memory cache for company-level intelligence & HR contacts (indexed by normalized company name)
interface CompanyIntelCacheItem {
  headcount: string;
  domain: string | null;
  headquarters: string | null;
  atsProvider: string | null;
  atsUrl: string | null;
  contacts: EnrichedCompanyContact[];
  expiresAt: number;
}
const companyIntelCache = new Map<string, CompanyIntelCacheItem>();
const inFlightIntel = new Map<string, Promise<CompanyIntelCacheItem>>();

async function resolveCompanyIntel(companyName: string): Promise<CompanyIntelCacheItem> {
  const norm = normalizeCompany(companyName);
  const cached = companyIntelCache.get(norm);
  if (cached && Date.now() < cached.expiresAt) {
    return cached;
  }

  const inFlight = inFlightIntel.get(norm);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    let headcount = "Corporate Enterprise";
    let domain: string | null = null;
    let headquarters: string | null = null;
    let atsProvider: string | null = null;
    let atsUrl: string | null = null;

    try {
      const intel = await getCompanyIntelligence(companyName);
      if (intel) {
        headcount = intel.employeeHeadcountBracket || headcount;
        domain = intel.officialDomain || null;
        headquarters = intel.headquarters || null;
        atsProvider = intel.atsProvider || null;
        atsUrl = intel.atsUrl || null;
      }
    } catch {}

    const contacts: EnrichedCompanyContact[] = [];
    try {
      const dbContacts = await prisma.companyContact.findMany({
        where: { normalizedName: norm },
        take: 8,
      });

      const FORBIDDEN_SYNTHETIC_NAMES = new Set([
        "sarah jenkins", "alex morgan", "elena rostova", "david chen", "marcus vance",
        "claire beaumont", "ananya deshmukh", "arun kumar", "sneha rao", "vikram patel", "divya menon"
      ]);

      // Filter for valid verified individual contacts or official company teams (exclude legacy fake personas)
      const validDbContacts = dbContacts.filter((c) => {
        if (!c.fullName) return false;
        const lower = c.fullName.toLowerCase().trim();
        if (FORBIDDEN_SYNTHETIC_NAMES.has(lower)) return false;
        if (c.phone && c.phone.includes("555")) return false;
        return Boolean(c.email || c.personalEmail || c.profileUrl);
      });

      if (validDbContacts.length > 0) {
        for (const c of validDbContacts) {
          const directConnect = buildDirectConnectLinks({
            fullName: c.fullName,
            roleTitle: c.roleTitle,
            companyName: c.companyName,
            department: c.department || undefined,
            contactType: (c.contactType as "RECRUITER" | "EMPLOYEE") || "RECRUITER",
            profileUrl: c.profileUrl,
            email: c.email || undefined,
            personalEmail: c.personalEmail || undefined,
            phone: c.phone || undefined,
            whatsappUrl: c.whatsappUrl || undefined,
            twitterUrl: c.twitterUrl || undefined,
            githubUrl: c.githubUrl || undefined,
            portfolioUrl: c.portfolioUrl || undefined,
            sourcePlatform: c.sourcePlatform,
          });

          const isDirectory =
            c.sourcePlatform === "OFFICIAL_PORTAL" ||
            c.fullName.toLowerCase().includes("team") ||
            c.fullName.toLowerCase().includes("talent acquisition");

          const emailVerificationTier = isDirectory ? "directory" : "derived";
          const provenance = isDirectory ? "Company Talent Directory" : "Direct Recruiter Slug (Derived Email)";

          contacts.push({
            id: c.id,
            fullName: c.fullName,
            roleTitle: c.roleTitle,
            department: c.department || undefined,
            contactType: (c.contactType as "RECRUITER" | "EMPLOYEE") || "RECRUITER",
            profileUrl: c.profileUrl,
            email: c.email || undefined,
            personalEmail: c.personalEmail || undefined,
            phone: c.phone || undefined,
            whatsappUrl: c.whatsappUrl || undefined,
            twitterUrl: c.twitterUrl || undefined,
            githubUrl: c.githubUrl || undefined,
            portfolioUrl: c.portfolioUrl || undefined,
            directConnect,
            isVerified: c.isVerified,
            sourcePlatform: c.sourcePlatform,
            confidenceScore: isDirectory ? 0.95 : 0.7,
            emailVerificationTier,
            provenance,
          });
        }
      } else {
        const personnel = resolveCompanyPersonnel(companyName, domain || undefined, headquarters || undefined);
        for (const p of personnel) {
          contacts.push({
            fullName: p.fullName,
            roleTitle: p.roleTitle,
            department: p.department,
            contactType: p.contactType,
            profileUrl: p.profileUrl,
            email: p.email,
            personalEmail: p.personalEmail,
            phone: p.phone,
            whatsappUrl: p.whatsappUrl,
            twitterUrl: p.twitterUrl,
            githubUrl: p.githubUrl,
            portfolioUrl: p.portfolioUrl,
            directConnect: p.directConnect,
            isVerified: true,
            sourcePlatform: p.sourcePlatform,
            confidenceScore: p.confidenceScore ?? 0.95,
            emailVerificationTier: p.emailVerificationTier ?? "directory",
            provenance: p.provenance ?? "Company Talent Directory",
          });

          prisma.companyContact.create({
            data: {
              companyName,
              normalizedName: norm,
              fullName: p.fullName,
              roleTitle: p.roleTitle,
              department: p.department,
              contactType: p.contactType,
              profileUrl: p.profileUrl,
              email: p.email,
              personalEmail: p.personalEmail,
              phone: p.phone,
              whatsappUrl: p.whatsappUrl,
              twitterUrl: p.twitterUrl,
              githubUrl: p.githubUrl,
              portfolioUrl: p.portfolioUrl,
              isVerified: true,
              sourcePlatform: p.sourcePlatform,
            },
          }).catch(() => {});
        }
      }
    } catch {}

    const item: CompanyIntelCacheItem = {
      headcount,
      domain,
      headquarters,
      atsProvider,
      atsUrl,
      contacts,
      expiresAt: Date.now() + 30 * 60 * 1000,
    };
    companyIntelCache.set(norm, item);
    return item;
  })().finally(() => {
    inFlightIntel.delete(norm);
  });

  inFlightIntel.set(norm, promise);
  return promise;
}

export async function enrichOpportunityData(params: {
  opportunityId: string;
  canonicalHash: string;
  companyName: string;
  title: string;
  primaryApplyUrl?: string;
  origin?: string;
}): Promise<EnrichedOpportunityData> {
  const baseUrl = params.origin || (process.env.NEXTAUTH_URL ? process.env.NEXTAUTH_URL.replace(/\/$/, "") : "https://browserpilot.dev");
  const directShareUrl = `${baseUrl}/opportunities/${params.opportunityId || params.canonicalHash}`;

  const shareText = encodeURIComponent(`Check out this opportunity: ${params.title} at ${params.companyName} on BrowserPilot!`);
  const shareEncodedUrl = encodeURIComponent(directShareUrl);

  const socialShareUrls = {
    direct: directShareUrl,
    linkedIn: `https://www.linkedin.com/sharing/share-offsite/?url=${shareEncodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareEncodedUrl}`,
    whatsApp: `https://api.whatsapp.com/send?text=${shareText}%20${shareEncodedUrl}`,
    reddit: `https://reddit.com/submit?url=${shareEncodedUrl}&title=${encodeURIComponent(`${params.title} at ${params.companyName}`)}`,
  };

  const companyIntel = await resolveCompanyIntel(params.companyName);

  return {
    companyContacts: companyIntel.contacts,
    companyEmployeesCount: companyIntel.headcount,
    shareUrl: directShareUrl,
    socialShareUrls,
    companyProfile: {
      domain: companyIntel.domain,
      headquarters: companyIntel.headquarters,
      atsProvider: companyIntel.atsProvider,
      atsUrl: companyIntel.atsUrl,
    },
  };
}
