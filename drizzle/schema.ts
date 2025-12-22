import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Container pull history for tracking NGC container operations
export const containerPullHistory = mysqlTable("container_pull_history", {
  id: int("id").autoincrement().primaryKey(),
  hostId: varchar("hostId", { length: 32 }).notNull(), // 'alpha' or 'beta'
  hostName: varchar("hostName", { length: 128 }).notNull(),
  hostIp: varchar("hostIp", { length: 45 }).notNull(),
  imageTag: varchar("imageTag", { length: 512 }).notNull(),
  action: mysqlEnum("action", ["pull", "update", "remove"]).notNull(),
  status: mysqlEnum("status", ["started", "completed", "failed"]).notNull(),
  userId: int("userId").references(() => users.id),
  userName: varchar("userName", { length: 256 }),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type ContainerPullHistory = typeof containerPullHistory.$inferSelect;
export type InsertContainerPullHistory = typeof containerPullHistory.$inferInsert;

// GPU metrics history for time-series charts
export const gpuMetricsHistory = mysqlTable("gpu_metrics_history", {
  id: int("id").autoincrement().primaryKey(),
  hostId: varchar("hostId", { length: 32 }).notNull(), // 'alpha' or 'beta'
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  gpuUtilization: int("gpuUtilization").notNull(), // 0-100%
  gpuTemperature: int("gpuTemperature").notNull(), // Celsius
  gpuPowerDraw: int("gpuPowerDraw").notNull(), // Watts (stored as integer)
  gpuMemoryUsed: int("gpuMemoryUsed").notNull(), // MB
  gpuMemoryTotal: int("gpuMemoryTotal").notNull(), // MB
  cpuUtilization: int("cpuUtilization"), // 0-100%
  systemMemoryUsed: int("systemMemoryUsed"), // MB
  systemMemoryTotal: int("systemMemoryTotal"), // MB
}, (table) => ({
  // Index for efficient time-series queries by host
  hostTimeIdx: index("idx_host_time").on(table.hostId, table.timestamp),
}));

export type GpuMetricsHistory = typeof gpuMetricsHistory.$inferSelect;
export type InsertGpuMetricsHistory = typeof gpuMetricsHistory.$inferInsert;

// Inference request logs for performance metrics
export const inferenceRequestLogs = mysqlTable("inference_request_logs", {
  id: int("id").autoincrement().primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  model: varchar("model", { length: 256 }).notNull(),
  promptTokens: int("promptTokens").notNull(),
  completionTokens: int("completionTokens").notNull(),
  totalTokens: int("totalTokens").notNull(),
  latencyMs: int("latencyMs").notNull(),
  userId: int("userId").references(() => users.id),
  success: int("success").notNull().default(1), // 1 = success, 0 = failure
}, (table) => ({
  // Index for efficient time-based queries
  timestampIdx: index("idx_timestamp").on(table.timestamp),
}));

export type InferenceRequestLog = typeof inferenceRequestLogs.$inferSelect;
export type InsertInferenceRequestLog = typeof inferenceRequestLogs.$inferInsert;

// System alerts for real-time notifications
export const systemAlerts = mysqlTable("system_alerts", {
  id: int("id").autoincrement().primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  type: mysqlEnum("type", ["success", "info", "warning", "error"]).notNull(),
  message: text("message").notNull(),
  hostId: varchar("hostId", { length: 32 }), // Optional: which host triggered the alert
  dismissed: int("dismissed").notNull().default(0), // 1 = dismissed
});

export type SystemAlert = typeof systemAlerts.$inferSelect;
export type InsertSystemAlert = typeof systemAlerts.$inferInsert;

// System settings for configuration persistence
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  sshHost: varchar("sshHost", { length: 256 }),
  sshPort: int("sshPort"),
  sshUsername: varchar("sshUsername", { length: 128 }),
  sshPassword: varchar("sshPassword", { length: 256 }),
  vllmUrl: varchar("vllmUrl", { length: 512 }),
  vllmApiKey: varchar("vllmApiKey", { length: 256 }),
  turnUrl: varchar("turnUrl", { length: 256 }),
  turnUsername: varchar("turnUsername", { length: 128 }),
  turnCredential: varchar("turnCredential", { length: 256 }),
  tempWarning: int("tempWarning"),
  tempCritical: int("tempCritical"),
  powerWarning: int("powerWarning"),
  memoryWarning: int("memoryWarning"),
  alertsEnabled: int("alertsEnabled").default(1), // 1 = enabled
  // Splunk Enterprise settings
  splunkHost: varchar("splunkHost", { length: 256 }),
  splunkPort: int("splunkPort"),
  splunkToken: varchar("splunkToken", { length: 256 }),
  splunkIndex: varchar("splunkIndex", { length: 128 }),
  splunkSourceType: varchar("splunkSourceType", { length: 128 }),
  splunkSsl: int("splunkSsl").default(1), // 1 = use HTTPS
  splunkEnabled: int("splunkEnabled").default(0), // 0 = disabled
  splunkForwardMetrics: int("splunkForwardMetrics").default(1),
  splunkForwardAlerts: int("splunkForwardAlerts").default(1),
  splunkForwardContainers: int("splunkForwardContainers").default(0),
  splunkForwardInference: int("splunkForwardInference").default(0),
  splunkInterval: int("splunkInterval").default(60), // seconds
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = typeof systemSettings.$inferInsert;

// Custom container presets for Quick Launch template library
export const containerPresets = mysqlTable("container_presets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 64 }).notNull().default("Custom"),
  icon: varchar("icon", { length: 32 }).default("box"), // lucide icon name
  image: varchar("image", { length: 512 }).notNull(), // Docker image tag
  defaultPort: int("defaultPort").notNull().default(8080),
  gpuRequired: int("gpuRequired").notNull().default(0), // 1 = requires GPU
  command: text("command"), // Optional custom command
  envVars: text("envVars"), // JSON string of environment variables
  volumes: text("volumes"), // JSON string of volume mounts
  networkMode: varchar("networkMode", { length: 32 }).default("bridge"),
  restartPolicy: varchar("restartPolicy", { length: 32 }).default("no"),
  isPublic: int("isPublic").notNull().default(0), // 1 = shared with all users
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContainerPreset = typeof containerPresets.$inferSelect;
export type InsertContainerPreset = typeof containerPresets.$inferInsert;

// Training jobs for NeMo fine-tuning management
export const trainingJobs = mysqlTable("training_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  
  // Model configuration
  baseModel: varchar("baseModel", { length: 256 }).notNull(), // e.g., "nemotron-3-nano-30b"
  modelPath: varchar("modelPath", { length: 512 }), // Path to model on DGX
  outputPath: varchar("outputPath", { length: 512 }), // Path for trained model output
  
  // Training configuration
  trainingType: mysqlEnum("trainingType", ["sft", "lora", "qlora", "full"]).notNull().default("lora"),
  datasetPath: varchar("datasetPath", { length: 512 }).notNull(),
  epochs: int("epochs").notNull().default(3),
  batchSize: int("batchSize").notNull().default(4),
  learningRate: varchar("learningRate", { length: 32 }).default("2e-5"),
  maxSeqLength: int("maxSeqLength").default(2048),
  gradientAccumulation: int("gradientAccumulation").default(1),
  warmupSteps: int("warmupSteps").default(100),
  
  // LoRA specific config
  loraRank: int("loraRank").default(16),
  loraAlpha: int("loraAlpha").default(32),
  loraDropout: varchar("loraDropout", { length: 16 }).default("0.05"),
  
  // Resource allocation
  hostId: varchar("hostId", { length: 32 }).notNull(), // 'alpha' or 'beta'
  gpuCount: int("gpuCount").notNull().default(1),
  
  // Job status
  status: mysqlEnum("status", ["queued", "preparing", "running", "completed", "failed", "cancelled"]).notNull().default("queued"),
  progress: int("progress").default(0), // 0-100%
  currentEpoch: int("currentEpoch").default(0),
  currentStep: int("currentStep").default(0),
  totalSteps: int("totalSteps").default(0),
  
  // Metrics
  trainLoss: varchar("trainLoss", { length: 32 }),
  evalLoss: varchar("evalLoss", { length: 32 }),
  
  // Timing
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  estimatedTimeRemaining: int("estimatedTimeRemaining"), // seconds
  
  // Error handling
  errorMessage: text("errorMessage"),
  logPath: varchar("logPath", { length: 512 }),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrainingJob = typeof trainingJobs.$inferSelect;
export type InsertTrainingJob = typeof trainingJobs.$inferInsert;

// Training job templates for reusable configurations
export const trainingTemplates = mysqlTable("training_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  
  // Template metadata
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  isPublic: boolean("isPublic").default(false),
  
  // Training configuration
  baseModel: varchar("baseModel", { length: 256 }).notNull(),
  trainingType: mysqlEnum("trainingType", ["lora", "qlora", "full_sft", "full_finetune"]).notNull(),
  datasetPath: varchar("datasetPath", { length: 512 }),
  
  // Hyperparameters
  epochs: int("epochs").notNull().default(3),
  batchSize: int("batchSize").notNull().default(4),
  learningRate: varchar("learningRate", { length: 32 }).notNull().default("2e-5"),
  warmupSteps: int("warmupSteps").default(100),
  
  // LoRA specific
  loraRank: int("loraRank").default(16),
  loraAlpha: int("loraAlpha").default(32),
  
  // Resource requirements
  gpuCount: int("gpuCount").notNull().default(1),
  preferredHost: varchar("preferredHost", { length: 32 }),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrainingTemplate = typeof trainingTemplates.$inferSelect;
export type InsertTrainingTemplate = typeof trainingTemplates.$inferInsert;


// Datasets for training data management
export const datasets = mysqlTable("datasets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id),
  
  // Dataset metadata
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  
  // Dataset type and format
  type: mysqlEnum("type", ["instruction", "code", "preference", "conversation", "raw"]).notNull().default("instruction"),
  format: mysqlEnum("format", ["jsonl", "parquet", "csv", "json", "txt"]).notNull().default("jsonl"),
  
  // Location
  hostId: varchar("hostId", { length: 32 }).notNull(), // 'alpha' or 'beta'
  path: varchar("path", { length: 512 }).notNull(), // Full path on DGX
  
  // Statistics
  samples: int("samples").default(0),
  sizeBytes: int("sizeBytes").default(0), // File size in bytes
  
  // Quality metrics
  qualityScore: int("qualityScore"), // 0-100
  validationRate: int("validationRate"), // 0-100
  duplicateRate: int("duplicateRate"), // 0-100 (percentage of duplicates)
  avgTokenLength: int("avgTokenLength"),
  
  // Processing status
  status: mysqlEnum("status", ["pending", "scanning", "validated", "processing", "ready", "error"]).notNull().default("pending"),
  errorMessage: text("errorMessage"),
  
  // Timestamps
  lastScannedAt: timestamp("lastScannedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  hostPathIdx: index("idx_dataset_host_path").on(table.hostId, table.path),
}));

export type Dataset = typeof datasets.$inferSelect;
export type InsertDataset = typeof datasets.$inferInsert;

// Training job metrics history for loss curves
export const trainingMetrics = mysqlTable("training_metrics", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").references(() => trainingJobs.id).notNull(),
  
  // Step info
  step: int("step").notNull(),
  epoch: int("epoch").notNull(),
  
  // Metrics
  trainLoss: varchar("trainLoss", { length: 32 }),
  evalLoss: varchar("evalLoss", { length: 32 }),
  learningRate: varchar("learningRate", { length: 32 }),
  gradientNorm: varchar("gradientNorm", { length: 32 }),
  throughput: int("throughput"), // tokens/sec
  
  // Resource usage
  gpuUtilization: int("gpuUtilization"),
  gpuMemoryUsed: int("gpuMemoryUsed"), // MB
  
  // Timestamp
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  jobStepIdx: index("idx_job_step").on(table.jobId, table.step),
}));

export type TrainingMetric = typeof trainingMetrics.$inferSelect;
export type InsertTrainingMetric = typeof trainingMetrics.$inferInsert;
