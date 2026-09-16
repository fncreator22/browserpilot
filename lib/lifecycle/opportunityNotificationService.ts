/**
 * LIFECYCLE NOTIFICATION SERVICE (DeepReach Phase 4)
 * Orchestrates proactive notifications for opportunity lifecycle transitions,
 * new recruiter contact discoveries, and unannounced cross-platform roles.
 */

import { recordLifecycleAlert } from "@/lib/db/opportunities";
import { OutboundEmailDispatcher, type LifecycleAlertOpportunityInput } from "@/lib/notifications/emailDispatcher";
import { type OutboundEmailPayload } from "@/lib/notifications/emailProvider";

export type AlertClassification = 
  | "NEW_OPPORTUNITY" 
  | "REPOSTED" 
  | "NEW_SOURCE" 
  | "NEW_RECRUITER_CONTACT" 
  | "UNANNOUNCED_ROLE" 
  | "STATUS_CHANGE";

export interface RecruiterContactAlertInput {
  fullName: string;
  roleTitle: string;
  companyName: string;
  profileUrl: string;
  email?: string | null;
  department?: string | null;
  sourcePlatform?: string | null;
  opportunityId?: string | null;
}

export interface UnannouncedRoleAlertInput {
  title: string;
  companyName: string;
  applyUrl: string;
  sourcePlatform: string;
  description?: string | null;
  workMode?: string | null;
  location?: string | null;
  opportunityId?: string | null;
}

export interface DirectLinkBadgeConfig {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  bgClass: string;
  textClass: string;
  borderClass: string;
  iconName: string;
}

/**
 * Returns badge styling and icon metadata for lifecycle alert classifications
 */
export function getAlertBadgeConfig(transitionType: string): DirectLinkBadgeConfig {
  switch (transitionType) {
    case "NEW_RECRUITER_CONTACT":
      return {
        label: "Recruiter Contact",
        variant: "default",
        bgClass: "bg-emerald-500/15",
        textClass: "text-emerald-700 dark:text-emerald-400",
        borderClass: "border-emerald-500/30",
        iconName: "UserCheck",
      };
    case "UNANNOUNCED_ROLE":
      return {
        label: "Unannounced Role",
        variant: "secondary",
        bgClass: "bg-purple-500/15",
        textClass: "text-purple-700 dark:text-purple-400",
        borderClass: "border-purple-500/30",
        iconName: "Sparkles",
      };
    case "NEW_OPPORTUNITY":
      return {
        label: "New Match",
        variant: "default",
        bgClass: "bg-emerald-500/15",
        textClass: "text-emerald-700 dark:text-emerald-400",
        borderClass: "border-emerald-500/30",
        iconName: "Zap",
      };
    case "NEW_SOURCE":
      return {
        label: "New Source",
        variant: "secondary",
        bgClass: "bg-blue-500/15",
        textClass: "text-blue-700 dark:text-blue-400",
        borderClass: "border-blue-500/30",
        iconName: "ArrowUpRight",
      };
    case "REPOSTED":
      return {
        label: "Reposted",
        variant: "outline",
        bgClass: "bg-amber-500/15",
        textClass: "text-amber-700 dark:text-amber-400",
        borderClass: "border-amber-500/30",
        iconName: "RotateCw",
      };
    default:
      return {
        label: transitionType,
        variant: "outline",
        bgClass: "bg-muted/40",
        textClass: "text-muted-foreground",
        borderClass: "border-border/60",
        iconName: "Bell",
      };
  }
}

/**
 * Formats dedicated email body and subject for recruiter contact discovery alerts
 */
