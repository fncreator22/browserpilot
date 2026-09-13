import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { careerBrainService } from "@/lib/discovery/taxonomy/careerBrainService";
import { recordSecurityEvent } from "@/lib/security/auditLog";

export const dynamic = "force-dynamic";

/**
 * GET /api/ops-sec-7f9c2d1b8e4a/taxonomy
 * Retrieves the complete career taxonomy tree, departments, and growth statistics
 */
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

    const summary = careerBrainService.getTaxonomySummary();
    const departments = careerBrainService.getAllDepartments();

    return NextResponse.json({
      success: true,
      role: auth.role,
      summary,
      departments,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "TAXONOMY_FETCH_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ops-sec-7f9c2d1b8e4a/taxonomy
 * Actions: ADD_DEPARTMENT, ADD_CATEGORY, ADD_ROLE
 */
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

    const body = await request.json().catch(() => null);
    if (!body || !body.action) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Missing required 'action' field." },
        { status: 400 }
      );
    }

    const adminEmail = (auth as any).user?.email || "admin@browserpilot.ai";

    switch (body.action) {
      case "ADD_DEPARTMENT": {
        const { id, name, description } = body;
        if (!id || !name) {
          return NextResponse.json({ error: "BAD_REQUEST", message: "Department id and name required" }, { status: 400 });
        }
        const dept = await careerBrainService.addDepartment({ id, name, description: description || "" });
        await recordSecurityEvent({
          type: "ADMIN_CONFIG_CHANGE",
          userId: adminEmail,
          path: request.nextUrl.pathname,
          details: { action: "TAXONOMY_ADD_DEPARTMENT", id, name },
        });
        return NextResponse.json({ success: true, department: dept });
      }

      case "ADD_CATEGORY": {
        const { departmentId, id, name, description, keywords } = body;
        if (!departmentId || !id || !name) {
          return NextResponse.json({ error: "BAD_REQUEST", message: "departmentId, category id and name required" }, { status: 400 });
        }
        const cat = await careerBrainService.addCategory(departmentId, {
          id,
          name,
          description: description || "",
          keywords: Array.isArray(keywords) ? keywords : [],
        });
        await recordSecurityEvent({
          type: "ADMIN_CONFIG_CHANGE",
          userId: adminEmail,
          path: request.nextUrl.pathname,
          details: { action: "TAXONOMY_ADD_CATEGORY", departmentId, id, name, keywordsCount: cat.keywords.length },
        });
        return NextResponse.json({ success: true, category: cat });
      }

      case "ADD_ROLE": {
        const { departmentId, categoryId, canonicalTitle, aliases, coOccurringSkills, seniorityLevels } = body;
        if (!departmentId || !categoryId || !canonicalTitle) {
          return NextResponse.json({ error: "BAD_REQUEST", message: "departmentId, categoryId, and canonicalTitle required" }, { status: 400 });
        }
        const role = await careerBrainService.addOrUpdateRole(departmentId, categoryId, {
          canonicalTitle,
          aliases: Array.isArray(aliases) ? aliases : [],
          coOccurringSkills: Array.isArray(coOccurringSkills) ? coOccurringSkills : [],
          seniorityLevels: Array.isArray(seniorityLevels) ? seniorityLevels : undefined,
        });
        await recordSecurityEvent({
          type: "ADMIN_CONFIG_CHANGE",
          userId: adminEmail,
          path: request.nextUrl.pathname,
          details: { action: "TAXONOMY_ADD_ROLE", departmentId, categoryId, canonicalTitle },
        });
        return NextResponse.json({ success: true, role });
      }

      default:
        return NextResponse.json({ error: "UNKNOWN_ACTION", message: `Action '${body.action}' not recognized` }, { status: 400 });
    }
  } catch (err: unknown) {
    return NextResponse.json({ error: "TAXONOMY_MUTATE_ERROR", message: (err as Error).message }, { status: 500 });
  }
}

