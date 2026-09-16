/**
 * §MULTIMODAL INTAKE & VISION PARSER
 * Parses screenshots, flyer images, raw HTML, and JSON job posts into structured discovery intent.
 * Powered by Gemini Vision (@google/genai) with offline heuristic fallbacks.
 */

import { GoogleGenAI } from "@google/genai";
import { getEffectiveGeminiApiKey } from "./modelSelector";

export interface ParsedMultimodalIntent {
  companyName?: string;
  jobTitle?: string;
  extractedUrls: string[];
  skills: string[];
  location?: string;
  workMode?: "REMOTE" | "HYBRID" | "ON_SITE" | "ANY";
  rawTextSummary: string;
  hiringTeamMentions: string[];
  detectedSourcePlatform: "LINKEDIN" | "X" | "REDDIT" | "ATS" | "YOUTUBE" | "WEB";
}

export interface MultimodalInput {
  base64Data?: string; // e.g. "data:image/png;base64,..." or raw base64
  mimeType?: string;   // e.g. "image/png", "image/jpeg", "image/webp"
  textContent?: string; // HTML snippet, JSON dump, or raw pasted job description
  apiKey?: string;
  puterToken?: string;
  ocrText?: string;
  userId?: string;
}

const VISION_SYSTEM_INSTRUCTION = `
You are the Multimodal Career Intent Extractor for BrowserPilot.
Your task is to analyze user-uploaded job screenshots, flyer images, HTML snippets, or JSON posts.
Extract the company name, job title, any links or handles visible, key skills, and any named hiring managers or recruiters.

Return ONLY a valid JSON object matching this structure:
{
  "companyName": "string or null",
  "jobTitle": "string or null",
  "extractedUrls": ["https://..."],
  "skills": ["TypeScript", "Next.js"],
  "location": "string or null",
  "workMode": "REMOTE | HYBRID | ON_SITE | ANY",
  "rawTextSummary": "1-2 sentence summary of what was found",
  "hiringTeamMentions": ["Jane Doe (Recruiter)", "@recruiter_handle"],
  "detectedSourcePlatform": "LINKEDIN | X | REDDIT | ATS | YOUTUBE | WEB"
}
`;

/**
 * Parse multimodal image or text input into structured discovery parameters
 * Supports dual AI providers: Gemini Vision and Puter AI (Vision & OCR).
 */
