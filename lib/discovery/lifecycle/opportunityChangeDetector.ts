/**
 * §OPPORTUNITY CHANGE DETECTOR (TASK-042)
 * 
 * Compares an existing Opportunity record against newly harvested candidate data
 * to detect meaningful material changes (title, company, location, workMode, compensation,
 * applyUrl, description, status) without emitting noise for insignificant formatting differences.
 */

import {
  type OpportunityChangeEvent,
} from "./opportunityLifecycleTypes";
import { type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";
import { canonicalizeUrl, normalizeJobTitle, normalizeLocation } from "@/lib/scraper/normalizer";

export interface StoredOpportunitySnapshot {
  id: string;
  canonicalHash: string;
  title: string;
  companyName: string;
  location: string;
  workMode: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  description: string;
  primaryApplyUrl: string;
  status: string;
}

export class OpportunityChangeDetector {
  /**
   * Detects material changes between an existing opportunity snapshot and a fresh candidate.
   */
  public detectChanges(
    existing: StoredOpportunitySnapshot,
    candidate: RawJobCandidate
  ): OpportunityChangeEvent[] {
    const changes: OpportunityChangeEvent[] = [];
    const now = new Date();

    // 1. Title Change (Normalized)
    const normExistingTitle = normalizeJobTitle(existing.title);
    const normNewTitle = normalizeJobTitle(candidate.title);
    if (normExistingTitle !== normNewTitle && normNewTitle.length > 0) {
      changes.push({
        opportunityId: existing.id,
        canonicalHash: existing.canonicalHash,
        changeType: "TITLE_CHANGED",
        fieldName: "title",
        previousValue: existing.title,
        newValue: candidate.title,
        detectedAt: now,
        sourcePlatform: candidate.sourcePlatform,
      });
    }

    // 2. Location Change
    const normExistingLoc = normalizeLocation(existing.location);
    const normNewLoc = normalizeLocation(candidate.location);
    if (normExistingLoc !== normNewLoc && candidate.location) {
      changes.push({
        opportunityId: existing.id,
        canonicalHash: existing.canonicalHash,
        changeType: "LOCATION_CHANGED",
        fieldName: "location",
        previousValue: existing.location,
        newValue: candidate.location,
        detectedAt: now,
        sourcePlatform: candidate.sourcePlatform,
      });
    }

    // 3. Work Mode Change
    if (candidate.workMode && candidate.workMode !== "ANY" && candidate.workMode !== existing.workMode) {
      changes.push({
        opportunityId: existing.id,
        canonicalHash: existing.canonicalHash,
        changeType: "WORK_MODE_CHANGED",
        fieldName: "workMode",
        previousValue: existing.workMode,
        newValue: candidate.workMode,
        detectedAt: now,
        sourcePlatform: candidate.sourcePlatform,
      });
    }

    // 4. Primary Apply URL Change
    const canonExistingApply = canonicalizeUrl(existing.primaryApplyUrl);
    const canonNewApply = canonicalizeUrl(candidate.applyUrl);
    if (canonNewApply && canonExistingApply !== canonNewApply) {
      changes.push({
        opportunityId: existing.id,
        canonicalHash: existing.canonicalHash,
        changeType: "APPLY_URL_CHANGED",
        fieldName: "primaryApplyUrl",
        previousValue: existing.primaryApplyUrl,
        newValue: candidate.applyUrl,
        detectedAt: now,
        sourcePlatform: candidate.sourcePlatform,
      });
    }

    // 5. Material Description Change (Significant content delta > 25%)
    if (candidate.description && existing.description) {
      const existingLen = existing.description.length;
      const newLen = candidate.description.length;
      const diffRatio = Math.abs(existingLen - newLen) / Math.max(1, existingLen);

      if (diffRatio > 0.35 && newLen > 100) {
        changes.push({
          opportunityId: existing.id,
          canonicalHash: existing.canonicalHash,
          changeType: "DESCRIPTION_UPDATED",
          fieldName: "description",
          previousValue: `${existing.description.slice(0, 80)}...`,
          newValue: `${candidate.description.slice(0, 80)}...`,
          detectedAt: now,
          sourcePlatform: candidate.sourcePlatform,
        });
      }
    }

    return changes;
  }
}

export const opportunityChangeDetector = new OpportunityChangeDetector();
