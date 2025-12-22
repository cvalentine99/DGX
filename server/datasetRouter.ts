/**
 * Dataset Router - CRUD operations for training datasets
 * 
 * Provides API for managing datasets stored on DGX hosts,
 * including file system scanning, validation, and quality metrics.
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { datasets, type Dataset } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { executeOnHost, type HostId } from "./hostConfig";

// Dataset type enum
const DatasetType = z.enum(["instruction", "code", "preference", "conversation", "raw"]);
const DatasetFormat = z.enum(["jsonl", "parquet", "csv", "json", "txt"]);
const DatasetStatus = z.enum(["pending", "scanning", "validated", "processing", "ready", "error"]);

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function detectDatasetType(name: string): "instruction" | "code" | "preference" | "conversation" | "raw" {
  const lower = name.toLowerCase();
  if (lower.includes("code") || lower.includes("alpaca")) return "code";
  if (lower.includes("preference") || lower.includes("dpo")) return "preference";
  if (lower.includes("chat") || lower.includes("conversation")) return "conversation";
  if (lower.includes("instruct") || lower.includes("sft")) return "instruction";
  return "raw";
}

export const datasetRouter = router({
  // List all datasets
  list: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]).optional(),
      type: DatasetType.optional(),
      status: DatasetStatus.optional(),
    }).optional())
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          return { success: false, error: "Database not available", datasets: [] };
        }
        
        const results = await db.select().from(datasets).orderBy(desc(datasets.updatedAt));
        
        // Filter in memory if needed
        let filtered: Dataset[] = results;
        if (input?.hostId) {
          filtered = filtered.filter((d: Dataset) => d.hostId === input.hostId);
        }
        if (input?.type) {
          filtered = filtered.filter((d: Dataset) => d.type === input.type);
        }
        if (input?.status) {
          filtered = filtered.filter((d: Dataset) => d.status === input.status);
        }
        
        return {
          success: true,
          datasets: filtered.map((d: Dataset) => ({
            ...d,
            size: formatBytes(d.sizeBytes || 0),
          })),
        };
      } catch (error) {
        console.error("[Dataset] List error:", error);
        return { success: false, error: String(error), datasets: [] };
      }
    }),

  // Get single dataset by ID
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          return { success: false, error: "Database not available" };
        }
        
        const [dataset] = await db.select().from(datasets).where(eq(datasets.id, input.id));
        if (!dataset) {
          return { success: false, error: "Dataset not found" };
        }
        return {
          success: true,
          dataset: {
            ...dataset,
            size: formatBytes(dataset.sizeBytes || 0),
          },
        };
      } catch (error) {
        console.error("[Dataset] Get error:", error);
        return { success: false, error: String(error) };
      }
    }),

  // Create new dataset entry
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(256),
      description: z.string().optional(),
      type: DatasetType,
      format: DatasetFormat,
      hostId: z.enum(["alpha", "beta"]),
      path: z.string().min(1).max(512),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          return { success: false, error: "Database not available" };
        }
        
        const [result] = await db.insert(datasets).values({
          userId: ctx.user?.id,
          name: input.name,
          description: input.description,
          type: input.type,
          format: input.format,
          hostId: input.hostId,
          path: input.path,
          status: "pending",
        });
        
        return { success: true, id: result.insertId };
      } catch (error) {
        console.error("[Dataset] Create error:", error);
        return { success: false, error: String(error) };
      }
    }),

  // Update dataset
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(256).optional(),
      description: z.string().optional(),
      type: DatasetType.optional(),
      status: DatasetStatus.optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          return { success: false, error: "Database not available" };
        }
        
        const { id, ...updates } = input;
        await db.update(datasets).set(updates).where(eq(datasets.id, id));
        return { success: true };
      } catch (error) {
        console.error("[Dataset] Update error:", error);
        return { success: false, error: String(error) };
      }
    }),

  // Delete dataset
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          return { success: false, error: "Database not available" };
        }
        
        await db.delete(datasets).where(eq(datasets.id, input.id));
        return { success: true };
      } catch (error) {
        console.error("[Dataset] Delete error:", error);
        return { success: false, error: String(error) };
      }
    }),

  // Scan file system for datasets
  scan: protectedProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
      directory: z.string().default("/data"),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          return { success: false, error: "Database not available" };
        }
        
        const { hostId, directory } = input;
        
        // Find dataset files on the host
        const findCmd = `find ${directory} -type f \\( -name "*.jsonl" -o -name "*.parquet" -o -name "*.csv" -o -name "*.json" \\) 2>/dev/null | head -100`;
        const output = await executeOnHost(hostId as HostId, findCmd);
        
        const files = output.trim().split("\n").filter((f: string) => f.length > 0);
        const scannedDatasets: Array<{
          name: string;
          path: string;
          format: string;
          size: number;
          samples: number;
        }> = [];
        
        for (const filePath of files) {
          // Get file info
          const statCmd = `stat -c '%s' "${filePath}" 2>/dev/null || echo "0"`;
          const sizeStr = await executeOnHost(hostId as HostId, statCmd);
          const size = parseInt(sizeStr.trim()) || 0;
          
          // Detect format
          const ext = filePath.split(".").pop()?.toLowerCase() || "txt";
          const format = ext === "jsonl" ? "jsonl" : ext === "parquet" ? "parquet" : ext === "csv" ? "csv" : ext === "json" ? "json" : "txt";
          
          // Count samples (lines for jsonl/csv, estimate for others)
          let samples = 0;
          if (format === "jsonl" || format === "csv") {
            const wcCmd = `wc -l < "${filePath}" 2>/dev/null || echo "0"`;
            const wcOutput = await executeOnHost(hostId as HostId, wcCmd);
            samples = parseInt(wcOutput.trim()) || 0;
          } else {
            samples = Math.floor(size / 500);
          }
          
          const name = filePath.split("/").pop()?.replace(/\.[^/.]+$/, "") || "Unknown";
          
          scannedDatasets.push({ name, path: filePath, format, size, samples });
        }
        
        // Insert or update datasets in database
        let created = 0;
        let updated = 0;
        
        for (const ds of scannedDatasets) {
          const [existing] = await db.select().from(datasets)
            .where(and(eq(datasets.hostId, hostId), eq(datasets.path, ds.path)));
          
          if (existing) {
            await db.update(datasets).set({
              sizeBytes: ds.size,
              samples: ds.samples,
              lastScannedAt: new Date(),
              status: "validated",
            }).where(eq(datasets.id, existing.id));
            updated++;
          } else {
            await db.insert(datasets).values({
              userId: ctx.user?.id,
              name: ds.name,
              type: detectDatasetType(ds.name),
              format: ds.format as "jsonl" | "parquet" | "csv" | "json" | "txt",
              hostId,
              path: ds.path,
              sizeBytes: ds.size,
              samples: ds.samples,
              status: "validated",
              lastScannedAt: new Date(),
            });
            created++;
          }
        }
        
        return { success: true, scanned: scannedDatasets.length, created, updated };
      } catch (error) {
        console.error("[Dataset] Scan error:", error);
        return { success: false, error: String(error) };
      }
    }),

  // Validate dataset quality
  validate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        return { success: false, error: "Database not available" };
      }
      
      try {
        const [dataset] = await db.select().from(datasets).where(eq(datasets.id, input.id));
        if (!dataset) {
          return { success: false, error: "Dataset not found" };
        }
        
        await db.update(datasets).set({ status: "scanning" }).where(eq(datasets.id, input.id));
        
        const hostId = dataset.hostId as HostId;
        let qualityScore = 100;
        let validationRate = 100;
        let duplicateRate = 0;
        let avgTokenLength = 0;
        
        if (dataset.format === "jsonl") {
          const checkCmd = `head -100 "${dataset.path}" | while read line; do echo "$line" | jq -e . > /dev/null 2>&1 || echo "invalid"; done | grep -c "invalid" || echo "0"`;
          const invalidCount = parseInt(await executeOnHost(hostId, checkCmd)) || 0;
          validationRate = Math.max(0, 100 - invalidCount);
          
          const sampleCmd = `head -10 "${dataset.path}" | jq -r '.text // .content // .instruction // ""' 2>/dev/null | wc -c`;
          const totalChars = parseInt(await executeOnHost(hostId, sampleCmd)) || 0;
          avgTokenLength = Math.floor(totalChars / 10 / 4);
          
          const dupCmd = `head -1000 "${dataset.path}" | md5sum | cut -d' ' -f1 | sort | uniq -d | wc -l`;
          const dupCount = parseInt(await executeOnHost(hostId, dupCmd)) || 0;
          duplicateRate = Math.min(100, Math.floor(dupCount / 10));
        }
        
        qualityScore = Math.floor((validationRate * 0.5) + ((100 - duplicateRate) * 0.3) + (avgTokenLength > 100 ? 20 : avgTokenLength / 5));
        
        await db.update(datasets).set({
          qualityScore,
          validationRate,
          duplicateRate,
          avgTokenLength,
          status: "validated",
          lastScannedAt: new Date(),
        }).where(eq(datasets.id, input.id));
        
        return { success: true, qualityScore, validationRate, duplicateRate, avgTokenLength };
      } catch (error) {
        console.error("[Dataset] Validate error:", error);
        await db.update(datasets).set({
          status: "error",
          errorMessage: String(error),
        }).where(eq(datasets.id, input.id));
        return { success: false, error: String(error) };
      }
    }),

  // Get aggregate quality metrics
  getQualityMetrics: publicProcedure
    .query(async () => {
      try {
        const db = await getDb();
        if (!db) {
          return { success: false, error: "Database not available" };
        }
        
        const allDatasets = await db.select().from(datasets);
        
        const totalSamples = allDatasets.reduce((sum: number, d: Dataset) => sum + (d.samples || 0), 0);
        const validatedDatasets = allDatasets.filter((d: Dataset) => d.status === "validated" || d.status === "ready");
        const avgValidationRate = validatedDatasets.length > 0
          ? validatedDatasets.reduce((sum: number, d: Dataset) => sum + (d.validationRate || 0), 0) / validatedDatasets.length
          : 0;
        const avgDuplicateRate = validatedDatasets.length > 0
          ? validatedDatasets.reduce((sum: number, d: Dataset) => sum + (d.duplicateRate || 0), 0) / validatedDatasets.length
          : 0;
        const avgTokenLength = validatedDatasets.length > 0
          ? validatedDatasets.reduce((sum: number, d: Dataset) => sum + (d.avgTokenLength || 0), 0) / validatedDatasets.length
          : 0;
        
        const typeDistribution = allDatasets.reduce((acc: Record<string, number>, d: Dataset) => {
          acc[d.type] = (acc[d.type] || 0) + (d.samples || 0);
          return acc;
        }, {} as Record<string, number>);
        
        return {
          success: true,
          metrics: {
            totalSamples,
            totalDatasets: allDatasets.length,
            validatedDatasets: validatedDatasets.length,
            validationRate: Math.round(avgValidationRate * 10) / 10,
            duplicateRate: Math.round(avgDuplicateRate * 10) / 10,
            avgTokenLength: Math.round(avgTokenLength),
            typeDistribution,
          },
        };
      } catch (error) {
        console.error("[Dataset] GetQualityMetrics error:", error);
        return { success: false, error: String(error) };
      }
    }),
});
