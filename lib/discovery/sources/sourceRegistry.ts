/**
 * §CANONICAL SOURCE REGISTRY & HEALTH TRACKER (TASK-038)
 * 
 * Manages the registry of all built-in and dynamic opportunity sources,
 * tracks uptime/reliability statistics, and enforces source health states.
 */

import { type SourceDefinition, type SourceHealthUpdate, type SourceStatus } from "./sourceTypes";
import { prisma } from "@/lib/db/prisma";

export const BUILTIN_SOURCES: SourceDefinition[] = [
  {
    name: "LinkedIn",
    type: "AGGREGATOR",
    baseUrl: "https://www.linkedin.com",
    supportedCategories: ["Engineering", "Product", "Design", "Data", "Marketing"],
    supportedLocations: ["Global", "Remote", "India", "USA", "Europe"],
    reliabilityScore: 0.95,
    totalCrawls: 0,
    successfulCrawls: 0,
    failedCrawls: 0,
    status: "HEALTHY",
    isPublic: true,
    requiresAuth: false,
  },
  {
    name: "Y Combinator",
    type: "AGGREGATOR",
    baseUrl: "https://www.workatastartup.com",
    supportedCategories: ["Startups", "Fullstack", "AI/ML", "Frontend", "Backend"],
    supportedLocations: ["Global", "Remote", "San Francisco", "Bengaluru"],
    reliabilityScore: 0.98,
    totalCrawls: 0,
    successfulCrawls: 0,
    failedCrawls: 0,
    status: "HEALTHY",
    isPublic: true,
    requiresAuth: false,
  },
  {
    name: "Indeed",
    type: "AGGREGATOR",
    baseUrl: "https://www.indeed.com",
    supportedCategories: ["General", "Entry-Level", "Internships", "Engineering"],
    supportedLocations: ["Global", "USA", "India", "Remote"],
    reliabilityScore: 0.90,
    totalCrawls: 0,
    successfulCrawls: 0,
    failedCrawls: 0,
    status: "HEALTHY",
    isPublic: true,
    requiresAuth: false,
  },
  {
    name: "Ashby",
    type: "ATS_PORTAL",
    baseUrl: "https://jobs.ashbyhq.com",
    supportedCategories: ["Tech", "High-Growth Startups", "Engineering", "Design"],
    supportedLocations: ["Global", "Remote", "USA", "India"],
    reliabilityScore: 0.99,
    totalCrawls: 0,
    successfulCrawls: 0,
    failedCrawls: 0,
    status: "HEALTHY",
    isPublic: true,
    requiresAuth: false,
  },
  {
    name: "Greenhouse",
    type: "ATS_PORTAL",
    baseUrl: "https://boards.greenhouse.io",
    supportedCategories: ["Enterprise", "Unicorns", "Tech", "Product"],
    supportedLocations: ["Global", "Remote", "USA", "India", "Europe"],
    reliabilityScore: 0.98,
    totalCrawls: 0,
    successfulCrawls: 0,
    failedCrawls: 0,
    status: "HEALTHY",
    isPublic: true,
    requiresAuth: false,
  },
  {
    name: "Lever",
    type: "ATS_PORTAL",
    baseUrl: "https://jobs.lever.co",
    supportedCategories: ["Startups", "Scale-ups", "Engineering", "Operations"],
    supportedLocations: ["Global", "Remote", "USA", "India"],
    reliabilityScore: 0.97,
    totalCrawls: 0,
    successfulCrawls: 0,
    failedCrawls: 0,
    status: "HEALTHY",
    isPublic: true,
    requiresAuth: false,
  },
  {
    name: "Hacker News",
    type: "TECH_COMMUNITY",
    baseUrl: "https://news.ycombinator.com",
    supportedCategories: ["Who Is Hiring", "Early Stage", "Developer Direct", "Remote"],
    supportedLocations: ["Global", "Remote", "USA", "Europe"],
    reliabilityScore: 0.96,
    totalCrawls: 0,
    successfulCrawls: 0,
    failedCrawls: 0,
    status: "HEALTHY",
    isPublic: true,
    requiresAuth: false,
  },
  {
    name: "GitHub Curated",
    type: "TECH_COMMUNITY",
    baseUrl: "https://github.com",
    supportedCategories: ["Internships 2026", "New Grad", "Open Source", "Remote Tech"],
    supportedLocations: ["Global", "Remote", "USA", "India"],
    reliabilityScore: 0.95,
    totalCrawls: 0,
    successfulCrawls: 0,
    failedCrawls: 0,
    status: "HEALTHY",
    isPublic: true,
    requiresAuth: false,
  },
];

export class SourceRegistry {
  private sourcesMap: Map<string, SourceDefinition> = new Map();

  constructor() {
    for (const src of BUILTIN_SOURCES) {
      this.sourcesMap.set(src.name.toLowerCase(), { ...src });
    }
  }

  public getAllSources(): SourceDefinition[] {
    return Array.from(this.sourcesMap.values());
  }

  public getSource(name: string): SourceDefinition | null {
    return this.sourcesMap.get(name.toLowerCase()) || null;
  }

  public registerSource(def: SourceDefinition): void {
    this.sourcesMap.set(def.name.toLowerCase(), { ...def });
  }

  public updateSourceHealth(update: SourceHealthUpdate): void {
    const existing = this.sourcesMap.get(update.sourceName.toLowerCase());
    if (!existing) return;

    existing.totalCrawls += 1;
    if (update.success) {
      existing.successfulCrawls += 1;
      existing.lastSuccessfulCrawlAt = new Date();
      // Incremental reliability improvement
      existing.reliabilityScore = Math.min(1.0, existing.reliabilityScore * 0.95 + 0.05);
      if (existing.status === "DEGRADED") {
        existing.status = "HEALTHY";
      }
    } else {
      existing.failedCrawls += 1;
      existing.lastFailedCrawlAt = new Date();
      // Decay reliability
      existing.reliabilityScore = Math.max(0.1, existing.reliabilityScore * 0.9);
      if (update.errorCategory === "SOURCE_BLOCKED" || update.errorCategory === "SECURITY_BLOCKED") {
        existing.status = "BLOCKED";
      } else if (existing.reliabilityScore < 0.6) {
        existing.status = "DEGRADED";
      }
    }
  }
}

export const sourceRegistry = new SourceRegistry();
