/**
 * §QUERY-RELEVANT MEMORY RETRIEVER (TASK-047)
 * 
 * Selectively retrieves only user memories that are relevant to the current search query or goal,
 * avoiding prompt context bloat and irrelevant memory contamination.
 */

import { userMemoryVault } from "./userMemoryVault";
import { type UserMemoryItem, type MemoryCategory } from "./memoryTypes";

export interface RelevantMemoryContext {
  userId: string;
  relevantMemories: UserMemoryItem[];
  appliedCategories: MemoryCategory[];
  totalMatches: number;
}

/**
 * Retrieves query-relevant user memories for prompt context injection.
 */
export async function retrieveRelevantMemories(
  query: string,
  userId?: string | null,
  options: {
    limit?: number;
    minImportance?: number;
    categories?: MemoryCategory[];
  } = {}
): Promise<RelevantMemoryContext> {
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return {
      userId: "",
      relevantMemories: [],
      appliedCategories: [],
      totalMatches: 0,
    };
  }

  const cleanUserId = userId.trim();
  const qLower = (query || "").toLowerCase();
  const limit = options.limit || 5;
  const minImportance = options.minImportance || 0.4;

  const allActive = await userMemoryVault.getMemories({
    userId: cleanUserId,
    categories: options.categories,
    minImportance,
    limit: 25,
  });

  if (allActive.memories.length === 0) {
    return {
      userId: cleanUserId,
      relevantMemories: [],
      appliedCategories: [],
      totalMatches: 0,
    };
  }

  // If query is empty, return top user preferences by importance
  if (!qLower) {
    const topMemories = allActive.memories.slice(0, limit);
    return {
      userId: cleanUserId,
      relevantMemories: topMemories,
      appliedCategories: Array.from(new Set(topMemories.map((m) => m.category))),
      totalMatches: topMemories.length,
    };
  }

  // Score relevance against query keywords
  const queryTokens = qLower
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const scored = allActive.memories.map((mem) => {
    const memText = `${mem.key} ${mem.value} ${mem.category}`.toLowerCase();
    let relevanceScore = mem.importance; // Base importance

    // Boost if memory directly matches query tokens
    for (const token of queryTokens) {
      if (memText.includes(token)) {
        relevanceScore += 0.5;
      }
    }

    // Explicit user instructions get a default baseline boost
    if (mem.category === "EXPLICIT_USER_INSTRUCTION" || mem.confidence === "EXPLICIT") {
      relevanceScore += 0.2;
    }

    // Role, location, and work mode preferences have natural relevance to discovery
    if (
      mem.category === "ROLE_PREFERENCE" ||
      mem.category === "LOCATION_PREFERENCE" ||
      mem.category === "WORK_MODE_PREFERENCE"
    ) {
      relevanceScore += 0.1;
    }

    return { memory: mem, relevanceScore };
  });

  // Filter for matching relevance and sort descending
  const relevant = scored
    .filter((s) => s.relevanceScore >= minImportance)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit)
    .map((s) => s.memory);

  return {
    userId: cleanUserId,
    relevantMemories: relevant,
    appliedCategories: Array.from(new Set(relevant.map((m) => m.category))),
    totalMatches: relevant.length,
  };
}
