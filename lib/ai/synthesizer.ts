import { config } from "dotenv";
import { type Observation } from "@/schemas/actions";
import { type VerificationStatus } from "@/schemas/results";
import { getGeminiClient, GEMINI_MODEL_NAME } from "./intent";

config();

export interface SynthesisInput {
  goal: string;
  verificationStatus: VerificationStatus;
  extractedData?: unknown;
  observations: Observation[];
  satisfiedCriteria?: string[];
  missingFields?: string[];
}

export interface SynthesisResult {
  answer: string;
  tokensUsed?: number;
}

const SYNTHESIZER_SYSTEM_INSTRUCTION = `
You are the Final Result Synthesizer for BrowserPilot.
Your task is to take the extracted web data, user goal, and verified observations from an autonomous browser execution session, and produce a clear, concise, and structured answer for the user.

Guidelines:
- If verification is VERIFIED: Present the extracted answer directly, formatted with tables or bullet points if applicable.
- If verification is PARTIAL: Clearly explain what was retrieved and what could not be found.
- If verification is BLOCKED: Explain the security or authentication barrier encountered.
- Keep the response professional, concise, and directly actionable.
`;

/**
 * Synthesizes final user-facing response with token usage metadata
 */
export async function synthesizeFinalAnswerWithMetadata(input: SynthesisInput): Promise<SynthesisResult> {
  const { goal, verificationStatus, extractedData, satisfiedCriteria = [], missingFields = [] } = input;
  let tokensUsed: number | undefined;

  // Try live Gemini synthesis if API key is present
  try {
    const ai = getGeminiClient();
    if (ai) {
      const prompt = `
Goal: ${goal}
Verification Status: ${verificationStatus}
Satisfied Criteria: ${satisfiedCriteria.join(", ")}
Missing Fields: ${missingFields.join(", ")}
Extracted Raw Payload:
${typeof extractedData === "object" ? JSON.stringify(extractedData, null, 2) : String(extractedData || "None")}
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: SYNTHESIZER_SYSTEM_INSTRUCTION,
          temperature: 0.2,
        },
      });

      tokensUsed = response.usageMetadata?.totalTokenCount;

      if (response.text?.trim()) {
        return { answer: response.text.trim(), tokensUsed };
      }
    }
  } catch {
    // Fall back to deterministic structured synthesizer if API key is missing or offline
  }

  // Deterministic Synthesizer Fallback
  let fallbackAnswer = "";
  if (verificationStatus === "VERIFIED") {
    if (typeof extractedData === "string") {
      fallbackAnswer = `### Task Complete (Verified)\n\n${extractedData}\n\n*Satisfied: ${satisfiedCriteria.join(", ") || "All criteria met"}*`;
    } else {
      fallbackAnswer = `### Task Complete (Verified)\n\n${JSON.stringify(extractedData, null, 2)}`;
    }
  } else if (verificationStatus === "PARTIAL") {
    fallbackAnswer = `### Partial Result\n\nThe task executed with partial success. Retrieved data:\n\n${JSON.stringify(
      extractedData || "Limited text captured",
      null,
      2
    )}\n\n**Missing or unverified items:** ${missingFields.join(", ") || "Target selectors partially matched"}.`;
  } else if (verificationStatus === "BLOCKED") {
    fallbackAnswer = `### Task Blocked\n\nExecution was halted because the website presented a security verification or authentication barrier that cannot be completed autonomously.`;
  } else {
    fallbackAnswer = `### Task Execution Finished (${verificationStatus})\n\nGoal: "${goal}".`;
  }

  return { answer: fallbackAnswer, tokensUsed };
}

/**
 * Synthesizes final user-facing response from verified execution data
 */
export async function synthesizeFinalAnswer(input: SynthesisInput): Promise<string> {
  const result = await synthesizeFinalAnswerWithMetadata(input);
  return result.answer;
}
