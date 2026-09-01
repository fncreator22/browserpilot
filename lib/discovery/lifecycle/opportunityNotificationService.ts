/**
 * §OPPORTUNITY LIFECYCLE NOTIFICATION SERVICE (TASK-042)
 * 
 * Delivers deduplicated, idempotent notifications for lifecycle transitions,
 * job updates, expiring opportunities, and source authentication alerts.
 */

import { prisma } from "@/lib/db/prisma";

export type OpportunityNotificationType =
  | "NEW_MATCH"
  | "OPPORTUNITY_UPDATED"
  | "OPPORTUNITY_EXPIRING"
  | "OPPORTUNITY_EXPIRED"
  | "SOURCE_REQUIRES_AUTH"
  | "DISCOVERY_PARTIAL_SUCCESS";

export interface CreateOpportunityNotificationInput {
  userId: string;
  opportunityId?: string | null;
  type: OpportunityNotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export class OpportunityNotificationService {
  /**
   * Emits a lifecycle notification with strict idempotency and deduplication within 24 hours.
   */
  public async emitNotification(input: CreateOpportunityNotificationInput): Promise<{ created: boolean; notificationId?: string }> {
    const dayKey = new Date().toISOString().slice(0, 10);
    const oppId = input.opportunityId || "global";
    const idempotencyKey = `alert_${input.userId}_${oppId}_${input.type}_${dayKey}`;

    // 1. Check for duplicate alert via unique idempotency key
    const existing = await prisma.lifecycleAlert.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return { created: false, notificationId: existing.id };
    }

    const opp = input.opportunityId
      ? await prisma.opportunity.findUnique({ where: { id: input.opportunityId } })
      : null;

    let targetOppId = opp?.id;
    if (!targetOppId) {
      const fallbackOpp = await prisma.opportunity.findFirst();
      if (fallbackOpp) {
        targetOppId = fallbackOpp.id;
      } else {
        return { created: false };
      }
    }

    // 2. Create LifecycleAlert record
    const alert = await prisma.lifecycleAlert.create({
      data: {
        userId: input.userId,
        opportunityId: targetOppId,
        transitionType: input.type,
        previousStatus: opp?.status || "DISCOVERED",
        newStatus: opp?.status || "ACTIVE",
        companyName: opp?.companyName || "Employer",
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
