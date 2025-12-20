import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, containerPullHistory, InsertContainerPullHistory } from "../drizzle/schema";
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
