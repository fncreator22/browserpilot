/**
 * §ACCOUNT PROVIDERS REST API ROUTE (TASK-032)
 * GET /api/account/providers - List connected AI providers for the session user
 * POST /api/account/providers - Connect or update a BYOK API credential
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import {
  getUserProviderConnections,
  upsertApiKeyConnection,
  disconnectProviderConnection,
  SUPPORTED_PROVIDERS,
} from "@/lib/ai/governance/providerGovernance";
import { z } from "zod";

const ConnectApiKeySchema = z.object({
  provider: z.enum(["GEMINI_BYOK", "OPENAI_BYOK", "ANTHROPIC_BYOK"]),
  apiKey: z.string().min(8, "API Key must be at least 8 characters").max(500, "API Key too long"),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    const userId = sessionUser?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const providers = await getUserProviderConnections(userId);

    return NextResponse.json({
      providers,
      supportedProviders: SUPPORTED_PROVIDERS,
    });
  } catch (err: unknown) {
    console.error("[GET /api/account/providers] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve provider connections." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    const userId = sessionUser?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Request body is required." },
        { status: 400 }
      );
    }

    const parseResult = ConnectApiKeySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          message: parseResult.error.issues[0]?.message || "Invalid provider data.",
          errors: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const connection = await upsertApiKeyConnection(userId, parseResult.data);

    return NextResponse.json({
      success: true,
      provider: connection,
    });
  } catch (err: unknown) {
    console.error("[POST /api/account/providers] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: (err as Error).message || "Failed to save provider credential." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    const userId = sessionUser?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Provider query parameter is required." },
        { status: 400 }
      );
    }

    const result = await disconnectProviderConnection(userId, provider);

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[DELETE /api/account/providers] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to disconnect provider." },
      { status: 500 }
    );
  }
}
