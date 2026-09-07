/**
 * Admin Routing Configuration
 * 
 * Defines the non-guessable, obfuscated URL structure for the Administrative Control Plane.
 * 
 * IMPORTANT SECURITY NOTE:
 * Obfuscating the URL path provides defence-in-depth against credential stuffing, crawler discovery,
 * and automated vulnerability scanners. It is a SUPPLEMENTARY obscurity layer.
 * Real access control is strictly enforced by server-side verification:
 * 1. verifyAdminAccess() checking timing-safe ADMIN_SECRET_KEY / rate-limited IP lockout
 * 2. NextAuth getServerSession() requiring authenticated database role of "ADMIN" or "SUPERADMIN"
 * 3. Middleware route gating
 */

export const ADMIN_ROUTE_SEGMENT = process.env.ADMIN_ROUTE_SEGMENT || "ops-sec-7f9c2d1b8e4a";

export const ADMIN_UI_ROUTES = {
  OVERVIEW: `/${ADMIN_ROUTE_SEGMENT}`,
  CONNECTORS: `/${ADMIN_ROUTE_SEGMENT}/connectors`,
  WATCHES: `/${ADMIN_ROUTE_SEGMENT}/watches`,
  RUNS: `/${ADMIN_ROUTE_SEGMENT}/runs`,
  SCHEDULER: `/${ADMIN_ROUTE_SEGMENT}/scheduler`,
} as const;

export const ADMIN_API_ROUTES = {
  BASE: `/api/${ADMIN_ROUTE_SEGMENT}`,
  METRICS: `/api/${ADMIN_ROUTE_SEGMENT}/metrics`,
  CONNECTORS: `/api/${ADMIN_ROUTE_SEGMENT}/connectors`,
  WATCHES: `/api/${ADMIN_ROUTE_SEGMENT}/watches`,
  RUNS: `/api/${ADMIN_ROUTE_SEGMENT}/runs`,
  SCHEDULER: `/api/${ADMIN_ROUTE_SEGMENT}/scheduler`,
  BILLING: `/api/${ADMIN_ROUTE_SEGMENT}/billing`,
  COUPONS: `/api/${ADMIN_ROUTE_SEGMENT}/coupons`,
  SEARCH_TELEMETRY: `/api/${ADMIN_ROUTE_SEGMENT}/search-telemetry`,
} as const;
