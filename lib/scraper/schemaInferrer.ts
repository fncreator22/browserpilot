/**
 * §NATURAL LANGUAGE SCHEMA INFERRER & STRUCTURED EXTRACTOR
 * Analyzes free-form user extraction requests and automatically synthesizes
 * strict JSON schemas for guaranteed type-safe data parsing via Gemini 3.6/3.7 Flash.
 */

import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { DEFAULT_GEMINI_MODEL, getEffectiveGeminiApiKey } from "@/lib/ai/modelSelector";

export interface SchemaField {
  name: string;
  type: "STRING" | "NUMBER" | "BOOLEAN" | "ARRAY";
  description: string;
  required: boolean;
}

export interface InferredExtractionSchema {
  entityName: string;
  collectionName: string;
  description: string;
  fields: SchemaField[];
  targetUrlHint?: string;
  searchQueryHint?: string;
}

export interface ExtractionResult<T = Record<string, unknown>> {
  schema: InferredExtractionSchema;
  items: T[];
  totalExtracted: number;
  extractedAt: string;
}

const SCHEMA_INFERENCE_CONFIG: Schema = {
  type: Type.OBJECT,
  properties: {
    entityName: {
      type: Type.STRING,
      description: "Singular PascalCase entity name (e.g. JobListing, ProductItem, StartupProfile)",
    },
    collectionName: {
      type: Type.STRING,
      description: "Plural camelCase collection name (e.g. jobs, products, startups)",
    },
    description: {
      type: Type.STRING,
      description: "Brief summary of what is being extracted",
    },
    fields: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "camelCase column name (e.g. title, price, company, url, rating)",
          },
          type: {
            type: Type.STRING,
            enum: ["STRING", "NUMBER", "BOOLEAN", "ARRAY"],
          },
          description: {
            type: Type.STRING,
            description: "What this column represents",
          },
          required: {
            type: Type.BOOLEAN,
          },
        },
        required: ["name", "type", "description", "required"],
      },
    },
    targetUrlHint: {
      type: Type.STRING,
      description: "Direct URL if mentioned in prompt, or null",
    },
    searchQueryHint: {
      type: Type.STRING,
      description: "Organic search query to find the target page if no direct URL is provided",
    },
  },
  required: ["entityName", "collectionName", "description", "fields"],
};

/**
 * Automatically infers structured table columns from a natural language prompt
 */
export async function inferExtractionSchema(
  prompt: string,
  apiKeyOverride?: string
): Promise<InferredExtractionSchema> {
  const apiKey = getEffectiveGeminiApiKey(apiKeyOverride);
  if (!apiKey) {
    // Deterministic fallback schema if no API key is available
    return {
      entityName: "DataItem",
      collectionName: "items",
      description: "Extracted data items",
      fields: [
        { name: "title", type: "STRING", description: "Title or name", required: true },
        { name: "description", type: "STRING", description: "Details or description", required: false },
        { name: "url", type: "STRING", description: "Link or reference URL", required: false },
      ],
      searchQueryHint: prompt,
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are an expert web data architect.
Analyze the user's natural language goal and synthesize the optimal tabular schema for data extraction.
Extract 3 to 8 clean, meaningful column fields.
ALWAYS include a 'url', 'applyUrl', or 'link' column field whenever extracting jobs, products, directory items, or articles so users have direct links.
If a direct URL is present in the prompt, populate targetUrlHint.
If no URL is present, provide an optimal search query in searchQueryHint.`;

  const response = await ai.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: SCHEMA_INFERENCE_CONFIG,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("Failed to infer extraction schema from prompt.");
  }

  return JSON.parse(text) as InferredExtractionSchema;
}

/**
 * Extracts structured items from distilled page content using the inferred schema
 */
export async function extractStructuredData(
  distilledContent: string,
  schema: InferredExtractionSchema,
  goal: string,
  apiKeyOverride?: string
): Promise<ExtractionResult> {
  const apiKey = getEffectiveGeminiApiKey(apiKeyOverride);
  if (!apiKey) {
    return {
      schema,
      items: [],
      totalExtracted: 0,
      extractedAt: new Date().toISOString(),
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  // Build dynamic Gemini responseSchema from inferred fields
  const itemProperties: Record<string, Schema> = {};
  const requiredFields: string[] = [];

  for (const field of schema.fields) {
    let schemaType = Type.STRING;
    if (field.type === "NUMBER") schemaType = Type.NUMBER;
    if (field.type === "BOOLEAN") schemaType = Type.BOOLEAN;
    if (field.type === "ARRAY") {
      itemProperties[field.name] = {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: field.description,
      };
    } else {
      itemProperties[field.name] = {
        type: schemaType,
        description: field.description,
      };
    }

    if (field.required) {
      requiredFields.push(field.name);
    }
  }

  const extractionSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: itemProperties,
          required: requiredFields.length > 0 ? requiredFields : undefined,
        },
      },
    },
    required: ["items"],
  };

  const systemInstruction = `You are a precision web data extraction engine.
Extract all instances of ${schema.entityName} matching the user goal: "${goal}".
Extract accurate information from the provided page text.
Do not fabricate information. If a non-required field is missing, use null or empty string.`;

  const response = await ai.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: `Page Content:\n\n${distilledContent}`,
    config: {
      systemInstruction,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: extractionSchema,
    },
  });

  const text = response.text?.trim();
  let extractedItems: Array<Record<string, unknown>> = [];

  if (text) {
    try {
      const parsed = JSON.parse(text);
      extractedItems = Array.isArray(parsed.items) ? parsed.items : [];
    } catch {}
  }

  return {
    schema,
    items: extractedItems,
    totalExtracted: extractedItems.length,
    extractedAt: new Date().toISOString(),
  };
}
