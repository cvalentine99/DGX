import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { trainingJobs } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { TrainingJob } from "../drizzle/schema";

// Training job input schema
const createJobSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().optional(),
  baseModel: z.string().min(1),
  modelPath: z.string().optional(),
  outputPath: z.string().optional(),
  trainingType: z.enum(["sft", "lora", "qlora", "full"]).default("lora"),
  datasetPath: z.string().min(1),
  epochs: z.number().min(1).max(100).default(3),
  batchSize: z.number().min(1).max(128).default(4),
  learningRate: z.string().default("2e-5"),
  maxSeqLength: z.number().min(128).max(32768).default(2048),
  gradientAccumulation: z.number().min(1).max(64).default(1),
  warmupSteps: z.number().min(0).max(10000).default(100),
  loraRank: z.number().min(1).max(256).default(16),
  loraAlpha: z.number().min(1).max(512).default(32),
  loraDropout: z.string().default("0.05"),
  hostId: z.enum(["alpha", "beta"]),
  gpuCount: z.number().min(1).max(8).default(1),
});

const updateJobSchema = z.object({
  id: z.number(),
  status: z.enum(["queued", "preparing", "running", "completed", "failed", "cancelled"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  currentEpoch: z.number().optional(),
  currentStep: z.number().optional(),
  totalSteps: z.number().optional(),
  trainLoss: z.string().optional(),
  evalLoss: z.string().optional(),
  errorMessage: z.string().optional(),
});

export const trainingRouter = router({
  // Get all training jobs
  getJobs: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(50),
      status: z.enum(["queued", "preparing", "running", "completed", "failed", "cancelled"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { jobs: [] };
      
      const jobs = await db.select().from(trainingJobs).orderBy(desc(trainingJobs.createdAt)).limit(input.limit);
      return { jobs };
    }),

  // Get a single job by ID
  getJob: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { job: null };
      
      const [job] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, input.id));
      return { job };
    }),

  // Create a new training job
  createJob: publicProcedure
    .input(createJobSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const userId = ctx.user?.id;
      
      const [result] = await db.insert(trainingJobs).values({
        userId,
        name: input.name,
        description: input.description,
        baseModel: input.baseModel,
        modelPath: input.modelPath,
        outputPath: input.outputPath || `/workspace/outputs/${input.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        trainingType: input.trainingType,
        datasetPath: input.datasetPath,
        epochs: input.epochs,
        batchSize: input.batchSize,
        learningRate: input.learningRate,
        maxSeqLength: input.maxSeqLength,
        gradientAccumulation: input.gradientAccumulation,
        warmupSteps: input.warmupSteps,
        loraRank: input.loraRank,
        loraAlpha: input.loraAlpha,
        loraDropout: input.loraDropout,
        hostId: input.hostId,
        gpuCount: input.gpuCount,
        status: "queued",
        progress: 0,
      });

      return { success: true, id: result.insertId };
    }),

  // Update job status/progress
  updateJob: publicProcedure
    .input(updateJobSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      const updates: Record<string, unknown> = {};
      
      if (input.status !== undefined) updates.status = input.status;
      if (input.progress !== undefined) updates.progress = input.progress;
      if (input.currentEpoch !== undefined) updates.currentEpoch = input.currentEpoch;
      if (input.currentStep !== undefined) updates.currentStep = input.currentStep;
      if (input.totalSteps !== undefined) updates.totalSteps = input.totalSteps;
      if (input.trainLoss !== undefined) updates.trainLoss = input.trainLoss;
      if (input.evalLoss !== undefined) updates.evalLoss = input.evalLoss;
      if (input.errorMessage !== undefined) updates.errorMessage = input.errorMessage;
      
      // Set timestamps based on status
      if (input.status === "running" && !updates.startedAt) {
        updates.startedAt = new Date();
      }
      if (input.status === "completed" || input.status === "failed" || input.status === "cancelled") {
        updates.completedAt = new Date();
      }

      await db.update(trainingJobs).set(updates).where(eq(trainingJobs.id, input.id));
      
      return { success: true };
    }),

  // Start a training job (simulate starting the job)
  startJob: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Update status to preparing
      await db.update(trainingJobs).set({
        status: "preparing",
        startedAt: new Date(),
      }).where(eq(trainingJobs.id, input.id));

      // In a real implementation, this would:
      // 1. SSH to the DGX host
      // 2. Start the NeMo training script
      // 3. Monitor progress via log parsing or API
      
      // For now, simulate by setting to running after a brief delay
      setTimeout(async () => {
        const db = await getDb();
        if (!db) return;
        await db.update(trainingJobs).set({
          status: "running",
          totalSteps: 1000, // Simulated
        }).where(eq(trainingJobs.id, input.id));
      }, 2000);

      return { success: true, message: "Job started" };
    }),

  // Cancel a training job
  cancelJob: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.update(trainingJobs).set({
        status: "cancelled",
        completedAt: new Date(),
      }).where(eq(trainingJobs.id, input.id));

      // In a real implementation, this would also:
      // 1. SSH to the DGX host
      // 2. Kill the training process
      // 3. Clean up any temporary files

      return { success: true, message: "Job cancelled" };
    }),

  // Delete a training job
  deleteJob: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      await db.delete(trainingJobs).where(eq(trainingJobs.id, input.id));
      return { success: true };
    }),

  // Get job statistics
  getStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
    
    const allJobs = await db.select().from(trainingJobs);
    
    const stats = {
      total: allJobs.length,
      queued: allJobs.filter((j: TrainingJob) => j.status === "queued").length,
      running: allJobs.filter((j: TrainingJob) => j.status === "running" || j.status === "preparing").length,
      completed: allJobs.filter((j: TrainingJob) => j.status === "completed").length,
      failed: allJobs.filter((j: TrainingJob) => j.status === "failed").length,
      cancelled: allJobs.filter((j: TrainingJob) => j.status === "cancelled").length,
    };

    return stats;
  }),

  // Get available base models
  getBaseModels: publicProcedure.query(() => {
    return {
      models: [
        { id: "nemotron-3-nano-30b", name: "Nemotron-3-Nano-30B", size: "30B", type: "MoE" },
        { id: "nemotron-3-8b", name: "Nemotron-3-8B", size: "8B", type: "Dense" },
        { id: "llama-3.1-8b", name: "Llama 3.1 8B", size: "8B", type: "Dense" },
        { id: "llama-3.1-70b", name: "Llama 3.1 70B", size: "70B", type: "Dense" },
        { id: "mistral-7b", name: "Mistral 7B", size: "7B", type: "Dense" },
        { id: "mixtral-8x7b", name: "Mixtral 8x7B", size: "47B", type: "MoE" },
      ],
    };
  }),
});
