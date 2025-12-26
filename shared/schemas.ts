/**
 * Shared Zod Validation Schemas
 *
 * These schemas are used by BOTH frontend (form validation) and backend (API validation)
 * to ensure consistency between client and server.
 *
 * Usage:
 *   - Frontend: Import for form validation before submission
 *   - Backend: Import for tRPC input validation
 */

import { z } from "zod";

// ============================================================================
// Common Enums & Types
// ============================================================================

export const HostIdSchema = z.enum(["alpha", "beta"]);
export type HostId = z.infer<typeof HostIdSchema>;

export const TrainingTypeSchema = z.enum(["sft", "lora", "qlora", "full"]);
export type TrainingType = z.infer<typeof TrainingTypeSchema>;

export const JobStatusSchema = z.enum(["queued", "preparing", "running", "completed", "failed", "cancelled"]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const DatasetTypeSchema = z.enum(["instruction", "code", "preference", "conversation", "raw"]);
export type DatasetType = z.infer<typeof DatasetTypeSchema>;

export const DatasetFormatSchema = z.enum(["jsonl", "parquet", "csv", "json", "txt"]);
export type DatasetFormat = z.infer<typeof DatasetFormatSchema>;

export const DatasetStatusSchema = z.enum(["pending", "scanning", "validated", "processing", "ready", "error"]);
export type DatasetStatus = z.infer<typeof DatasetStatusSchema>;

export const DocumentCategorySchema = z.enum(["training_data", "user_guide", "api_docs", "playbook"]);
export type DocumentCategory = z.infer<typeof DocumentCategorySchema>;

// ============================================================================
// Training Job Schemas
// ============================================================================

export const CreateTrainingJobSchema = z.object({
  name: z.string().min(1, "Job name is required").max(256, "Name too long"),
  description: z.string().optional(),
  baseModel: z.string().min(1, "Base model is required"),
  modelPath: z.string().optional(),
  outputPath: z.string().optional(),
  trainingType: TrainingTypeSchema.default("lora"),
  datasetPath: z.string().min(1, "Dataset path is required"),
  epochs: z.number().min(1, "Minimum 1 epoch").max(100, "Maximum 100 epochs").default(3),
  batchSize: z.number().min(1, "Minimum batch size 1").max(128, "Maximum batch size 128").default(4),
  learningRate: z.string().regex(/^\d+(\.\d+)?e-?\d+$|^\d+\.\d+$/, "Invalid learning rate format").default("2e-5"),
  maxSeqLength: z.number().min(128, "Minimum 128 tokens").max(32768, "Maximum 32768 tokens").default(2048),
  gradientAccumulation: z.number().min(1).max(64).default(1),
  warmupSteps: z.number().min(0).max(10000).default(100),
  loraRank: z.number().min(1).max(256).default(16),
  loraAlpha: z.number().min(1).max(512).default(32),
  loraDropout: z.string().regex(/^0(\.\d+)?$|^1(\.0+)?$/, "Dropout must be between 0 and 1").default("0.05"),
  hostId: HostIdSchema,
  gpuCount: z.number().min(1, "Minimum 1 GPU").max(8, "Maximum 8 GPUs").default(1),
});

export type CreateTrainingJob = z.infer<typeof CreateTrainingJobSchema>;

export const UpdateTrainingJobSchema = z.object({
  id: z.number(),
  status: JobStatusSchema.optional(),
  progress: z.number().min(0).max(100).optional(),
  currentEpoch: z.number().optional(),
  currentStep: z.number().optional(),
  totalSteps: z.number().optional(),
  trainLoss: z.string().optional(),
  evalLoss: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type UpdateTrainingJob = z.infer<typeof UpdateTrainingJobSchema>;

// ============================================================================
// Settings Schemas
// ============================================================================

export const SettingsSchema = z.object({
  // SSH Settings
  sshHost: z.string().optional(),
  sshPort: z.number().min(1, "Port must be at least 1").max(65535, "Port must be at most 65535").optional(),
  sshUsername: z.string().optional(),
  sshPassword: z.string().optional(),

  // vLLM Settings
  vllmUrl: z.string().url("Invalid vLLM URL").optional().or(z.literal("")),
  vllmApiKey: z.string().optional(),

  // TURN Settings (WebRTC)
  turnUrl: z.string().optional(),
  turnUsername: z.string().optional(),
  turnCredential: z.string().optional(),

  // Alert Thresholds
  tempWarning: z.number().min(30, "Min 30°C").max(100, "Max 100°C").optional(),
  tempCritical: z.number().min(30, "Min 30°C").max(100, "Max 100°C").optional(),
  powerWarning: z.number().min(10, "Min 10%").max(100, "Max 100%").optional(),
  memoryWarning: z.number().min(10, "Min 10%").max(100, "Max 100%").optional(),
  alertsEnabled: z.boolean().optional(),

  // Splunk Integration
  splunkHost: z.string().optional(),
  splunkPort: z.number().min(1).max(65535).optional(),
  splunkToken: z.string().optional(),
  splunkIndex: z.string().optional(),
  splunkSourceType: z.string().optional(),
  splunkSsl: z.boolean().optional(),
  splunkEnabled: z.boolean().optional(),
  splunkForwardMetrics: z.boolean().optional(),
  splunkForwardAlerts: z.boolean().optional(),
  splunkForwardContainers: z.boolean().optional(),
  splunkForwardInference: z.boolean().optional(),
  splunkInterval: z.number().min(10, "Min 10 seconds").max(300, "Max 300 seconds").optional(),
}).refine(
  (data) => {
    if (data.tempWarning && data.tempCritical) {
      return data.tempCritical > data.tempWarning;
    }
    return true;
  },
  { message: "Critical temperature must be higher than warning temperature", path: ["tempCritical"] }
);

export type Settings = z.infer<typeof SettingsSchema>;

// ============================================================================
// Dataset Schemas
// ============================================================================

export const CreateDatasetSchema = z.object({
  name: z.string().min(1, "Dataset name is required").max(256, "Name too long"),
  description: z.string().optional(),
  type: DatasetTypeSchema.default("instruction"),
  format: DatasetFormatSchema.default("jsonl"),
  path: z.string().min(1, "Dataset path is required"),
  hostId: HostIdSchema.optional(),
});

export type CreateDataset = z.infer<typeof CreateDatasetSchema>;

export const UpdateDatasetSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(256).optional(),
  description: z.string().optional(),
  type: DatasetTypeSchema.optional(),
  status: DatasetStatusSchema.optional(),
});

export type UpdateDataset = z.infer<typeof UpdateDatasetSchema>;

// ============================================================================
// Knowledge Base / RAG Document Schemas
// ============================================================================

export const AddDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(256, "Title too long"),
  content: z.string().min(1, "Content is required").max(100000, "Content too long"),
  category: DocumentCategorySchema.default("user_guide"),
  source: z.string().optional(),
});

