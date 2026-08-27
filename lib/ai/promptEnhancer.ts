/**
 * §AUTONOMOUS PROMPT OPTIMIZER & SPECIFICATION GENERATOR
 * Transforms vague natural language user inputs into clear, professional,
 * multi-source exploration blueprints with target platforms and extraction criteria.
 */

import { GoogleGenAI } from "@google/genai";
import { getEffectiveGeminiApiKey, DEFAULT_GEMINI_MODEL } from "./modelSelector";
import { extractKeywordsFromPrompt } from "@/lib/scraper/searchResolver";

export interface OptimizedPromptResult {
  originalPrompt: string;
  enhancedPrompt: string;
  category: "JOB_SEARCH" | "PRODUCT_RESEARCH" | "COMPANY_INTEL" | "DATA_EXTRACTION" | "GENERAL_BROWSE";
  targetPlatforms: string[];
  suggestedFilters: string[];
  extractionFields: string[];
}

/**
 * Generates a professional, high-precision prompt from raw conversational user input
 */
export async function enhancePrompt(
  rawPrompt: string,
  apiKeyOverride?: string
): Promise<OptimizedPromptResult> {
  const cleanKeywords = extractKeywordsFromPrompt(rawPrompt) || rawPrompt.trim();
  const lower = rawPrompt.toLowerCase();

  // 1. Detect Category
  let category: OptimizedPromptResult["category"] = "GENERAL_BROWSE";
  let targetPlatforms = ["LinkedIn", "Y Combinator", "Indeed"];
  let suggestedFilters = ["Remote", "Hybrid", "Full-Time"];
  let extractionFields = ["Title", "Company", "Location", "Salary", "Requirements", "Apply Link"];

  if (/\b(job|jobs|role|roles|intern|internship|hire|hiring|career|vacancy|position)\b/i.test(lower)) {
    category = "JOB_SEARCH";
    targetPlatforms = ["LinkedIn", "Y Combinator", "Indeed", "Naukri"];
  } else if (/\b(startup|startups|seed|series\s*a|yc|founder|funding)\b/i.test(lower)) {
    category = "COMPANY_INTEL";
    targetPlatforms = ["Y Combinator", "TechCrunch", "GitHub"];
    suggestedFilters = ["AI Startups", "Seed Stage", "Recent Batches"];
    extractionFields = ["Company", "Batch", "Founder", "Website", "Description"];
  } else if (/\b(price|product|buy|compare|laptop|phone|amazon)\b/i.test(lower)) {
    category = "PRODUCT_RESEARCH";
    targetPlatforms = ["Amazon", "Google Shopping", "BestBuy"];
    suggestedFilters = ["Highest Rated", "Prime", "In Stock"];
    extractionFields = ["Product Name", "Price", "Rating", "Key Features", "Product URL"];
  }

  // 2. Fast LLM Enhancement (if Gemini API key is available)
  const apiKey = getEffectiveGeminiApiKey(apiKeyOverride);
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `You are an expert prompt engineer for BrowserPilot, an autonomous browser agent.
Transform the user's conversational request into a crisp, professional, unambiguous automation goal.
The enhanced prompt MUST specify target platforms, exact count, data attributes (e.g. salary, direct apply links, requirements), and format.
Keep it under 3 sentences. Do not use conversational filler or emojis.`;

      const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: `Raw User Input: "${rawPrompt}"\nTarget Category: ${category}\nKeywords: ${cleanKeywords}`,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });

      const enhancedText = response.text?.trim();
      if (enhancedText && enhancedText.length > 20) {
        return {
          originalPrompt: rawPrompt,
          enhancedPrompt: enhancedText,
          category,
          targetPlatforms,
          suggestedFilters,
          extractionFields,
        };
      }
    } catch {
      // Fallback to deterministic template
    }
  }

  // 3. Deterministic High-Signal Template Fallback
  let enhancedPrompt = "";
  if (category === "JOB_SEARCH") {
    enhancedPrompt = `Search across ${targetPlatforms.slice(0, 3).join(", ")} for 10 verified ${cleanKeywords} positions. Extract job titles, company names, locations, salary/compensation, core technical qualifications, and direct application links with visual page snapshots.`;
  } else if (category === "COMPANY_INTEL") {
    enhancedPrompt = `Explore ${targetPlatforms.slice(0, 2).join(" and ")} to identify 10 active ${cleanKeywords} companies. Extract company name, founding year, key products, website links, and team overview.`;
  } else {
    enhancedPrompt = `Navigate to ${targetPlatforms[0]} and perform an in-depth extraction for "${cleanKeywords}". Collect 10 high-signal records with names, descriptions, references, and direct source URLs.`;
  }

  return {
    originalPrompt: rawPrompt,
    enhancedPrompt,
    category,
    targetPlatforms,
    suggestedFilters,
    extractionFields,
  };
}