/**
 * PUT /api/ops-sec-7f9c2d1b8e4a/taxonomy
 * Actions: UPDATE_CATEGORY, UPDATE_ROLE
 */
export async function PUT(request: NextRequest) {
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

    const body = await request.json().catch(() => null);
    if (!body || !body.action) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Missing required 'action' field." },
        { status: 400 }
      );
    }

    const adminEmail = (auth as any).user?.email || "admin@browserpilot.ai";

    switch (body.action) {
      case "UPDATE_CATEGORY": {
        const { departmentId, categoryId, name, description, keywords } = body;
        if (!departmentId || !categoryId) {
          return NextResponse.json({ error: "BAD_REQUEST", message: "departmentId and categoryId required" }, { status: 400 });
        }
        const updated = await careerBrainService.updateCategory(departmentId, categoryId, {
          name,
          description,
          keywords,
        });
        if (!updated) {
          return NextResponse.json({ error: "NOT_FOUND", message: "Category not found" }, { status: 404 });
        }
        await recordSecurityEvent({
          type: "ADMIN_CONFIG_CHANGE",
          userId: adminEmail,
          path: request.nextUrl.pathname,
          details: { action: "TAXONOMY_UPDATE_CATEGORY", departmentId, categoryId, name: updated.name },
        });
        return NextResponse.json({ success: true, category: updated });
      }

      case "UPDATE_ROLE": {
        const { departmentId, categoryId, canonicalTitle, aliases, coOccurringSkills, seniorityLevels } = body;
        if (!departmentId || !categoryId || !canonicalTitle) {
          return NextResponse.json({ error: "BAD_REQUEST", message: "departmentId, categoryId, and canonicalTitle required" }, { status: 400 });
        }
        const role = await careerBrainService.addOrUpdateRole(departmentId, categoryId, {
          canonicalTitle,
          aliases,
          coOccurringSkills,
          seniorityLevels,
        });
        return NextResponse.json({ success: true, role });
      }

      default:
        return NextResponse.json({ error: "UNKNOWN_ACTION", message: `Action '${body.action}' not recognized` }, { status: 400 });
    }
  } catch (err: unknown) {
    return NextResponse.json({ error: "TAXONOMY_UPDATE_ERROR", message: (err as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/ops-sec-7f9c2d1b8e4a/taxonomy
 * Actions: DELETE_CATEGORY, DELETE_ROLE
 */
export async function DELETE(request: NextRequest) {
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

    const body = await request.json().catch(() => null);
    if (!body || !body.action) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Missing required 'action' field." },
        { status: 400 }
      );
    }

    const adminEmail = (auth as any).user?.email || "admin@browserpilot.ai";

    switch (body.action) {
      case "DELETE_CATEGORY": {
        const { departmentId, categoryId } = body;
        const ok = await careerBrainService.deleteCategory(departmentId, categoryId);
        await recordSecurityEvent({
          type: "ADMIN_CONFIG_CHANGE",
          userId: adminEmail,
          path: request.nextUrl.pathname,
          details: { action: "TAXONOMY_DELETE_CATEGORY", departmentId, categoryId, success: ok },
        });
        return NextResponse.json({ success: ok });
      }

      case "DELETE_ROLE": {
        const { departmentId, categoryId, roleSlug } = body;
        const ok = await careerBrainService.deleteRole(departmentId, categoryId, roleSlug);
        await recordSecurityEvent({
          type: "ADMIN_CONFIG_CHANGE",
          userId: adminEmail,
          path: request.nextUrl.pathname,
          details: { action: "TAXONOMY_DELETE_ROLE", departmentId, categoryId, roleSlug, success: ok },
        });
        return NextResponse.json({ success: ok });
      }

      default:
        return NextResponse.json({ error: "UNKNOWN_ACTION", message: `Action '${body.action}' not recognized` }, { status: 400 });
    }
  } catch (err: unknown) {
    return NextResponse.json({ error: "TAXONOMY_DELETE_ERROR", message: (err as Error).message }, { status: 500 });
  }
}