export type AddDocument = z.infer<typeof AddDocumentSchema>;

// ============================================================================
// Training Data Generation Schemas
// ============================================================================

export const GenerateTrainingDataSchema = z.object({
  count: z.number().min(1, "Minimum 1 example").max(1000, "Maximum 1000 examples").default(100),
  playbooks: z.array(z.string()).min(1, "Select at least one playbook"),
  includeNegatives: z.boolean().default(false),
  negativeRatio: z.number().min(0).max(1).default(0.2),
});

export type GenerateTrainingData = z.infer<typeof GenerateTrainingDataSchema>;

export const ExportTrainingDataSchema = z.object({
  format: z.enum(["jsonl", "json", "csv"]).default("jsonl"),
  includeMetadata: z.boolean().default(true),
});

export type ExportTrainingData = z.infer<typeof ExportTrainingDataSchema>;

// ============================================================================
// Validation Examples Schema
// ============================================================================

export const ValidateExamplesSchema = z.object({
  examples: z.array(z.object({
    query: z.string().min(1),
    context: z.string().optional(),
    expectedOutput: z.string().optional(),
  })).min(1, "At least one example required"),
});

export type ValidateExamples = z.infer<typeof ValidateExamplesSchema>;

// ============================================================================
// File Upload Schema
// ============================================================================

export const FileUploadSchema = z.object({
  hostId: HostIdSchema,
  destinationPath: z.string().min(1, "Destination path required"),
  fileName: z.string().min(1, "File name required").max(256, "File name too long"),
  content: z.string().min(1, "File content required"), // Base64 encoded
  overwrite: z.boolean().default(false),
}).refine(
  (data) => {
    // Validate base64 content size (roughly 50MB limit after decoding)
    const estimatedSize = (data.content.length * 3) / 4;
    return estimatedSize <= 50 * 1024 * 1024;
  },
  { message: "File size exceeds 50MB limit", path: ["content"] }
);

export type FileUpload = z.infer<typeof FileUploadSchema>;

// ============================================================================
// Training Template Schema
// ============================================================================

