/**
 * §SERVER-AUTHORITATIVE FEATURE FLAGS (TASK-035)
 * 
 * Provides centralized, server-side feature toggle resolution
 * ensuring privileged capabilities cannot be spoofed by client states.
 */

export interface FeatureFlagSummary {
  paymentProductionMode: boolean;
  autonomousWatchEnabled: boolean;
  emailDispatchEnabled: boolean;
  maintenanceMode: boolean;
  distributedSchedulerReady: boolean;
}

export function isPaymentProductionMode(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    !!process.env.RAZORPAY_KEY_SECRET &&
    process.env.ENABLE_PAYMENT_PRODUCTION === "true"
  );
}

export function isAutonomousWatchEnabled(): boolean {
  // Enabled by default unless explicitly turned off for maintenance
  return process.env.ENABLE_AUTONOMOUS_WATCH !== "false";
}

export function isEmailDispatchEnabled(): boolean {
  return (
    process.env.ENABLE_EMAIL_DISPATCH === "true" ||
    !!process.env.RESEND_API_KEY ||
    !!process.env.SENDGRID_API_KEY
  );
}

export function isMaintenanceMode(): boolean {
  return process.env.MAINTENANCE_MODE === "true";
}

export function isDistributedSchedulerReady(): boolean {
  return !!process.env.REDIS_URL;
}

export function getFeatureFlagSummary(): FeatureFlagSummary {
  return {
    paymentProductionMode: isPaymentProductionMode(),
    autonomousWatchEnabled: isAutonomousWatchEnabled(),
    emailDispatchEnabled: isEmailDispatchEnabled(),
    maintenanceMode: isMaintenanceMode(),
    distributedSchedulerReady: isDistributedSchedulerReady(),
  };
}
