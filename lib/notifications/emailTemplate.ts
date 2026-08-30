/**
 * §LIFECYCLE ALERT EMAIL TEMPLATE FORMATTER (TASK-020)
 * Formats structured, readable HTML and plain-text email contents
 * containing all essential opportunity fields without requiring the user
 * to open the browser immediately.
 */

import { type OutboundEmailPayload } from "./emailProvider";

export function formatLifecycleAlertEmail(payload: Omit<OutboundEmailPayload, "textBody" | "htmlBody">): {
  subject: string;
  textBody: string;
  htmlBody: string;
} {
  const opp = payload.opportunity;
  const baseUrl = payload.appBaseUrl || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const detailsUrl = `${baseUrl}/app/opportunities/${opp.id}`;

  const classificationLabels: Record<string, string> = {
    NEW_OPPORTUNITY: "NEW OPPORTUNITY",
    REPOSTED: "REPOSTED OPENING",
    NEW_SOURCE: "NEW APPLY SOURCE",
  };

  const badgeText = classificationLabels[payload.alertType] || payload.alertType;
  const matchScoreText = typeof opp.matchScore === "number" ? `${Math.round(opp.matchScore)}% match` : null;

  // 1. Subject Line
  const subject = `[BrowserPilot Alert] ${badgeText}: ${opp.title} at ${opp.companyName}${matchScoreText ? ` (${matchScoreText})` : ""}`;

  // 2. Plain-Text Body
  const skillsList = Array.isArray(opp.skills)
    ? opp.skills.join(", ")
    : typeof opp.skills === "string"
    ? opp.skills
    : null;

  const lines: string[] = [
    `=== BROWSERPILOT OPPORTUNITY ALERT ===`,
    `Classification: [${badgeText}]`,
    `Role:           ${opp.title}`,
    `Company:        ${opp.companyName}`,
    `Location:       ${opp.location || "Not specified"}`,
    `Work Mode:      ${opp.workMode || "Not specified"}`,
    `Type:           ${opp.opportunityType || "Not specified"}`,
  ];

  if (matchScoreText) {
    lines.push(`Fit Score:      ${matchScoreText}`);
  }

  if (opp.postedAgoText) {
    lines.push(`Freshness:      ${opp.postedAgoText}`);
  } else if (opp.postedAt) {
    lines.push(`Posted:         ${new Date(opp.postedAt).toLocaleDateString()}`);
  }

  if (skillsList) {
    lines.push(`Key Skills:     ${skillsList}`);
  }

  if (opp.matchReason) {
    lines.push(`Match Reason:   ${opp.matchReason}`);
  }

  lines.push(``);
  if (opp.primaryApplyUrl) {
    lines.push(`Direct Apply:   ${opp.primaryApplyUrl}`);
  }
  lines.push(`View Details:   ${detailsUrl}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(`Delivered automatically by BrowserPilot Autonomous Watch.`);

  const textBody = lines.join("\n");

  // 3. Clean HTML Body
  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; color: #f1f5f9; padding: 24px 12px; margin: 0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden;">
    <!-- Header -->
    <tr>
      <td style="padding: 24px; border-bottom: 1px solid #1e293b; background: linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(17,24,39,0) 100%);">
        <div style="font-size: 11px; font-weight: bold; color: #818cf8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">BrowserPilot Autonomous Watch</div>
        <div style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.05em;">
          ${badgeText}
        </div>
      </td>
    </tr>

    <!-- Body Content -->
    <tr>
      <td style="padding: 24px;">
        <h1 style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 0 0 8px 0; line-height: 1.3;">
          ${opp.title}
        </h1>
        <div style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;">
          <strong style="color: #cbd5e1;">${opp.companyName}</strong> • ${opp.location || "Remote"}
        </div>

        <!-- Meta Table -->
        <table width="100%" cellspacing="0" cellpadding="8" style="background-color: #0f172a; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #cbd5e1;">
          <tr>
            <td width="35%" style="color: #64748b; font-weight: 600;">Work Mode:</td>
            <td><strong>${opp.workMode || "Any"}</strong></td>
          </tr>
          ${matchScoreText ? `
          <tr>
            <td style="color: #64748b; font-weight: 600;">Relevance Score:</td>
            <td><span style="color: #34d399; font-weight: bold;">${matchScoreText}</span></td>
          </tr>` : ""}
          ${opp.postedAgoText ? `
          <tr>
            <td style="color: #64748b; font-weight: 600;">Posting Freshness:</td>
            <td>${opp.postedAgoText}</td>
          </tr>` : ""}
          ${skillsList ? `
          <tr>
            <td style="color: #64748b; font-weight: 600;">Matched Skills:</td>
            <td>${skillsList}</td>
          </tr>` : ""}
        </table>

        ${opp.matchReason ? `
        <div style="background-color: #1e293b; border-left: 3px solid #6366f1; padding: 12px; border-radius: 4px; font-size: 12px; color: #cbd5e1; margin-bottom: 24px;">
          <strong style="color: #818cf8;">Why it matched:</strong> ${opp.matchReason}
        </div>` : ""}

        <!-- Buttons -->
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            ${opp.primaryApplyUrl ? `
            <td style="padding-right: 8px;">
              <a href="${opp.primaryApplyUrl}" target="_blank" style="display: block; text-align: center; background-color: #4f46e5; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: bold;">
                Apply Directly &rarr;
              </a>
            </td>` : ""}
            <td style="${opp.primaryApplyUrl ? "padding-left: 8px;" : ""}">
              <a href="${detailsUrl}" target="_blank" style="display: block; text-align: center; background-color: #1e293b; color: #cbd5e1; border: 1px solid #334155; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600;">
                View in BrowserPilot
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 16px 24px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; text-align: center;">
        You received this notification because of an active Autonomous Watch on your BrowserPilot account.<br>
        <a href="${baseUrl}/app/history?tab=WATCH" style="color: #818cf8; text-decoration: underline;">Manage Watch Settings</a>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, textBody, htmlBody };
}
