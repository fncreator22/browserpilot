import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { checkCapabilityEntitlement } from "@/lib/billing/entitlementService";
import { parseMultimodalCareerInput, type ParsedMultimodalIntent } from "@/lib/ai/multimodalParser";
import { executeDeepReachScan } from "@/lib/discovery/deepreach/deepReachService";
import { resolveGeminiApiKey } from "@/lib/ai/modelSelector";
import { getCompanyIntelligence } from "@/lib/discovery/company/companyIntelligence";
import { 
  checkUrlLiveness, 
  computeListingTrustScore, 
  verifyRecruiterContactsMidway, 
  type VerifiableRecruiterContact, 
  type VerifiableJobCandidate 
} from "@/lib/verification/midwayVerifier";
import { normalizeCompany } from "@/lib/scraper/normalizer";

const STOP_WORDS = new Set([
  "check", "the", "image", "and", "find", "me", "jd", "job", "description",
  "what", "is", "this", "look", "at", "please", "search", "for", "a", "an",
  "can", "you", "extract", "show", "get", "tell", "from", "in", "here", "to", "my", "our",
  "details", "detail", "post", "info", "information", "screenshot", "flyer", "notice",
  "text", "content", "hiring", "careers", "jobs", "roles", "role", "position", "positions",
  "openings", "opening", "vacancy", "vacancies", "urgent", "update", "alert", "feed",
  "profile", "profiles", "page", "website", "link", "links", "url", "urls"
]);

