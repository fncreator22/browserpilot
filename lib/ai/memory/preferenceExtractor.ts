/**
 * §PREFERENCE EXTRACTOR & ADMISSION BRIDGE (TASK-056)
 * 
 * Maps natural-language user preference statements (e.g. "Remember that I prefer remote backend roles in India")
 * into typed MemoryAdmissionCandidate objects and evaluates them through the authoritative UserMemoryVault.
 * 
 * Invariants:
 * 1. Transient search requests ("Find 5 jobs") are rejected.
 * 2. Sensitive credentials/keys are strictly rejected.
 * 3. Explicit durable preference language is admitted with EXPLICIT confidence.
 * 4. Recommendation signals remain distinct from explicit preferences.
 */

import { type MemoryAdmissionCandidate, type UserMemoryItem } from "./memoryTypes";
import { userMemoryVault } from "./userMemoryVault";
import { parseSearchIntent } from "@/lib/scraper/intentParser";

const EXPLICIT_PREFERENCE_INDICATORS = [
  /\bremember\s+(that\s+)?/i,
  /\bi\s+(prefer|target|focus\s+on|love|like|want)\b/i,
  /\bmy\s+preference\s+(is|are)\b/i,
  /\bgoing\s+forward\b/i,
  /\balways\s+prioritize\b/i,
  /\bprioritize\s+(remote|hybrid|onsite|on-site)\b/i,
  /\bi('m| am)\s+(looking|targeting|seeking)\s+for\s+(remote|hybrid|backend|frontend|fullstack)/i,
];

export interface ExtractedPreferenceResult {
  isExplicitPreference: boolean;
  admittedMemories: UserMemoryItem[];
  rejectedReasons: string[];
}

/**
 * Extracts and stores durable preferences from natural-language user statements.
 */
export async function extractAndStorePreferences(
  userId: string,
  text: string
): Promise<ExtractedPreferenceResult> {
  const cleanUserId = userId.trim();
  const cleanText = text.trim();

  const isExplicit = EXPLICIT_PREFERENCE_INDICATORS.some((re) => re.test(cleanText));

  if (!isExplicit) {
    return {
      isExplicitPreference: false,
      admittedMemories: [],
      rejectedReasons: [
        "TRANSIENT_INTERACTION: Routine search requests without explicit preference keywords (e.g. 'Remember that', 'I prefer') are not permanent memory.",
      ],
    };
  }

  // Parse structured parameters using the deterministic intent parser
  const parsed = parseSearchIntent(cleanText);

  const candidates: MemoryAdmissionCandidate[] = [];

  // 1. Role preference
  if (parsed.roles && parsed.roles.length > 0) {
    candidates.push({
      userId: cleanUserId,
      category: "ROLE_PREFERENCE",
      key: "preferred_role",
      value: parsed.roles[0],
      confidence: isExplicit ? "EXPLICIT" : "INFERRED",
      importance: 0.9,
      isExplicit,
      sourceContext: cleanText,
    });
  } else if (parsed.role && parsed.role !== "Software Engineer") {
    candidates.push({
      userId: cleanUserId,
      category: "ROLE_PREFERENCE",
      key: "preferred_role",
      value: parsed.role,
      confidence: isExplicit ? "EXPLICIT" : "INFERRED",
      importance: 0.9,
      isExplicit,
      sourceContext: cleanText,
    });
  }

  // 2. Work mode preference
  if (parsed.workModes && parsed.workModes.length > 0 && !parsed.workModes.includes("ANY")) {
    candidates.push({
      userId: cleanUserId,
      category: "WORK_MODE_PREFERENCE",
      key: "preferred_work_mode",
      value: parsed.workModes[0],
      confidence: isExplicit ? "EXPLICIT" : "INFERRED",
      importance: 0.85,
      isExplicit,
      sourceContext: cleanText,
    });
  }

  // 3. Location preference
  if (parsed.locations && parsed.locations.length > 0) {
    candidates.push({
      userId: cleanUserId,
      category: "LOCATION_PREFERENCE",
      key: "preferred_location",
      value: parsed.locations[0],
      confidence: isExplicit ? "EXPLICIT" : "INFERRED",
      importance: 0.8,
      isExplicit,
      sourceContext: cleanText,
    });
  }

  // 4. Skills interest
  if (parsed.skills && parsed.skills.length > 0) {
    candidates.push({
      userId: cleanUserId,
      category: "SKILL_INTEREST",
      key: "target_skills",
      value: parsed.skills.join(", "),
      confidence: isExplicit ? "EXPLICIT" : "INFERRED",
      importance: 0.75,
      isExplicit,
      sourceContext: cleanText,
    });
  }

  // Fallback: If no structured role/mode was parsed but the user used explicit phrasing
  if (candidates.length === 0 && isExplicit) {
    candidates.push({
      userId: cleanUserId,
      category: "CAREER_PREFERENCE",
      key: "user_stated_preference",
      value: cleanText.replace(/^(remember\s+that\s+|i\s+prefer\s+|going\s+forward\s+)/i, ""),
      confidence: "EXPLICIT",
      importance: 0.8,
      isExplicit: true,
      sourceContext: cleanText,
    });
  }

  // If still no candidates, or it was a raw transient search without explicit indicators
  if (candidates.length === 0) {
    return {
      isExplicitPreference: false,
      admittedMemories: [],
      rejectedReasons: ["TRANSIENT_INTERACTION: Text does not express durable career preferences."],
    };
  }

  const admittedMemories: UserMemoryItem[] = [];
  const rejectedReasons: string[] = [];

  for (const candidate of candidates) {
    const storeRes = await userMemoryVault.storeMemory(candidate);
    if (storeRes.success && storeRes.memoryItem) {
      admittedMemories.push(storeRes.memoryItem);
    } else if (storeRes.rejectionReason) {
      rejectedReasons.push(storeRes.rejectionReason);
    }
  }

  return {
    isExplicitPreference: isExplicit,
    admittedMemories,
    rejectedReasons,
  };
}
