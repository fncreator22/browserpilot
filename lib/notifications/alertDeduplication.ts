/**
 * §LIFECYCLE ALERT DEDUPLICATION BOUNDARY (TASK-036)
 * 
 * Prevents retried discovery workers or concurrent runs from creating
 * duplicate lifecycle alerts and notification spam for the same user & opportunity.
 */

import { prisma } from "@/lib/db/prisma";

export function generateAlertDedupKey(
  userId: string,
  opportunityId: string,
  transitionType: string,
  timestamp: Date = new Date()
): string {
  const dateBucket = timestamp.toISOString().split("T")[0]; // Daily deduplication bucket
  return `alert:${userId}:${opportunityId}:${transitionType}:${dateBucket}`;
}

export async function isDuplicateAlert(
  userId: string,
  opportunityId: string,
  transitionType: string,
  windowHours = 24
): Promise<boolean> {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const existing = await prisma.lifecycleAlert.findFirst({
    where: {
      userId,
      opportunityId,
      transitionType,
      createdAt: { gte: cutoff },
    },
  });

  return existing !== null;
}
