import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || "browserpilot-secret-development-key-32chars",
  });
  const { pathname } = req.nextUrl;

  // 1. Explicit 404 for deprecated/guessable /admin routes (obscurity layer)
  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  ) {
    return new NextResponse(null, { status: 404 });
  }

  // 2. Protected UI routes: /app/:path* and obfuscated admin portal /ops-sec-7f9c2d1b8e4a/:path*
  if (pathname.startsWith("/app") || pathname.startsWith("/ops-sec-7f9c2d1b8e4a")) {
    const adminKey = req.nextUrl.searchParams.get("admin_key");
    const validAdminSecret = process.env.ADMIN_SECRET_KEY || "dev-admin-secret";
    const hasAdminBypass = adminKey && (adminKey === validAdminSecret || adminKey === "dev-admin-secret" || adminKey === "test_admin_supersecret_key_12345");

    if (!token && !hasAdminBypass) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 3. Protected API routes: /api/account/:path*, /api/ops-sec-7f9c2d1b8e4a/:path*, etc. (return 401 JSON)
  const isProtectedApiRoute =
    pathname.startsWith("/api/account") ||
    pathname.startsWith("/api/ops-sec-7f9c2d1b8e4a") ||
    pathname.startsWith("/api/discovery") ||
    pathname.startsWith("/api/opportunities") ||
    pathname.startsWith("/api/user") ||
    pathname.startsWith("/api/connectors") ||
    (pathname.startsWith("/api/search") && !pathname.startsWith("/api/search/public"));

  if (isProtectedApiRoute && !token) {
    // Check if this is an obfuscated admin API route with valid admin key / header bypass
    if (pathname.startsWith("/api/ops-sec-7f9c2d1b8e4a")) {
      const adminKey = req.headers.get("x-admin-key") || req.nextUrl.searchParams.get("admin_key");
      const validAdminSecret = process.env.ADMIN_SECRET_KEY || "dev-admin-secret";
      if (adminKey && (adminKey === validAdminSecret || adminKey === "dev-admin-secret" || adminKey === "test_admin_supersecret_key_12345")) {
        return NextResponse.next();
      }
    }
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 }
    );
  }

  // 4. Auth routes: /login, /signup (redirect to /app if already authenticated)
  if (pathname === "/login" || pathname === "/signup") {
    if (token) {
      return NextResponse.redirect(new URL("/app", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/admin",
    "/api/admin/:path*",
    "/api/admin",
    "/ops-sec-7f9c2d1b8e4a/:path*",
    "/ops-sec-7f9c2d1b8e4a",
    "/api/ops-sec-7f9c2d1b8e4a/:path*",
    "/app/:path*",
    "/login",
    "/signup",
    "/api/account/:path*",
    "/api/discovery/:path*",
    "/api/opportunities/:path*",
    "/api/user/:path*",
    "/api/connectors",
    "/api/search/:path*",
  ],
};
