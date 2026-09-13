/**
 * §SEMANTIC VECTOR RAG RANKER & EMBEDDING ENGINE
 * Deep module providing vector semantic similarity between user search intents
 * and candidate opportunity descriptions/titles.
 * 
 * Uses Google GenAI gemini-embedding-001 with in-memory caching and token-set
 * deterministic fallback for offline/test environments.
 */

import { createGeminiClient, getEffectiveGeminiApiKey, EMBEDDING_GEMINI_MODEL } from "@/lib/ai/modelSelector";

// In-memory embedding cache to avoid re-embedding identical text across requests
const embeddingCache = new Map<string, number[]>();
const MAX_CACHE_ENTRIES = 500;

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return Math.max(0, Math.min(1, dotProduct / denominator));
}

function computeTokenJaccardSimilarity(textA: string, textB: string): number {
  const tokenize = (str: string) =>
    new Set(
      str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) intersectionCount++;
  }
  const unionCount = new Set([...setA, ...setB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

export async function getVectorEmbedding(
  text: string,
  apiKey?: string | null
): Promise<number[] | null> {
  const normalized = text.trim().slice(0, 1000);
  if (!normalized) return null;

  if (embeddingCache.has(normalized)) {
    return embeddingCache.get(normalized)!;
  }

  const effectiveKey = getEffectiveGeminiApiKey(apiKey);
  if (!effectiveKey || process.env.NODE_ENV === "test" || process.env.IS_TEST_HARNESS === "true") {
    return null;
  }

  try {
    const ai = createGeminiClient(effectiveKey);
    const result = await (ai.models as any).embedContent({
      model: EMBEDDING_GEMINI_MODEL,
      contents: normalized,
    });

    const values = result?.embedding?.values;
    if (Array.isArray(values) && values.length > 0) {
      if (embeddingCache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = embeddingCache.keys().next().value;
        if (firstKey) embeddingCache.delete(firstKey);
      }
      embeddingCache.set(normalized, values);
      return values;
    }
  } catch {
    // Graceful fallback to deterministic token similarity
  }
  return null;
}

/**
 * Computes semantic similarity between a query intent and a candidate job card.
 * Returns a normalized float between 0.0 and 1.0.
 */
export async function computeSemanticSimilarity(
  query: string,
  candidateText: string,
  apiKey?: string | null
): Promise<number> {
  if (!query || !candidateText) return 0;

  try {
    const [queryVec, candVec] = await Promise.all([
      getVectorEmbedding(query, apiKey),
      getVectorEmbedding(candidateText, apiKey),
    ]);

    if (queryVec && candVec) {
      return cosineSimilarity(queryVec, candVec);
    }
  } catch {
    // Fall back to token overlap
  }

  return computeTokenJaccardSimilarity(query, candidateText);
}
