/**
 * §STRUCTURED PRODUCTION LOGGER (TASK-035)
 * 
 * Provides structured JSON-ready logging with correlation IDs
 * and automatic redaction of confidential secrets and credentials.
 */

import { sanitizeSecurityMetadata } from "@/lib/security/auditLog";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  module?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class ProductionLogger {
  private moduleName: string;

  constructor(moduleName = "app") {
    this.moduleName = moduleName;
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    correlationId?: string,
    err?: Error
  ): LogEntry {
    const sanitizedContext = context ? sanitizeSecurityMetadata(context) : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      module: this.moduleName,
      correlationId,
      context: sanitizedContext,
    };

    if (err) {
      entry.error = {
        name: err.name,
        message: err.message,
        // In production, omit internal stack traces unless debug mode is enabled
        stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
      };
    }

    return entry;
  }

  public debug(message: string, context?: Record<string, unknown>, correlationId?: string): void {
    if (process.env.LOG_LEVEL === "DEBUG" || process.env.NODE_ENV !== "production") {
      const entry = this.formatEntry("DEBUG", message, context, correlationId);
      console.debug(JSON.stringify(entry));
    }
  }

  public info(message: string, context?: Record<string, unknown>, correlationId?: string): void {
    const entry = this.formatEntry("INFO", message, context, correlationId);
    console.info(JSON.stringify(entry));
  }

  public warn(message: string, context?: Record<string, unknown>, correlationId?: string): void {
    const entry = this.formatEntry("WARN", message, context, correlationId);
    console.warn(JSON.stringify(entry));
  }

  public error(message: string, err?: Error, context?: Record<string, unknown>, correlationId?: string): void {
    const entry = this.formatEntry("ERROR", message, context, correlationId, err);
    console.error(JSON.stringify(entry));
  }
}

export function createLogger(moduleName: string): ProductionLogger {
  return new ProductionLogger(moduleName);
}

export const logger = new ProductionLogger("system");