export async function parseMultimodalCareerInput(
  input: MultimodalInput
): Promise<ParsedMultimodalIntent> {
  const { base64Data, mimeType = "image/png", textContent, apiKey, puterToken, ocrText, userId } = input;
  const effectiveKey = getEffectiveGeminiApiKey(apiKey);

  // 1. If we have an image and Gemini API key, use Gemini Vision
  if (base64Data && effectiveKey) {
    try {
      const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
      const ai = new GoogleGenAI({ apiKey: effectiveKey });

      const contents: any[] = [
        {
          inlineData: {
            data: cleanBase64,
            mimeType,
          },
        },
        {
          text: "Extract all career and hiring details from this image according to the schema.",
        },
      ];

      if (textContent) {
        contents.push({ text: `Additional context provided by user: ${textContent}` });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: VISION_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      const responseText = response.text?.trim();
      if (responseText) {
        const parsed = JSON.parse(responseText);
        return {
          companyName: parsed.companyName || undefined,
          jobTitle: parsed.jobTitle || undefined,
          extractedUrls: Array.isArray(parsed.extractedUrls) ? parsed.extractedUrls : [],
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
          location: parsed.location || undefined,
          workMode: parsed.workMode || "ANY",
          rawTextSummary: parsed.rawTextSummary || "Parsed career image via Gemini Vision",
          hiringTeamMentions: Array.isArray(parsed.hiringTeamMentions) ? parsed.hiringTeamMentions : [],
          detectedSourcePlatform: parsed.detectedSourcePlatform || "WEB",
        };
      }
    } catch (visionErr) {
      console.warn("[MultimodalParser] Gemini Vision encountered error, falling back to Puter/heuristic:", visionErr);
    }
  }

  // 2. If Puter Token is available, use Puter AI (via client OCR text or Puter multimodal vision)
  if (puterToken) {
    try {
      const { callPuterChatCompletion } = await import("@/lib/ai/puterClient");

      // Case 2a: OCR text was already extracted on client side via window.puter.ai.img2txt
      if (ocrText && ocrText.trim().length > 0) {
        const puterRes = await callPuterChatCompletion({
          token: puterToken,
          userId,
          operation: "INTENT_PARSING",
          model: "claude-3-7-sonnet",
          messages: [
            { role: "system", content: VISION_SYSTEM_INSTRUCTION },
            {
              role: "user",
              content: `Analyze this career text extracted from an image.\nUser prompt: "${textContent || ""}"\nImage OCR Text:\n${ocrText}`,
            },
          ],
        });

        const rawContent = puterRes.content.replace(/```json|```/gi, "").trim();
        const parsed = JSON.parse(rawContent);
        return {
          companyName: parsed.companyName || undefined,
          jobTitle: parsed.jobTitle || undefined,
          extractedUrls: Array.isArray(parsed.extractedUrls) ? parsed.extractedUrls : [],
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
          location: parsed.location || undefined,
          workMode: parsed.workMode || "ANY",
          rawTextSummary: parsed.rawTextSummary || `Parsed image text via Puter AI (${puterRes.modelUsed})`,
          hiringTeamMentions: Array.isArray(parsed.hiringTeamMentions) ? parsed.hiringTeamMentions : [],
          detectedSourcePlatform: parsed.detectedSourcePlatform || "WEB",
        };
      }

      // Case 2b: Server-side Puter Multimodal Vision
      if (base64Data) {
        const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
        const puterRes = await callPuterChatCompletion({
          token: puterToken,
          userId,
          operation: "INTENT_PARSING",
          model: "gpt-4o",
          messages: [
            { role: "system", content: VISION_SYSTEM_INSTRUCTION },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract all career and hiring details from this image according to the schema. User prompt: "${textContent || ""}"`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${cleanBase64}`,
                  },
                },
              ],
            },
          ],
        });

        const rawContent = puterRes.content.replace(/```json|```/gi, "").trim();
        const parsed = JSON.parse(rawContent);
        return {
          companyName: parsed.companyName || undefined,
          jobTitle: parsed.jobTitle || undefined,
          extractedUrls: Array.isArray(parsed.extractedUrls) ? parsed.extractedUrls : [],
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
          location: parsed.location || undefined,
          workMode: parsed.workMode || "ANY",
          rawTextSummary: parsed.rawTextSummary || `Parsed career image via Puter Vision (${puterRes.modelUsed})`,
          hiringTeamMentions: Array.isArray(parsed.hiringTeamMentions) ? parsed.hiringTeamMentions : [],
          detectedSourcePlatform: parsed.detectedSourcePlatform || "WEB",
        };
      }
    } catch (puterErr) {
      console.warn("[MultimodalParser] Puter AI vision processing encountered error, falling back to heuristic:", puterErr);
    }
  }

  // 3. Heuristic parser for text/HTML/JSON or when AI providers are unavailable
  const combinedText = [textContent, ocrText].filter(Boolean).join("\n");
  return extractHeuristicCareerIntent(combinedText);
}

/**
 * Robust regex & heuristic extractor when Vision is offline or input is plain text/HTML
 */
const HEURISTIC_STOP_WORDS = new Set([
  "check", "the", "image", "and", "find", "me", "jd", "job", "description",
  "what", "is", "this", "look", "at", "please", "search", "for", "a", "an",
  "can", "you", "extract", "show", "get", "tell", "from", "in", "here", "to", "my", "our",
  "details", "detail", "post", "info", "information", "screenshot", "flyer", "notice",
  "text", "content", "hiring", "careers", "jobs", "roles", "role", "position", "positions",
  "openings", "opening", "vacancy", "vacancies", "urgent", "update", "alert", "feed"
]);

