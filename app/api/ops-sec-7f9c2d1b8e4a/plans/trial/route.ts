import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import {
  getAdminTrialConfig,
  updateAdminTrialConfig,
  extendUserTrial,
  setUserTrialExempt,
} from "@/lib/billing/trialService";
import { recordSecurityEvent } from "@/lib/security/auditLog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminHeader =
      request.headers.get("x-admin-key") ||
      request.headers.get("authorization") ||
      request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    const config = getAdminTrialConfig();
    return NextResponse.json({
      success: true,
      role: auth.role,
      config,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "TRIAL_CONFIG_FETCH_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminHeader =
      request.headers.get("x-admin-key") ||
      request.headers.get("authorization") ||
      request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { enforceTrial, defaultTrialDays, extendUserId, extendDays, exemptUserId, exempt } = body;

    if (typeof enforceTrial === "boolean" || typeof defaultTrialDays === "number") {
      updateAdminTrialConfig({
        enforceTrial: typeof enforceTrial === "boolean" ? enforceTrial : undefined,
        defaultTrialDays: typeof defaultTrialDays === "number" ? defaultTrialDays : undefined,
      });
    }

    if (extendUserId && typeof extendDays === "number") {
      extendUserTrial(extendUserId, extendDays);
    }

    if (exemptUserId && typeof exempt === "boolean") {
      setUserTrialExempt(exemptUserId, exempt);
    }

    recordSecurityEvent({
      type: "ADMIN_CONFIG_CHANGE",
      path: request.nextUrl.pathname,
      details: {
        action: "UPDATE_TRIAL_CONFIGURATION",
        body,
        adminUser: auth.userEmail || "SUPERADMIN_KEY",
      },
    });

    const updatedConfig = getAdminTrialConfig();
    return NextResponse.json({
      success: true,
      config: updatedConfig,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "TRIAL_CONFIG_UPDATE_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}
