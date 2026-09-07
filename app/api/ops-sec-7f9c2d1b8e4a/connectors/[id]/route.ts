import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { prisma } from "@/lib/db/prisma";
import { connectorUsageService } from "@/lib/discovery/connectors/connectorUsageService";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.discoverySource.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Connector "${id}" not found.` },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (body.displayName !== undefined) updateData.displayName = body.displayName.trim();
    if (body.iconUrl !== undefined) updateData.iconUrl = body.iconUrl ? body.iconUrl.trim() : null;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.baseUrl !== undefined) updateData.baseUrl = body.baseUrl.trim();
    if (body.baseUrlPattern !== undefined) updateData.baseUrlPattern = body.baseUrlPattern ? body.baseUrlPattern.trim() : null;
    if (body.requiresAuth !== undefined) updateData.requiresAuth = Boolean(body.requiresAuth);
    if (body.isEnabled !== undefined) updateData.isEnabled = Boolean(body.isEnabled);
    if (body.isPublic !== undefined) updateData.isPublic = Boolean(body.isPublic);
    if (body.status !== undefined) updateData.status = body.status;

    // If disabled via isEnabled flag, ensure status reflects it if desired
    if (body.isEnabled === false && updateData.status === undefined) {
      updateData.status = "DISABLED";
    } else if (body.isEnabled === true && existing.status === "DISABLED") {
      updateData.status = "ACTIVE";
    }

    const updated = await prisma.discoverySource.update({
      where: { id },
      data: updateData,
    });

    connectorUsageService.invalidateCache();

    return NextResponse.json({
      success: true,
      connector: updated,
    });
  } catch (err: unknown) {
    console.error("[Admin Connector ID API] PATCH error:", err);
    return NextResponse.json(
      { error: "CONNECTOR_UPDATE_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.discoverySource.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Connector "${id}" not found.` },
        { status: 404 }
      );
    }

    await prisma.discoverySource.delete({
      where: { id },
    });

    connectorUsageService.invalidateCache();

    return NextResponse.json({
      success: true,
      deletedId: id,
    });
  } catch (err: unknown) {
    console.error("[Admin Connector ID API] DELETE error:", err);
    return NextResponse.json(
      { error: "CONNECTOR_DELETE_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}