export function formatRecruiterAlertEmail(payload: {
  recruiter: RecruiterContactAlertInput;
  appBaseUrl?: string;
  watchName?: string;
}): {
  subject: string;
  textBody: string;
  htmlBody: string;
} {
  const { recruiter } = payload;
  const baseUrl = payload.appBaseUrl || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const notificationsUrl = `${baseUrl}/app/notifications`;

  const subject = `[BrowserPilot Alert] NEW RECRUITER CONTACT: ${recruiter.fullName} (${recruiter.roleTitle}) at ${recruiter.companyName}`;

  const textBody = [
    `=== BROWSERPILOT RECRUITER DISCOVERY ALERT ===`,
    `Company:    ${recruiter.companyName}`,
    `Recruiter:  ${recruiter.fullName}`,
    `Role:       ${recruiter.roleTitle}`,
    recruiter.department ? `Department: ${recruiter.department}` : null,
    recruiter.email ? `Email:      ${recruiter.email}` : null,
    `Profile:    ${recruiter.profileUrl}`,
    `Platform:   ${recruiter.sourcePlatform || "DeepReach Network"}`,
    ``,
    `View Notifications: ${notificationsUrl}`,
    ``,
    `Delivered automatically by BrowserPilot Autonomous Watch${payload.watchName ? ` (${payload.watchName})` : ""}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="display: inline-block; padding: 4px 10px; background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">
      Recruiter Contact Discovered
    </div>
    <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 8px 0; color: #0f172a;">
      ${recruiter.fullName}
    </h2>
    <p style="font-size: 14px; color: #64748b; margin: 0 0 16px 0;">
      ${recruiter.roleTitle} at <strong>${recruiter.companyName}</strong>
      ${recruiter.department ? ` &bull; ${recruiter.department}` : ""}
    </p>

    <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-size: 13px; line-height: 1.6;">
      <div><strong>Profile:</strong> <a href="${recruiter.profileUrl}" style="color: #0284c7; text-decoration: none;" target="_blank">${recruiter.profileUrl}</a></div>
      ${recruiter.email ? `<div><strong>Direct Email:</strong> <a href="mailto:${recruiter.email}" style="color: #059669; text-decoration: none;">${recruiter.email}</a></div>` : ""}
      <div><strong>Source Channel:</strong> ${recruiter.sourcePlatform || "DeepReach Intelligence"}</div>
    </div>

    <div style="display: flex; gap: 10px; margin-bottom: 24px;">
      <a href="${recruiter.profileUrl}" target="_blank" style="display: inline-block; padding: 10px 18px; background-color: #1F3D2E; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">
        Open Profile &rarr;
      </a>
      ${recruiter.email ? `<a href="mailto:${recruiter.email}" style="display: inline-block; padding: 10px 18px; background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">Email Recruiter</a>` : ""}
    </div>

    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
    <p style="font-size: 11px; color: #94a3b8; margin: 0;">
      Delivered automatically by BrowserPilot Autonomous Watch. You are receiving this because you configured a proactive watch for ${recruiter.companyName}.
    </p>
  </div>
</body>
</html>
  `.trim();

  return { subject, textBody, htmlBody };
}

/**
 * Creates and persists a LifecycleAlert for a newly discovered recruiter contact,
 * deduplicating deterministically by user, company, and recruiter identity.
 */
export async function createRecruiterContactAlert(input: {
  userId: string;
  recruiter: RecruiterContactAlertInput;
  companyName: string;
  sendEmail?: boolean;
}): Promise<{ alert: any; created: boolean }> {
  const normCompany = input.companyName.toLowerCase().trim();
  const recruiterId = (input.recruiter.profileUrl || input.recruiter.fullName).toLowerCase().trim();
  const idempotencyKey = `${input.userId}_recruiter_${normCompany}_${recruiterId}`;

  const title = `New Recruiter: ${input.recruiter.fullName} at ${input.companyName}`;
  const message = `${input.recruiter.fullName} (${input.recruiter.roleTitle}) was identified at ${input.companyName} via ${input.recruiter.sourcePlatform || "DeepReach"}.${input.recruiter.email ? ` Contact: ${input.recruiter.email}` : ""}`;

  const alertResult = await recordLifecycleAlert({
    userId: input.userId,
    opportunityId: input.recruiter.opportunityId || null,
    transitionType: "NEW_RECRUITER_CONTACT",
    previousStatus: "UNKNOWN",
    newStatus: "VERIFIED",
    title,
    companyName: input.companyName,
    message,
    idempotencyKey,
  });

  if (alertResult.created && input.sendEmail !== false) {
    try {
      const dispatcher = OutboundEmailDispatcher.getInstance();
      const oppPayload: LifecycleAlertOpportunityInput = {
        id: alertResult.alert.id,
        title: input.recruiter.roleTitle,
        companyName: input.companyName,
        primaryApplyUrl: input.recruiter.profileUrl,
        matchReason: `Identified verified hiring contact: ${input.recruiter.fullName}`,
      };

      await dispatcher.dispatchLifecycleAlertEmail(
        {
          id: alertResult.alert.id,
          userId: input.userId,
          transitionType: "NEW_RECRUITER_CONTACT",
          idempotencyKey: alertResult.alert.idempotencyKey,
          title: alertResult.alert.title,
          companyName: alertResult.alert.companyName,
          message: alertResult.alert.message,
        },
        oppPayload
      ).catch(() => {});
    } catch (emailErr) {
      console.warn("[LifecycleNotificationService] Email dispatch warning:", emailErr);
    }
  }

  return alertResult;
}

/**
 * Creates and persists a LifecycleAlert for an unannounced role discovered on X, Reddit, etc.
 */
export async function createUnannouncedRoleAlert(input: {
  userId: string;
  role: UnannouncedRoleAlertInput;
  companyName: string;
  sendEmail?: boolean;
}): Promise<{ alert: any; created: boolean }> {
  const normCompany = input.companyName.toLowerCase().trim();
  const roleId = input.role.applyUrl.toLowerCase().trim();
  const idempotencyKey = `${input.userId}_unannounced_${normCompany}_${roleId}`;

  const title = `Unannounced Role: ${input.role.title} at ${input.companyName}`;
  const message = `A new role was harvested via ${input.role.sourcePlatform}: ${input.role.title}. Direct Apply: ${input.role.applyUrl}`;

  const alertResult = await recordLifecycleAlert({
    userId: input.userId,
    opportunityId: input.role.opportunityId || null,
    transitionType: "UNANNOUNCED_ROLE",
    previousStatus: "UNKNOWN",
    newStatus: "ACTIVE",
    title,
    companyName: input.companyName,
    message,
    idempotencyKey,
  });

  if (alertResult.created && input.sendEmail !== false) {
    try {
      const dispatcher = OutboundEmailDispatcher.getInstance();
      const oppPayload: LifecycleAlertOpportunityInput = {
        id: alertResult.alert.id,
        title: input.role.title,
        companyName: input.companyName,
        location: input.role.location || null,
        workMode: input.role.workMode || null,
        primaryApplyUrl: input.role.applyUrl,
        description: input.role.description || null,
        matchReason: `Harvester captured unannounced role via ${input.role.sourcePlatform}`,
      };

      await dispatcher.dispatchLifecycleAlertEmail(
        {
          id: alertResult.alert.id,
          userId: input.userId,
          transitionType: "UNANNOUNCED_ROLE",
          idempotencyKey: alertResult.alert.idempotencyKey,
          title: alertResult.alert.title,
          companyName: alertResult.alert.companyName,
          message: alertResult.alert.message,
        },
        oppPayload
      ).catch(() => {});
    } catch (emailErr) {
      console.warn("[LifecycleNotificationService] Email dispatch warning:", emailErr);
    }
  }

  return alertResult;
}