export const CreateTrainingTemplateSchema = z.object({
  name: z.string().min(1, "Template name required").max(256),
  description: z.string().optional(),
  baseModel: z.string().min(1, "Base model required"),
  trainingType: TrainingTypeSchema,
  epochs: z.number().min(1).max(100).default(3),
  batchSize: z.number().min(1).max(128).default(4),
  learningRate: z.string().default("2e-5"),
  maxSeqLength: z.number().min(128).max(32768).default(2048),
  gradientAccumulation: z.number().min(1).max(64).default(1),
  warmupSteps: z.number().min(0).max(10000).default(100),
  loraRank: z.number().min(1).max(256).optional(),
  loraAlpha: z.number().min(1).max(512).optional(),
  loraDropout: z.string().optional(),
  gpuCount: z.number().min(1).max(8).default(1),
});

export type CreateTrainingTemplate = z.infer<typeof CreateTrainingTemplateSchema>;

// ============================================================================
// Output/Response Validation Schemas
// ============================================================================

// Generic API response wrapper
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    error: z.string().optional(),
    data: dataSchema.optional(),
  });

// Training Job Response
export const TrainingJobResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  baseModel: z.string(),
  trainingType: TrainingTypeSchema,
  datasetPath: z.string(),
  status: JobStatusSchema,
  progress: z.number().nullable(),
  currentEpoch: z.number().nullable(),
  totalEpochs: z.number().nullable(),
  currentStep: z.number().nullable(),
  totalSteps: z.number().nullable(),
  trainLoss: z.string().nullable(),
  evalLoss: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.date().or(z.string()),
  startedAt: z.date().or(z.string()).nullable(),
  completedAt: z.date().or(z.string()).nullable(),
});

export type TrainingJobResponse = z.infer<typeof TrainingJobResponseSchema>;

export const TrainingJobListResponseSchema = z.object({
  jobs: z.array(TrainingJobResponseSchema),
});

export type TrainingJobListResponse = z.infer<typeof TrainingJobListResponseSchema>;

// Dataset Response
export const DatasetResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  type: DatasetTypeSchema,
  format: DatasetFormatSchema,
  path: z.string(),
  hostId: HostIdSchema.nullable(),
  sizeBytes: z.number().nullable(),
  size: z.string().optional(), // Formatted size string
  sampleCount: z.number().nullable(),
  status: DatasetStatusSchema,
  qualityScore: z.number().nullable(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

export type DatasetResponse = z.infer<typeof DatasetResponseSchema>;

export const DatasetListResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  datasets: z.array(DatasetResponseSchema),
});

export type DatasetListResponse = z.infer<typeof DatasetListResponseSchema>;

// Quality Metrics Response
export const QualityMetricsResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  metrics: z.object({
    totalSamples: z.number(),
    validationRate: z.number(),
    duplicateRate: z.number(),
    avgTokenLength: z.number(),
    typeDistribution: z.record(z.string(), z.number()),
  }).optional(),
});

export type QualityMetricsResponse = z.infer<typeof QualityMetricsResponseSchema>;

// Settings Response
export const SettingsResponseSchema = z.object({
  sshHost: z.string(),
  sshPort: z.number(),
  sshUsername: z.string(),
  vllmUrl: z.string(),
  turnUrl: z.string(),
  turnUsername: z.string(),
  tempWarning: z.number(),
  tempCritical: z.number(),
  powerWarning: z.number(),
  memoryWarning: z.number(),
  alertsEnabled: z.boolean().or(z.number()), // Can be boolean or 0/1
  splunkHost: z.string(),
  splunkPort: z.number(),
  splunkIndex: z.string(),
  splunkSourceType: z.string(),
  splunkSsl: z.boolean(),
  splunkEnabled: z.boolean(),
  splunkForwardMetrics: z.boolean(),
  splunkForwardAlerts: z.boolean(),
  splunkForwardContainers: z.boolean(),
  splunkForwardInference: z.boolean(),
  splunkInterval: z.number(),
});

export type SettingsResponse = z.infer<typeof SettingsResponseSchema>;

// Document Response (RAG)
export const DocumentResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  category: DocumentCategorySchema,
  chunkCount: z.number(),
  createdAt: z.date().or(z.string()),
});

export type DocumentResponse = z.infer<typeof DocumentResponseSchema>;

export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentResponseSchema),
  total: z.number(),
});

export type DocumentListResponse = z.infer<typeof DocumentListResponseSchema>;

// ============================================================================
// Helper for form error formatting
// ============================================================================

export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return errors;
}

export function getFirstError(error: z.ZodError): string {
  return error.issues[0]?.message || "Validation failed";
}
