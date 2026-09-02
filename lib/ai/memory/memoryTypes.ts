/**
 * §MEMORY VAULT TYPES & CONTRACTS (TASK-047)
 * 
 * Defines canonical data contracts for:
 * 1. Platform Memory Vault (compressed engineering knowledge & task architecture)
 * 2. User Memory Vault (tenant-isolated durable career preferences & feedback)
 * 3. Memory Admission & Retrieval policies
 */

export type MemoryCategory =
  | "PROFILE_PREFERENCE"
  | "CAREER_PREFERENCE"
  | "LOCATION_PREFERENCE"
  | "WORK_MODE_PREFERENCE"
  | "ROLE_PREFERENCE"
  | "SKILL_INTEREST"
  | "INDUSTRY_INTEREST"
  | "SEARCH_PREFERENCE"
  | "SOURCE_PREFERENCE"
  | "RESULT_FEEDBACK"
  | "RECOMMENDATION_SIGNAL"
  | "EXPLICIT_USER_INSTRUCTION";

export type MemoryConfidence =
  | "EXPLICIT"    // Directly stated by the user (Highest confidence)
  | "REPEATED"    // Observed in 3+ interactions or searches
  | "INFERRED"    // Deduced from single interaction or behavior
  | "TEMPORARY";  // Ephemeral preference with short shelf life

export type MemoryLifecycleStatus =
  | "ACTIVE"
  | "SUPERSEDED"
  | "EXPIRED"
  | "ARCHIVED";

export interface UserMemoryItem {
  id: string;
  userId: string;
  category: MemoryCategory;
  key: string;               // e.g. "preferred_roles", "dismissed_senior_roles", "target_cities"
  value: string;             // Structured JSON string or plain text value
  confidence: MemoryConfidence;
  importance: number;        // 0.0 to 1.0
  lifecycleStatus: MemoryLifecycleStatus;
  expiresAt?: Date | null;
  sourceContext?: string;    // Sanitized prompt snippet or action that originated this memory
  createdAt: Date;
  updatedAt: Date;
}

export type PlatformMemoryType =
  | "ARCHITECTURE"
  | "FEATURE"
  | "COMPONENT"
  | "TASK"
  | "DECISION"
  | "CONSTRAINT"
  | "DATA_MODEL"
  | "SECURITY_RULE"
  | "TEST_EVIDENCE";

export type PlatformMemoryStatus =
  | "DISCOVERED"
  | "VALIDATED"
  | "ACTIVE"
  | "UPDATED"
  | "SUPERSEDED"
  | "ARCHIVED";

export interface PlatformMemoryItem {
  id: string;
  memoryId: string;          // e.g. "ARCH-DISCOVERY-ENGINE", "SEC-TENANT-ISOLATION"
  type: PlatformMemoryType;
  title: string;
  summary: string;
  status: PlatformMemoryStatus;
  sourceTask: string;        // e.g. "TASK-041", "TASK-044", "TASK-046"
  relatedFiles: string[];
  relatedComponents: string[];
  importance: number;        // 0.0 to 1.0
  confidence: number;        // 0.0 to 1.0
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryAdmissionCandidate {
  userId: string;
  category: MemoryCategory;
  key: string;
  value: string | Record<string, unknown> | unknown[];
  confidence?: MemoryConfidence;
  importance?: number;
  expiresInHours?: number;
  sourceContext?: string;
  isExplicit?: boolean;
}

export interface MemoryAdmissionDecision {
  admitted: boolean;
  rejectionReason?: string;
  sanitizedCandidate?: {
    userId: string;
    category: MemoryCategory;
    key: string;
    value: string;
    confidence: MemoryConfidence;
    importance: number;
    expiresAt?: Date | null;
    sourceContext?: string;
  };
}

export interface MemoryRetrievalQuery {
  userId: string;
  query?: string;
  categories?: MemoryCategory[];
  minConfidence?: MemoryConfidence;
  minImportance?: number;
  limit?: number;
  includeExpirable?: boolean;
}

export interface MemoryRetrievalResult {
  userId: string;
  memories: UserMemoryItem[];
  matchedCategories: MemoryCategory[];
  totalRetrieved: number;
}