const KNOWN_TECH_BRANDS = [
  "HCLTech", "HCL", "Google", "Amazon", "Microsoft", "Meta", "Apple", "Netflix",
  "Uber", "Stripe", "Airbnb", "TCS", "Infosys", "Wipro", "Cognizant", "Accenture",
  "Capgemini", "Oracle", "Salesforce", "Cisco", "Intel", "Adobe", "Nvidia",
  "Palantir", "Databricks", "Snowflake", "DoorDash", "Pinterest", "Spotify"
];

/**
 * Robust regex & heuristic extractor when Vision is offline or input is plain text/HTML
 */
export function extractHeuristicCareerIntent(text: string): ParsedMultimodalIntent {
  const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
  const extractedUrls = Array.from(new Set(text.match(urlRegex) || []));

  // Platform detection
  let detectedSourcePlatform: ParsedMultimodalIntent["detectedSourcePlatform"] = "WEB";
  const lower = text.toLowerCase();
  if (lower.includes("linkedin.com") || lower.includes("linkedin")) detectedSourcePlatform = "LINKEDIN";
  else if (lower.includes("twitter.com") || lower.includes("x.com")) detectedSourcePlatform = "X";
  else if (lower.includes("reddit.com") || lower.includes("r/")) detectedSourcePlatform = "REDDIT";
  else if (lower.includes("greenhouse.io") || lower.includes("lever.co") || lower.includes("ashbyhq.com")) detectedSourcePlatform = "ATS";
  else if (lower.includes("youtube.com") || lower.includes("youtu.be")) detectedSourcePlatform = "YOUTUBE";

  // Work mode detection
  let workMode: ParsedMultimodalIntent["workMode"] = "ANY";
  if (lower.includes("remote")) workMode = "REMOTE";
  else if (lower.includes("hybrid")) workMode = "HYBRID";
  else if (lower.includes("on-site") || lower.includes("onsite")) workMode = "ON_SITE";

  // Recruiter mentions detection
  const hiringTeamMentions: string[] = [];
  
  // 1. Explicit recruiter labels: "Recruiter: John", "Email - foo@bar.com", "Contact: Alice"
  const recruiterMatches = text.match(/(?:recruiter|talent|hiring manager|contact|posted by|email)\s*[:=-]\s*([a-zA-Z0-9\s@._-]+)/gi);
  if (recruiterMatches) {
    hiringTeamMentions.push(...recruiterMatches.map((m) => m.trim().replace(/[\r\n]+/g, " ")).slice(0, 3));
  }

  // 2. Direct email mentions e.g. Tanu.hr.recruiter@gmail.com
  const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emailMatches) {
    for (const email of emailMatches.slice(0, 2)) {
      if (!hiringTeamMentions.some((m) => m.includes(email))) {
        hiringTeamMentions.push(`Contact Email: ${email}`);
      }
    }
  }

  // 3. Header poster pattern e.g. "Khushwinder Singh • 3rd+\nHR RECRUITER"
  const headerPosterMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*(?:•|\n|\|)[\s\S]{1,60}?(?:HR\s+RECRUITER|RECRUITER|Talent)/i);
  if (headerPosterMatch && headerPosterMatch[1]) {
    const posterName = headerPosterMatch[1].trim();
    if (!hiringTeamMentions.some((m) => m.includes(posterName))) {
      hiringTeamMentions.unshift(`Recruiter: ${posterName}`);
    }
  }

  // 1. Company Name Heuristic Extraction
  let companyName: string | undefined = undefined;

  // Pattern A: Check known major brands
  for (const brand of KNOWN_TECH_BRANDS) {
    if (new RegExp(`\\b${brand}\\b`, "i").test(text)) {
      companyName = brand;
      break;
    }
  }

  // Pattern B: "[Company] IS HIRING" or "[Company] Hiring" or "[Company] Careers"
  if (!companyName) {
    const hiringMatch = text.match(/\b([A-Z0-9][A-Za-z0-9&.-]+)\s+(?:is\s+hiring|is\s+actively\s+hiring|hiring|careers|walk-?in|drives?)\b/i);
    if (hiringMatch && hiringMatch[1] && !HEURISTIC_STOP_WORDS.has(hiringMatch[1].toLowerCase())) {
      companyName = hiringMatch[1].trim();
    }
  }

  // Pattern C: "Company: [Name]" or "Employer: [Name]" or "at [Company]"
  if (!companyName) {
    const companyLabelMatch = text.match(/\b(?:company|organization|employer|at)\b\s*[:=-]?\s*([A-Z0-9][A-Za-z0-9&.-]+)/i);
    if (companyLabelMatch && companyLabelMatch[1]) {
      const candidate = companyLabelMatch[1].replace(/[.,;:!?]+$/, "").trim();
      if (candidate.length >= 2 && !HEURISTIC_STOP_WORDS.has(candidate.toLowerCase())) {
        companyName = candidate;
      }
    }
  }

  // Pattern D: Recruiter email domain e.g. recruiter@hcltech.com -> HCLTech
  if (!companyName) {
    const emailDomainMatch = text.match(/@([a-zA-Z0-9-]+)\.(?:com|org|io|ai|in|co)\b/i);
    if (emailDomainMatch && emailDomainMatch[1]) {
      const dom = emailDomainMatch[1].toLowerCase();
      if (!["gmail", "yahoo", "outlook", "hotmail", "proton", "icloud"].includes(dom) && !HEURISTIC_STOP_WORDS.has(dom)) {
        companyName = emailDomainMatch[1].charAt(0).toUpperCase() + emailDomainMatch[1].slice(1);
      }
    }
  }

  // 2. Job Title Heuristic Extraction
  let jobTitle: string | undefined = undefined;
  const roleMatch = text.match(/\b(Software\s+(?:Development\s+)?Engineer(?:\s+(?:I{1,3}|[1-3]|Intern|Lead|Senior|Staff))?|Frontend\s+(?:Engineer|Developer)|Backend\s+(?:Engineer|Developer)|Full\s*Stack\s+(?:Engineer|Developer)|Data\s+(?:Scientist|Engineer|Analyst)|DevOps\s+Engineer|Machine\s+Learning\s+Engineer|ML\s+Engineer|Product\s+Manager|QA\s+Engineer|Systems\s+Engineer|Graduate\s+Engineer\s+Trainee|Associate\s+Consultant|Analyst|Consultant|Team\s+Lead|Recruiter|HR\s+Executive)\b/i);
  if (roleMatch && roleMatch[1]) {
    jobTitle = roleMatch[1].trim();
  } else {
    const roleLabelMatch = text.match(/(?:open\s+roles?|roles?|positions?|profiles?|titles?|designations?)\s*[:=-]?\s*([A-Za-z0-9\s/.-]{3,35})(?:\n|\r|\.|;|,|$)/i);
    if (roleLabelMatch && roleLabelMatch[1] && !HEURISTIC_STOP_WORDS.has(roleLabelMatch[1].trim().toLowerCase())) {
      jobTitle = roleLabelMatch[1].trim();
    } else {
      const nextLineRole = text.match(/(?:open\s+roles?|roles?|positions?)\s*[:=-]?\s*(?:\n|\r)\s*([A-Za-z0-9\s/.-]{3,35})/i);
      if (nextLineRole && nextLineRole[1] && !HEURISTIC_STOP_WORDS.has(nextLineRole[1].trim().toLowerCase())) {
        jobTitle = nextLineRole[1].trim();
      }
    }
  }

  // Common skill tokens
  const commonSkills = ["TypeScript", "JavaScript", "Python", "React", "Next.js", "Node.js", "SQL", "Go", "AWS", "Rust", "Java", "C++", "Docker", "Kubernetes"];
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const skills = commonSkills.filter((s) => new RegExp(`(?:^|\\W)${escapeRegex(s)}(?:$|\\W)`, "i").test(text));

  return {
    companyName,
    jobTitle,
    extractedUrls,
    skills,
    workMode,
    rawTextSummary: text.slice(0, 160).trim() || "Parsed career text",
    hiringTeamMentions,
    detectedSourcePlatform,
  };
}
