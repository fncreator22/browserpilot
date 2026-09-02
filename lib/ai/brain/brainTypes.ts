/**
 * §INTELLIGENCE BRAIN & RAG CONTEXT CONTRACTS (TASK-049)
 * 
 * Defines the data contracts for the Intelligence Brain, Hybrid Retrieval,
 * Role Semantics, Provenance Tracking, and Intelligent Context Synthesis.
 */

import { type UserMemoryItem, type PlatformMemoryItem } from "@/lib/ai/memory/memoryTypes";

export type ContextProvenance =
  | "USER_MEMORY"
  | "PLATFORM_MEMORY"
  | "SEARCH_INTELLIGENCE"
  | "COMPANY_INTELLIGENCE"
  | "SEARCH_HISTORY"
  | "ROLE_ONTOLOGY";

export type ContextConfidence =
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export interface RankedContextItem<T> {
  item: T;
  relevanceScore: number; // 0.0 to 1.0
  provenance: ContextProvenance;
  confidence: ContextConfidence;
  rationale: string;
}

export interface RoleSemanticContext {
  originalRole: string;
  normalizedRole: string;
  semanticSynonyms: string[];
  relatedKeywords: string[];
  preserveStrictScope: boolean;
}

export interface CompanyContextItem {
  companyName: string;
  officialCareerUrl?: string;
  atsProvider?: string;
  atsUrl?: string;
  reliabilityScore: number;
  provenance: "COMPANY_INTELLIGENCE";
}

export interface SearchIntelligenceItem {
  sourceName: string;
  companyName?: string;
  primaryAtsAffinity: number;
  historicalSuccessScore: number;
  provenance: "SEARCH_INTELLIGENCE";
}

export interface RecommendationContextItem {
  type: string;
  suggestion: string;
  confidence: "INFERRED";
  importance: number;
  provenance: "SEARCH_INTELLIGENCE" | "ROLE_ONTOLOGY";
}

export interface BrainBudgetMetrics {
  totalItemsRetrieved: number;
  itemsIncluded: number;
  itemsFiltered: number;
  estimatedTokens: number;
  budgetLimit: number;
}

export interface BrainContext {
  query: string;
  userId: string | null;
  userContext: RankedContextItem<UserMemoryItem>[];
  platformContext: RankedContextItem<PlatformMemoryItem>[];
  searchContext: RankedContextItem<SearchIntelligenceItem>[];
  companyContext: RankedContextItem<CompanyContextItem>[];
  roleSemantics?: RoleSemanticContext;
  recommendations: RecommendationContextItem[];
  queryReformulations: string[];
  budgetMetrics: BrainBudgetMetrics;
  generatedAt: Date;
}

export interface BrainSynthesisOptions {
  maxUserMemories?: number;
  maxPlatformItems?: number;
  maxCompanyItems?: number;
  maxBudgetTokens?: number;
  minRelevanceScore?: number;
}
