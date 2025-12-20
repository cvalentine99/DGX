import { eq, desc, gte, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, containerPullHistory, InsertContainerPullHistory, gpuMetricsHistory, InsertGpuMetricsHistory, inferenceRequestLogs, InsertInferenceRequestLog, systemAlerts, InsertSystemAlert } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Container pull history queries
export async function recordPullHistory(entry: InsertContainerPullHistory) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot record pull history: database not available");
    return null;
  }

  try {
    const result = await db.insert(containerPullHistory).values(entry);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to record pull history:", error);
    return null;
  }
}

export async function updatePullHistoryStatus(
  id: number,
  status: "completed" | "failed",
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update pull history: database not available");
    return;
  }

  try {
    await db
      .update(containerPullHistory)
      .set({
        status,
        errorMessage: errorMessage || null,
        completedAt: new Date(),
      })
      .where(eq(containerPullHistory.id, id));
  } catch (error) {
    console.error("[Database] Failed to update pull history:", error);
  }
}

export async function getPullHistory(limit: number = 50) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get pull history: database not available");
    return [];
  }

  try {
    const result = await db
      .select()
      .from(containerPullHistory)
      .orderBy(desc(containerPullHistory.startedAt))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get pull history:", error);
    return [];
  }
}

export async function getPullHistoryByHost(hostId: string, limit: number = 20) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get pull history: database not available");
    return [];
  }

  try {
    const result = await db
      .select()
      .from(containerPullHistory)
      .where(eq(containerPullHistory.hostId, hostId))
      .orderBy(desc(containerPullHistory.startedAt))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get pull history by host:", error);
    return [];
  }
}

// GPU Metrics History
export async function recordGpuMetrics(entry: InsertGpuMetricsHistory) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(gpuMetricsHistory).values(entry);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to record GPU metrics:", error);
    return null;
  }
}

export async function getGpuMetricsHistory(hostId: string, timeRangeMs: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    const cutoff = new Date(Date.now() - timeRangeMs);
    const result = await db
      .select()
      .from(gpuMetricsHistory)
      .where(and(
        eq(gpuMetricsHistory.hostId, hostId),
        gte(gpuMetricsHistory.timestamp, cutoff)
      ))
      .orderBy(gpuMetricsHistory.timestamp);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get GPU metrics history:", error);
    return [];
  }
}

// Cleanup old metrics (keep last 24 hours)
export async function cleanupOldGpuMetrics() {
  const db = await getDb();
  if (!db) return;

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.delete(gpuMetricsHistory).where(
      sql`${gpuMetricsHistory.timestamp} < ${cutoff}`
    );
  } catch (error) {
    console.error("[Database] Failed to cleanup old GPU metrics:", error);
  }
}

// Inference Request Logs
export async function recordInferenceRequest(entry: InsertInferenceRequestLog) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(inferenceRequestLogs).values(entry);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to record inference request:", error);
    return null;
  }
}

export async function getInferenceStats(timeRangeMs: number = 24 * 60 * 60 * 1000) {
  const db = await getDb();
  if (!db) return null;

  try {
    const cutoff = new Date(Date.now() - timeRangeMs);
    const result = await db
      .select({
        totalRequests: sql<number>`COUNT(*)`,
        avgLatency: sql<number>`AVG(${inferenceRequestLogs.latencyMs})`,
        totalTokens: sql<number>`SUM(${inferenceRequestLogs.totalTokens})`,
        successCount: sql<number>`SUM(${inferenceRequestLogs.success})`,
      })
      .from(inferenceRequestLogs)
      .where(gte(inferenceRequestLogs.timestamp, cutoff));
    return result[0];
  } catch (error) {
    console.error("[Database] Failed to get inference stats:", error);
    return null;
  }
}

export async function getRecentInferenceRequests(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(inferenceRequestLogs)
      .orderBy(desc(inferenceRequestLogs.timestamp))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get recent inference requests:", error);
    return [];
  }
}

// System Alerts
export async function createSystemAlert(entry: InsertSystemAlert) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(systemAlerts).values(entry);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create system alert:", error);
    return null;
  }
}

export async function getRecentAlerts(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(systemAlerts)
      .where(eq(systemAlerts.dismissed, 0))
      .orderBy(desc(systemAlerts.timestamp))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get recent alerts:", error);
    return [];
  }
}

export async function dismissAlert(id: number) {
  const db = await getDb();
  if (!db) return;

  try {
    await db
      .update(systemAlerts)
      .set({ dismissed: 1 })
      .where(eq(systemAlerts.id, id));
  } catch (error) {
    console.error("[Database] Failed to dismiss alert:", error);
  }
}
