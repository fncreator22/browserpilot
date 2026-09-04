/**
 * §OPPORTUNITY LIFECYCLE NOTIFICATION SERVICE (TASK-042 & TASK-066)
 * 
 * Delivers deduplicated, idempotent notifications for lifecycle transitions,
 * job updates, expiring opportunities, and source authentication alerts.
 * 
 * Invariants (TASK-066):
 * 1. Never attach an arbitrary opportunity via findFirst() when opportunityId is null.
 * 2. User-level/system notifications store opportunityId: null.
 * 3. Opportunity-specific notifications resolve the exact opportunity within tenant scope.
 * 4. Cross-tenant access to another user's opportunity is strictly rejected.
 */

import { prisma } from "@/lib/db/prisma";

export type OpportunityNotificationType =
  | "NEW_MATCH"
  | "OPPORTUNITY_UPDATED"
  | "OPPORTUNITY_EXPIRING"
  | "OPPORTUNITY_EXPIRED"
  | "SOURCE_REQUIRES_AUTH"
  | "DISCOVERY_PARTIAL_SUCCESS"
  | "SYSTEM_ALERT"
  | "SEARCH_COMPLETED"
  | "SEARCH_CANCELLED"
  | "DISCOVERY_FAILED"
  | (string & {});

export interface CreateOpportunityNotificationInput {
  userId: string;
  opportunityId?: string | null;
  type: OpportunityNotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Opportunity-specific notification types that genuinely require a valid opportunity reference.
 */
const OPPORTUNITY_REQUIRED_TYPES = new Set<string>([
  "NEW_MATCH",
  "OPPORTUNITY_UPDATED",
  "OPPORTUNITY_EXPIRING",
  "OPPORTUNITY_EXPIRED",
]);

/**
 * Tenant-safe authorization check verifying the opportunity belongs to or is
 * legitimately associated with the requesting user context.
 */
async function isOpportunityAuthorizedForUser(opportunityId: string, userId: string): Promise<boolean> {
  // 1. Saved by this user
  const saved = await prisma.savedOpportunity.findUnique({
    where: { userId_opportunityId: { userId, opportunityId } },
    select: { id: true },
  });
  if (saved) return true;

  // 2. Discovered in this user's search
  const inSearch = await prisma.searchResult.findFirst({
    where: {
      opportunityId,
      search: { userId },
    },
    select: { id: true },
  });
  if (inSearch) return true;

  // 3. User's discovery event
  const inDiscovery = await prisma.opportunityDiscoveryEvent.findFirst({
    where: {
      userId,
      opportunityId,
    },
    select: { id: true },
  });
  if (inDiscovery) return true;

  // 4. User's existing lifecycle alert
  const inAlerts = await prisma.lifecycleAlert.findFirst({
    where: {
      userId,
      opportunityId,
    },
    select: { id: true },
  });
  if (inAlerts) return true;

  // 5. If another user exclusively saved or discovered it, block cross-tenant leakage!
  const otherUserSaved = await prisma.savedOpportunity.findFirst({
    where: {
      opportunityId,
      userId: { not: userId },
    },
    select: { id: true },
  });
  if (otherUserSaved) return false;

  const otherUserSearch = await prisma.searchResult.findFirst({
    where: {
      opportunityId,
      search: { userId: { not: userId } },
    },
    select: { id: true },
  });
  if (otherUserSearch) return false;

  // 6. Public/shared opportunity without exclusive tenant isolation
  return true;
}

export class OpportunityNotificationService {
  /**
   * Emits a lifecycle notification with strict idempotency and tenant-safe opportunity scoping.
   */
  public async emitNotification(input: CreateOpportunityNotificationInput): Promise<{ created: boolean; notificationId?: string }> {
    const dayKey = new Date().toISOString().slice(0, 10);
    const oppIdKey = input.opportunityId || "global";
    const idempotencyKey =
      (input.metadata?.idempotencyKey as string) ||
      `alert_${input.userId}_${oppIdKey}_${input.type}_${dayKey}`;

    // 1. Check for duplicate alert via unique idempotency key
    const existing = await prisma.lifecycleAlert.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return { created: false, notificationId: existing.id };
    }

    // 2. Handle Case A: Exact Opportunity-Specific Notification
    if (input.opportunityId) {
      const opp = await prisma.opportunity.findUnique({
        where: { id: input.opportunityId },
        select: {
          id: true,
          status: true,
          companyName: true,
          title: true,
        },
      });

      if (!opp) {
        // Opportunity not found: reject truthfully, NEVER fallback to findFirst()
        return { created: false };
      }

      // Tenant authorization check: verify user has legitimate access to this opportunity
      const authorized = await isOpportunityAuthorizedForUser(opp.id, input.userId);
      if (!authorized) {
        // Cross-tenant attempt or unauthorized opportunity: reject truthfully
        return { created: false };
      }

      const alert = await prisma.lifecycleAlert.create({
        data: {
          userId: input.userId,
          opportunityId: opp.id,
          transitionType: input.type,
          previousStatus: opp.status || "DISCOVERED",
          newStatus: opp.status || "ACTIVE",
          companyName: opp.companyName || "Employer",
          title: input.title,
          message: input.message,
          isRead: false,
          idempotencyKey,
        },
      });

      return { created: true, notificationId: alert.id };
    }

    // 3. Handle Case B: Global/User-Level Notification (opportunityId === null / undefined)
    // If notification type strictly requires an opportunity, reject truthfully
    if (OPPORTUNITY_REQUIRED_TYPES.has(input.type)) {
      return { created: false };
    }

    // Opportunity-independent notification: opportunityId is explicitly null
    const companyName = (input.metadata?.companyName as string) || "System";
    const alert = await prisma.lifecycleAlert.create({
      data: {
        userId: input.userId,
        opportunityId: null,
        transitionType: input.type,
        previousStatus: "SYSTEM",
        newStatus: "SYSTEM",
        companyName,
        title: input.title,
        message: input.message,
        isRead: false,
        idempotencyKey,
      },
    });

    return { created: true, notificationId: alert.id };
  }

  /**
   * Lists notifications for a user with unread counts.
   */
  public async listUserNotifications(userId: string, limit: number = 20): Promise<{
    notifications: Array<{
      id: string;
      opportunityId?: string | null;
      type: string;
      title: string;
      message: string;
      isRead: boolean;
      createdAt: Date;
    }>;
    unreadCount: number;
  }> {
    const [alerts, unreadCount] = await Promise.all([
      prisma.lifecycleAlert.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.lifecycleAlert.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      notifications: alerts.map((a) => ({
        id: a.id,
        opportunityId: a.opportunityId,
        type: a.transitionType,
        title: a.title,
        message: a.message,
        isRead: a.isRead,
        createdAt: a.createdAt,
      })),
      unreadCount,
    };
  }
}

export const opportunityNotificationService = new OpportunityNotificationService();