function extractTargetCompanyFromPrompt(text: string): string | undefined {
  if (!text) return undefined;
  
  // 1. Check patterns like "at Stripe", "for Google", "company: Apple", "employer: HCLTech"
  const patternMatch = text.match(/(?:at|for|company:?|employer:?)\s+([A-Za-z0-9_.-]+)/i);
  if (patternMatch && patternMatch[1] && !STOP_WORDS.has(patternMatch[1].toLowerCase())) {
    return patternMatch[1].trim();
  }

  // 2. Filter words against stop words and find plausible candidate
  const words = text.replace(/[^a-zA-Z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const nonStopWords = words.filter(w => !STOP_WORDS.has(w.toLowerCase()) && w.length >= 2);
  
  // Return capitalized candidate if any (never return lowercase generic word like "details")
  const candidate = nonStopWords.find(w => /^[A-Z][a-zA-Z0-9]+$/.test(w));
  return candidate;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as any).id : null;

    const body = await req.json();
    const { imageBase64, mimeType, prompt, companyName, roleTitle, apiKey, puterToken, ocrText, channels } = body;

    // 1. Subscription & Entitlement Gate Check
    if (userId) {
      const entitlement = await checkCapabilityEntitlement(userId, "PREMIUM_DEEP_REACH");
      if (!entitlement.allowed) {
        const { recordLifecycleAlert } = await import("@/lib/db/opportunities");
        recordLifecycleAlert({
          userId,
          transitionType: "UPGRADE_RECOMMENDED",
          previousStatus: "FREE_TIER",
          newStatus: "UPGRADE_REQUIRED",
          title: "DeepReach Pro Feature Available",
          companyName: "BrowserPilot Pro",
          message: "DeepReach multi-platform intelligence & recruiter discovery is a Pro feature. Upgrade your subscription to unlock cross-platform scraping.",
          idempotencyKey: `${userId}_upgrade_deepreach_${new Date().toISOString().slice(0, 10)}`,
        }).catch(() => {});

        return NextResponse.json(
          {
            error: "UPGRADE_REQUIRED",
            message: "DeepReach multi-platform intelligence & recruiter discovery is a Pro feature. Please upgrade your subscription to unlock cross-platform scraping.",
            upgradeUrl: "/app#settings?tab=subscription",
          },
          { status: 403 }
        );
      }
    }

    // 2. Resolve Effective AI Credentials (Dual Provider: Gemini BYOK or Puter AI)
    const effectiveApiKey = await resolveGeminiApiKey(apiKey, userId);
    let effectivePuterToken = puterToken;
    if (!effectivePuterToken && userId) {
      try {
        const { getUserPuterToken } = await import("@/lib/ai/governance/providerGovernance");
        effectivePuterToken = await getUserPuterToken(userId);
      } catch {}
    }

    // Auto-persist Puter token to ProviderConnection if provided from client
    if (puterToken && userId) {
      try {
        const { upsertPuterConnection } = await import("@/lib/ai/governance/providerGovernance");
        await upsertPuterConnection(userId, { username: "Puter User", token: puterToken }).catch(() => {});
      } catch {}
    }

    const hasAiConfigured = Boolean(effectiveApiKey || effectivePuterToken);

    // 3. Multimodal Intake (If user uploaded an image / flyer screenshot)
    let targetCompany = companyName;
    let targetRole = roleTitle;
    let multimodalSummary: string | undefined;
    let parsedIntent: ParsedMultimodalIntent | undefined;

    if (imageBase64) {
      if (!hasAiConfigured) {
        return NextResponse.json(
          {
            error: "AI_CONFIGURATION_REQUIRED",
            message: "DeepReach Vision requires either a connected Puter account (free 1-click) or a Gemini API Key to inspect screenshots. Please connect Puter or add your key in Settings (Tab 1: AI Providers & Keys).",
          },
          { status: 400 }
        );
      }

      parsedIntent = await parseMultimodalCareerInput({
        base64Data: imageBase64,
        mimeType: mimeType || "image/png",
        textContent: prompt,
        apiKey: effectiveApiKey || undefined,
        puterToken: effectivePuterToken || undefined,
        ocrText,
        userId: userId || undefined,
      });

      if (parsedIntent.companyName && !STOP_WORDS.has(parsedIntent.companyName.toLowerCase())) {
        targetCompany = targetCompany || parsedIntent.companyName;
      }
      if (parsedIntent.jobTitle && !STOP_WORDS.has(parsedIntent.jobTitle.toLowerCase())) {
        targetRole = targetRole || parsedIntent.jobTitle;
      }
      multimodalSummary = parsedIntent.rawTextSummary;
    }

    if (!targetCompany && prompt) {
      // Robust company extraction filtering conversational stop words
      targetCompany = extractTargetCompanyFromPrompt(prompt);
    }

    if (targetCompany && STOP_WORDS.has(targetCompany.toLowerCase())) {
      targetCompany = undefined;
    }

    // 4. URL Liveness & Destination Analysis (Short-link unmasking & Affiliate funnel detection)
    const primaryUrl = parsedIntent?.extractedUrls?.[0];
    let livenessReport: { live: boolean; status?: number; finalUrl?: string; analysis?: any } | undefined;
    if (primaryUrl) {
      try {
        livenessReport = await checkUrlLiveness(primaryUrl, 5000);
      } catch {}
    }

    // 5. Recruiter Personnel Extraction & Verification from multimodal mentions
    const rawRecruiters: VerifiableRecruiterContact[] = [];
    let extractedEmail: string | undefined;

    if (parsedIntent?.hiringTeamMentions?.length) {
      for (const mention of parsedIntent.hiringTeamMentions) {
        const emailMatch = mention.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch && !extractedEmail) {
          extractedEmail = emailMatch[0];
        }

        if (mention.startsWith("Recruiter:")) {
          const name = mention.replace(/^Recruiter:\s*/, "").trim();
          if (name && name.length >= 3) {
            rawRecruiters.push({
              fullName: name,
              roleTitle: "HR Recruiter",
              companyName: targetCompany || "Undisclosed Employer",
              profileUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name + " " + (targetCompany || ""))}`,
              email: extractedEmail,
              department: "Talent Acquisition",
              sourcePlatform: "LINKEDIN",
            });
          }
        } else if (mention.startsWith("Contact Email:")) {
          const email = mention.replace(/^Contact Email:\s*/, "").trim();
          const localPart = email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          rawRecruiters.push({
            fullName: localPart || "Hiring Specialist",
            roleTitle: "Talent Specialist",
            companyName: targetCompany || "Undisclosed Employer",
            profileUrl: `mailto:${email}`,
            email,
            department: "Talent Acquisition",
            sourcePlatform: "WEB",
          });
        }
      }
    }

    const verifiedRecruitersReport = await verifyRecruiterContactsMidway(rawRecruiters, { checkLiveness: false });
    const verifiedRecruiters = verifiedRecruitersReport.verified;

    // 6. Compute Comprehensive Trust Score (Ghost job & affiliate detector)
    const trustReport = computeListingTrustScore({
      companyName: targetCompany || "Undisclosed Employer",
      jobTitle: targetRole || parsedIntent?.jobTitle,
      contactEmail: extractedEmail,
      applyUrl: primaryUrl,
      urlAnalysis: livenessReport?.analysis,
    });

    // 7. Resolve Corporate Intelligence Record
    const companyIntelligence = await getCompanyIntelligence(targetCompany || "Undisclosed Employer");

    const isUndisclosed =
      !targetCompany ||
      targetCompany.toLowerCase().includes("undisclosed") ||
      targetCompany.toLowerCase().includes("usa-based") ||
      targetCompany.toLowerCase().includes("confidential") ||
      targetCompany.toLowerCase().includes("leading mnc") ||
      targetCompany.toLowerCase().includes("reputed company");

    // 8. Branch execution: Verified Corporate Target vs Undisclosed/Flyer Intake
    if (!isUndisclosed && targetCompany) {
      // Execute Full Multi-Platform DeepReach Scan
      const scanResult = await executeDeepReachScan({
        companyName: targetCompany,
        roleTitle: targetRole || "Software Engineer",
        includeRecruiters: true,
        channels,
      });

      // Merge verified flyer recruiters into scanResult.recruiters
      const mergedRecruiters = [...scanResult.recruiters];
      for (const rec of verifiedRecruiters) {
        if (!mergedRecruiters.some(r => r.fullName.toLowerCase() === rec.fullName.toLowerCase())) {
          mergedRecruiters.push(rec);
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          ...scanResult,
          recruiters: mergedRecruiters,
          companyIntelligence,
          trustReport,
          urlAnalysis: livenessReport?.analysis,
          multimodalSummary,
        },
      });
    }

    // Handle Undisclosed / Direct Flyer Intake (Ghost job or affiliate funnel intelligence)
    if (parsedIntent || primaryUrl || verifiedRecruiters.length > 0 || targetRole) {
      const effectiveName = targetCompany || "Undisclosed Employer";
      const flyerJob: VerifiableJobCandidate = {
        companyName: effectiveName,
        title: targetRole || parsedIntent?.jobTitle || "Open Opportunity",
        applyUrl: livenessReport?.finalUrl || primaryUrl || "#",
        sourcePlatform: (parsedIntent?.detectedSourcePlatform as any) || "WEB",
        workMode: parsedIntent?.workMode || "REMOTE",
      };

      return NextResponse.json({
        success: true,
        data: {
          companyName: effectiveName,
          normalizedName: normalizeCompany(effectiveName),
          isUndisclosed: true,
          jobs: [flyerJob],
          recruiters: verifiedRecruiters,
          sourcesScanned: ["MULTIMODAL_VISION", "URL_ANALYZER", "MIDWAY_VERIFIER"],
          verificationSummary: {
            scannedJobs: 1,
            verifiedJobs: trustReport.isGhostJob ? 0 : 1,
            scannedRecruiters: rawRecruiters.length,
            verifiedRecruiters: verifiedRecruiters.length,
            rejectionReasons: trustReport.reasons,
          },
          companyIntelligence,
          trustReport,
          urlAnalysis: livenessReport?.analysis,
          multimodalSummary: multimodalSummary || parsedIntent?.rawTextSummary,
        },
      });
    }

    return NextResponse.json(
      {
        error: "MISSING_COMPANY_TARGET",
        message: "Could not identify a company name or job details from the input. Please upload a clear job flyer or specify a company name (e.g. 'Stripe' or 'Google').",
      },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[DeepReach Route Error]:", err);
    return NextResponse.json(
      {
        error: "DEEP_REACH_EXECUTION_ERROR",
        message: err.message || "An unexpected error occurred during cross-platform intelligence scan.",
      },
      { status: 500 }
    );
  }
}
