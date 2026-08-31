/**
 * §REQUEST CORRELATION SERVICE (TASK-035)
 * 
 * Provides unified request correlation tracking across HTTP routes,
 * discovery executions, billing verifications, and background tasks.
 */

export function generateCorrelationId(prefix = "req"): string {
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${randomSuffix}`;
}

export function extractCorrelationId(headers?: Headers | null): string {
  if (!headers) return generateCorrelationId();

  const existing =
    headers.get("x-request-id") ||
    headers.get("x-correlation-id") ||
    headers.get("x-amzn-trace-id");

  if (existing && existing.trim().length > 0) {
    return existing.trim();
  }

  return generateCorrelationId();
}
