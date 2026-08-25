/**
 * SERVERLESS PIPELINE EXPORT
 * Clean re-export of the unified pipeline engine (BullMQ-free, safe for Vercel Serverless).
 */

export { 
  executeJobPipeline as runServerlessPipeline,
  type PipelineExecutionInput as ServerlessBrowserJobPayload,
} from "@/lib/ai/pipelineEngine";
