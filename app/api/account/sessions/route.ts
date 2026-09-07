/**
 * §SESSION MANAGEMENT API (INTENTIONALLY UNUSED IN OPTION B / PRESERVED FOR COMPANION EXTENSION)
 * 
 * ARCHITECTURAL NOTICE:
 * Per Option B, all job connectors (including LinkedIn) operate autonomously via direct ATS
 * APIs and public guest search endpoints without requiring user login or session cookies.
 * 
 * This endpoint and its underlying AES-256-GCM encrypted storage are preserved specifically
 * for a possible future companion browser extension (e.g. Manifest V3 extension with chrome.cookies
 * permission) that automatically syncs session states without manual paste or DevTools.
 * It is intentionally NOT referenced or required by the primary web UI flow.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { browserSessionManager } from "@/lib/discovery/browser/browserSessionManager";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/sessions
 * Lists all active browser sessions for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    const isDevOrTest =
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test" ||
      (process.env as any).IS_TEST_HARNESS === "true";

    const effectiveUserId = userId || (isDevOrTest ? "dev_user" : null);

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to view sessions." },
        { status: 401 }
      );
    }

    const sessions = await browserSessionManager.listUserSessions(effectiveUserId);

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (err: unknown) {
    console.error("[AccountSessionsAPI] GET error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to list sessions." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/account/sessions
 * Safe account linking: securely encrypts and stores authenticated session state / cookies.
 * NEVER requires or handles user passwords.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    const isDevOrTest =
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test" ||
      (process.env as any).IS_TEST_HARNESS === "true";

    const effectiveUserId = userId || (isDevOrTest ? "dev_user" : null);

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to connect a session." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { source, sessionCookie, username, rawState } = body;

    if (!source || typeof source !== "string") {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "A valid source name (e.g. LINKEDIN) is required." },
        { status: 400 }
      );
    }

    const normalizedSource = source.trim().toUpperCase();

    // Construct or validate safe storage state
    let statePayload: Record<string, unknown>;

    if (rawState && typeof rawState === "object") {
      statePayload = rawState;
    } else if (sessionCookie && typeof sessionCookie === "string") {
      const cleanCookie = sessionCookie.trim();
      if (cleanCookie.length < 10) {
        return NextResponse.json(
          { error: "INVALID_COOKIE", message: "Session cookie appears invalid or too short." },
          { status: 400 }
        );
      }

      statePayload = {
        cookies: [
          {
            name: normalizedSource === "LINKEDIN" ? "li_at" : "session_token",
            value: cleanCookie,
            domain: normalizedSource === "LINKEDIN" ? ".linkedin.com" : ".indeed.com",
            path: "/",
            httpOnly: true,
            secure: true,
          },
        ],
        connectedAt: new Date().toISOString(),
      };
    } else {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "Please provide either sessionCookie or rawState." },
        { status: 400 }
      );
    }

    const record = await browserSessionManager.createOrUpdateSession(
      effectiveUserId,
      normalizedSource,
      statePayload,
      {
        authMethod: "STORAGE_STATE",
        username: username?.trim() || `${normalizedSource} Authenticated Session`,
        expiresInMs: 30 * 24 * 60 * 60 * 1000, // 30-day session lifespan
        metadata: {
          connectedVia: "SAFE_ACCOUNT_LINKING",
          clientUserAgent: request.headers.get("user-agent") || "BrowserPilot WebClient",
          connectedAt: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: `${normalizedSource} session linked successfully.`,
      session: record,
    });
  } catch (err: unknown) {
    console.error("[AccountSessionsAPI] POST error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to connect session." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/account/sessions
 * Securely deletes / revokes a user's browser session.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    const isDevOrTest =
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test" ||
      (process.env as any).IS_TEST_HARNESS === "true";

    const effectiveUserId = userId || (isDevOrTest ? "dev_user" : null);

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to manage sessions." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    let source = searchParams.get("source");

    if (!source) {
      const body = await request.json().catch(() => ({}));
      source = body.source;
    }

    if (!source || typeof source !== "string") {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "source parameter is required." },
        { status: 400 }
      );
    }

    const normalizedSource = source.trim().toUpperCase();
    await browserSessionManager.deleteSession(effectiveUserId, normalizedSource);

    return NextResponse.json({
      success: true,
      message: `${normalizedSource} session disconnected successfully.`,
    });
  } catch (err: unknown) {
    console.error("[AccountSessionsAPI] DELETE error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to disconnect session." },
      { status: 500 }
    );
  }
}
