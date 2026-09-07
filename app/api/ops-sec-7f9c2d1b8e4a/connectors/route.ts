import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { connectorUsageService } from "@/lib/discovery/connectors/connectorUsageService";
import { prisma } from "@/lib/db/prisma";

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

    const data = await connectorUsageService.getConnectorDashboardData();

    return NextResponse.json({
      success: true,
      role: auth.role,
      ...data,
    });
  } catch (err: unknown) {
    console.error("[Admin Connectors API] GET error:", err);
    return NextResponse.json(
      { error: "CONNECTORS_FETCH_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      displayName,
      type = "CAREER_PORTAL",
      baseUrl,
      baseUrlPattern,
      requiresAuth = false,
      iconUrl,
      isEnabled = true,
      status = "ACTIVE",
    } = body;

    if (!displayName?.trim() || !baseUrl?.trim()) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Display name and base URL are required." },
        { status: 400 }
      );
    }

    const identifier = (name?.trim() || displayName.trim())
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");

    // Check for existing source with same name or baseUrl
    const existing = await prisma.discoverySource.findFirst({
      where: {
        OR: [
          { name: { equals: identifier, mode: "insensitive" } },
          { baseUrl: { equals: baseUrl.trim(), mode: "insensitive" } },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "CONFLICT", message: `A connector with identifier "${identifier}" or baseUrl already exists.` },
        { status: 409 }
      );
    }

    const connector = await prisma.discoverySource.create({
      data: {
        name: identifier,
        displayName: displayName.trim(),
        type,
        baseUrl: baseUrl.trim(),
        baseUrlPattern: baseUrlPattern?.trim() || `*${new URL(baseUrl.trim()).hostname}*`,
        requiresAuth: Boolean(requiresAuth),
        iconUrl: iconUrl?.trim() || null,
        isEnabled: Boolean(isEnabled),
        status: status || "ACTIVE",
        reliabilityScore: 1.0,
      },
    });

    return NextResponse.json({
      success: true,
      connector,
    });
  } catch (err: unknown) {
    console.error("[Admin Connectors API] POST error:", err);
    return NextResponse.json(
      { error: "CONNECTOR_CREATE_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}
