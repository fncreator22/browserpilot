/**
 * §HYBRID SEMANTIC & DETERMINISTIC RETRIEVER (TASK-049)
 * 
 * Combines exact token matching with semantic synonym expansion to retrieve
 * highly relevant user memories and platform knowledge while enforcing bounded context budgets.
 */

import { userMemoryVault } from "@/lib/ai/memory/userMemoryVault";
import { type UserMemoryItem } from "@/lib/ai/memory/memoryTypes";
import { type RankedContextItem } from "./brainTypes";

const SEMANTIC_SYNONYM_MAP: Record<string, string[]> = {
  "ai": ["artificial intelligence", "machine learning", "ml", "deep learning", "nlp", "vision"],
  "ml": ["machine learning", "ai", "artificial intelligence", "data science", "pytorch", "tensorflow"],
  "machine learning": ["ml", "ai", "artificial intelligence", "deep learning"],
  "remote": ["work from home", "wfh", "anywhere", "telecommute", "distributed"],
  "work from home": ["remote", "wfh", "telecommute"],
  "intern": ["internship", "trainee", "co-op", "entry level", "student", "grad"],
  "internship": ["intern", "trainee", "co-op", "student"],
  "backend": ["server side", "api", "node", "python", "golang", "microservices"],
  "frontend": ["client side", "ui", "react", "nextjs", "typescript", "web"],
};

/**
 * Calculates semantic relevance between a query string and a target memory item.
 */
function calculateHybridRelevance(
  query: string,
  item: UserMemoryItem
): { score: number; rationale: string } {
  const qTokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const memText = `${item.key} ${item.value} ${item.category}`.toLowerCase();
  let score = item.importance * 0.4; // Base importance contribution
  const matchingTokens: string[] = [];
  const semanticMatches: string[] = [];

  // 1. Deterministic Token Match
  for (const token of qTokens) {
    if (memText.includes(token)) {
      score += 0.35;
      matchingTokens.push(token);
    }
  }

  // 2. Semantic Synonym Match
  for (const token of qTokens) {
    const synonyms = SEMANTIC_SYNONYM_MAP[token] || [];
    for (const syn of synonyms) {
      if (memText.includes(syn) && !matchingTokens.includes(syn)) {
        score += 0.25;
        semanticMatches.push(`${token} ↔ ${syn}`);
      }
    }
  }

  // 3. Category & Explicit Boost
  if (item.confidence === "EXPLICIT") {
    score += 0.15;
  }
  if (item.category === "LOCATION_PREFERENCE" || item.category === "WORK_MODE_PREFERENCE") {
    score += 0.1;
  }

  // Cap score between 0.0 and 1.0
  const finalScore = Math.min(1.0, Math.max(0.0, score));

  let rationale = "General user preference context.";
  if (matchingTokens.length > 0 && semanticMatches.length > 0) {
    rationale = `Exact match on [${matchingTokens.join(", ")}] and semantic match on [${semanticMatches.join(", ")}].`;
  } else if (matchingTokens.length > 0) {
    rationale = `Exact match on [${matchingTokens.join(", ")}].`;
  } else if (semanticMatches.length > 0) {
    rationale = `Semantic match on [${semanticMatches.join(", ")}].`;
  }

  return { score: finalScore, rationale };
}

/**
 * Retrieves and ranks user memories using hybrid retrieval with strict budget limits.
 */
export async function retrieveHybridUserMemories(
  query: string,
  userId?: string | null,
  options: {
    limit?: number;
    minScore?: number;
  } = {}
): Promise<RankedContextItem<UserMemoryItem>[]> {
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return [];
  }

  const limit = options.limit || 5;
  const minScore = options.minScore ?? 0.35;

  const rawActive = await userMemoryVault.getMemories({
    userId: userId.trim(),
    limit: 25,
  });

  if (rawActive.memories.length === 0) {
    return [];
  }

  const scored: RankedContextItem<UserMemoryItem>[] = rawActive.memories.map((mem) => {
    const { score, rationale } = calculateHybridRelevance(query, mem);
    return {
      item: mem,
      relevanceScore: score,
      provenance: "USER_MEMORY",
      confidence: mem.confidence === "EXPLICIT" ? "HIGH" : mem.confidence === "REPEATED" ? "MEDIUM" : "LOW",
      rationale,
    };
  });

  // Filter below threshold and sort by relevance descending
  const filtered = scored
    .filter((s) => s.relevanceScore >= minScore)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);

  return filtered;
}
