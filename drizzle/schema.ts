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