import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
});

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
});

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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = typeof systemSettings.$inferInsert;
