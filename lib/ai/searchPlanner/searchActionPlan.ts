/**
 * §CANONICAL SEARCH ACTION PLAN CONTRACT (TASK-050)
 * 
 * Defines the typed ActionPlan schema emitted by the LLM Search Planner.
 * Governs action dependencies, stopping criteria, operational reasoning,
 * and immutable user constraints.
 */

import { z } from "zod";
import { SearchCapabilityIdSchema, type SearchCapabilityId } from "@/lib/ai/tools/searchCapabilityTypes";
import { type SearchIntent } from "@/lib/scraper/providers/baseProvider";

export const PlannedSearchActionSchema = z.object({
  actionId: z.string().min(1),
  capabilityId: z.string().min(1) as unknown as z.ZodType<SearchCapabilityId>,
  priority: z.number().int().min(1).max(10).default(1),
  input: z.record(z.string(), z.any()),
  purpose: z.string().min(1),
  expectedEvidence: z.string().min(1),
  maxResults: z.number().int().positive().max(50).default(10),
  timeoutMs: z.number().int().positive().max(60000).default(15000),
  dependencyIds: z.array(z.string()).default([]),
});

export type PlannedSearchAction = z.infer<typeof PlannedSearchActionSchema>;

export const PlanConstraintsSchema = z.object({
  roles: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  workModes: z.array(z.string()).optional(),
  postedWithinDays: z.number().int().positive().optional(),
  freshnessWindowHours: z.number().int().positive().optional(),
  requestedCount: z.number().int().positive().default(10),
  targetCompanies: z.array(z.string()).optional(),
  isExplicitFreshness: z.boolean().optional(),
});

export type PlanConstraints = z.infer<typeof PlanConstraintsSchema>;

export const StoppingCriteriaSchema = z.object({
  maxResults: z.number().int().positive().default(10),
  stopOnTargetCount: z.boolean().default(true),
  maxPlanningRounds: z.number().int().positive().max(5).default(2),
});

export type StoppingCriteria = z.infer<typeof StoppingCriteriaSchema>;

export const SearchActionPlanSchema = z.object({
  planId: z.string().min(1),
  query: z.string().min(1),
  actions: z.array(PlannedSearchActionSchema).min(1).max(10),
  constraints: PlanConstraintsSchema,
  stoppingCriteria: StoppingCriteriaSchema,
  confidence: z.number().min(0.0).max(1.0).default(0.9),
  reasoningSummary: z.string().min(1).max(500),
  createdAt: z.date().default(() => new Date()),
});

export type SearchActionPlan = z.infer<typeof SearchActionPlanSchema>;
