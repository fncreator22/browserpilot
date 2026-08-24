import { z } from "zod";

/**
 * 8 Core v1 Browser Action Schemas
 * Single source of truth per skills/browser-agent.md
 */

// 1. browser.navigate
export const NavigateActionSchema = z.object({
  tool: z.literal("browser.navigate"),
  parameters: z.object({
    url: z.string().url("A valid HTTP or HTTPS URL is required"),
    waitUntil: z.enum(["load", "domcontentloaded", "networkidle", "commit"]).optional().default("domcontentloaded"),
    timeout: z.number().int().positive().max(60000).optional().default(30000),
  }),
  rationale: z.string().optional(),
});
export type NavigateAction = z.infer<typeof NavigateActionSchema>;

// 2. browser.inspect
export const InspectActionSchema = z.object({
  tool: z.literal("browser.inspect"),
  parameters: z.object({
    selector: z.string().optional().default("body"),
    depth: z.number().int().min(1).max(5).optional().default(2),
    maxElements: z.number().int().min(1).max(100).optional().default(30),
  }),
  rationale: z.string().optional(),
});
export type InspectAction = z.infer<typeof InspectActionSchema>;

// 3. browser.click
export const ClickActionSchema = z.object({
  tool: z.literal("browser.click"),
  parameters: z.object({
    selector: z.string().min(1, "Target selector is required"),
    button: z.enum(["left", "right", "middle"]).optional().default("left"),
    clickCount: z.number().int().min(1).max(3).optional().default(1),
    timeout: z.number().int().positive().max(30000).optional().default(5000),
  }),
  rationale: z.string().optional(),
});
export type ClickAction = z.infer<typeof ClickActionSchema>;

// 4. browser.fill
export const FillActionSchema = z.object({
  tool: z.literal("browser.fill"),
  parameters: z.object({
    selector: z.string().min(1, "Target selector is required"),
    value: z.string(),
    clearExisting: z.boolean().optional().default(true),
    timeout: z.number().int().positive().max(30000).optional().default(5000),
  }),
  rationale: z.string().optional(),
});
export type FillAction = z.infer<typeof FillActionSchema>;

// 5. browser.press
export const PressActionSchema = z.object({
  tool: z.literal("browser.press"),
  parameters: z.object({
    key: z.string().min(1, "Keyboard key identifier is required (e.g. Enter, Tab, Escape)"),
    selector: z.string().optional(),
    delayMs: z.number().int().min(0).max(1000).optional().default(0),
  }),
  rationale: z.string().optional(),
});
export type PressAction = z.infer<typeof PressActionSchema>;

// 6. browser.extractText
export const ExtractTextActionSchema = z.object({
  tool: z.literal("browser.extractText"),
  parameters: z.object({
    selector: z.string().optional().default("body"),
    extractMultiple: z.boolean().optional().default(false),
    maxChars: z.number().int().positive().max(100000).optional().default(10000),
  }),
  rationale: z.string().optional(),
});
export type ExtractTextAction = z.infer<typeof ExtractTextActionSchema>;

// 7. browser.screenshot
export const ScreenshotActionSchema = z.object({
  tool: z.literal("browser.screenshot"),
  parameters: z.object({
    fullPage: z.boolean().optional().default(false),
    filename: z.string().optional(),
    saveArtifact: z.boolean().optional().default(true),
  }),
  rationale: z.string().optional(),
});
export type ScreenshotAction = z.infer<typeof ScreenshotActionSchema>;

// 8. browser.getState
export const GetStateActionSchema = z.object({
  tool: z.literal("browser.getState"),
  parameters: z.object({}).optional().default({}),
  rationale: z.string().optional(),
});
export type GetStateAction = z.infer<typeof GetStateActionSchema>;

// Discriminated Union of all 8 browser actions
export const BrowserActionSchema = z.discriminatedUnion("tool", [
  NavigateActionSchema,
  InspectActionSchema,
  ClickActionSchema,
  FillActionSchema,
  PressActionSchema,
  ExtractTextActionSchema,
  ScreenshotActionSchema,
  GetStateActionSchema,
]);
export type BrowserAction = z.infer<typeof BrowserActionSchema>;
export type BrowserActionInput = z.input<typeof BrowserActionSchema>;

/**
 * Standard Observation Payload Schema
 */
export const ActionStatusSchema = z.enum(["SUCCESS", "FAILED", "BLOCKED"]);
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

export const ObservationSchema = z.object({
  stepIndex: z.number().int().min(0),
  action: BrowserActionSchema,
  status: ActionStatusSchema,
  currentUrl: z.string(),
  title: z.string(),
  pageSummary: z.string().optional(),
  extractedData: z.union([z.string(), z.array(z.string()), z.record(z.string(), z.unknown())]).optional(),
  screenshotPath: z.string().nullable().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    userMessage: z.string(),
    suggestion: z.string().optional(),
  }).nullable().optional(),
  elapsedMs: z.number().nonnegative(),
  timestamp: z.string(),
});
export type Observation = z.infer<typeof ObservationSchema>;
