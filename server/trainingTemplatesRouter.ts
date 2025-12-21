import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { trainingTemplates } from "../drizzle/schema";
import { eq, desc, or, and } from "drizzle-orm";

export const trainingTemplatesRouter = router({
  // Get all templates (public templates)
  getTemplates: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      
      try {
        // Get all templates (for now, show all)
        const templates = await db
          .select()
          .from(trainingTemplates)
          .orderBy(desc(trainingTemplates.createdAt));
        
        return templates;
      } catch (error) {
        console.error("Error fetching templates:", error);
        return [];
      }
    }),

  // Get a single template by ID
  getTemplate: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }: { input: { id: number } }) => {
      const db = await getDb();
      if (!db) return null;
      
      try {
        const [template] = await db
          .select()
          .from(trainingTemplates)
          .where(eq(trainingTemplates.id, input.id))
          .limit(1);
        
        return template || null;
      } catch (error) {
        console.error("Error fetching template:", error);
        return null;
      }
    }),

  // Create a new template
  createTemplate: publicProcedure
    .input(z.object({
      userId: z.number().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
      isPublic: z.boolean().default(false),
      baseModel: z.string(),
      trainingType: z.enum(["lora", "qlora", "full_sft", "full_finetune"]),
      datasetPath: z.string().optional(),
      epochs: z.number().default(3),
      batchSize: z.number().default(4),
      learningRate: z.string().default("2e-5"),
      warmupSteps: z.number().default(100),
      loraRank: z.number().default(16),
      loraAlpha: z.number().default(32),
      gpuCount: z.number().default(1),
      preferredHost: z.string().optional(),
    }))
    .mutation(async ({ input }: { input: { userId?: number; name: string; description?: string; isPublic: boolean; baseModel: string; trainingType: "lora" | "qlora" | "full_sft" | "full_finetune"; datasetPath?: string; epochs: number; batchSize: number; learningRate: string; warmupSteps: number; loraRank: number; loraAlpha: number; gpuCount: number; preferredHost?: string } }) => {
      const db = await getDb();
      if (!db) {
        return { success: false, error: "Database not available" };
      }
      
      try {
        const [result] = await db.insert(trainingTemplates).values({
          name: input.name,
          description: input.description || null,
          isPublic: input.isPublic,
          baseModel: input.baseModel,
          trainingType: input.trainingType,
          datasetPath: input.datasetPath || null,
          epochs: input.epochs,
          batchSize: input.batchSize,
          learningRate: input.learningRate,
          warmupSteps: input.warmupSteps,
          loraRank: input.loraRank,
          loraAlpha: input.loraAlpha,
          gpuCount: input.gpuCount,
          preferredHost: input.preferredHost || null,
        });
        
        return { success: true, id: result.insertId };
      } catch (error: any) {
        console.error("Error creating template:", error);
        return { success: false, error: error.message };
      }
    }),

  // Update a template
  updateTemplate: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      isPublic: z.boolean().optional(),
      baseModel: z.string().optional(),
      trainingType: z.enum(["lora", "qlora", "full_sft", "full_finetune"]).optional(),
      datasetPath: z.string().optional(),
      epochs: z.number().optional(),
      batchSize: z.number().optional(),
      learningRate: z.string().optional(),
      warmupSteps: z.number().optional(),
      loraRank: z.number().optional(),
      loraAlpha: z.number().optional(),
      gpuCount: z.number().optional(),
      preferredHost: z.string().optional(),
    }))
    .mutation(async ({ input }: { input: { id: number; name?: string; description?: string; isPublic?: boolean; baseModel?: string; trainingType?: "lora" | "qlora" | "full_sft" | "full_finetune"; datasetPath?: string; epochs?: number; batchSize?: number; learningRate?: string; warmupSteps?: number; loraRank?: number; loraAlpha?: number; gpuCount?: number; preferredHost?: string } }) => {
      const db = await getDb();
      if (!db) {
        return { success: false, error: "Database not available" };
      }
      
      try {
        const { id, ...updateData } = input;
        await db
          .update(trainingTemplates)
          .set(updateData)
          .where(eq(trainingTemplates.id, id));
        
        return { success: true };
      } catch (error: any) {
        console.error("Error updating template:", error);
        return { success: false, error: error.message };
      }
    }),

  // Delete a template
  deleteTemplate: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }: { input: { id: number } }) => {
      const db = await getDb();
      if (!db) {
        return { success: false, error: "Database not available" };
      }
      
      try {
        await db
          .delete(trainingTemplates)
          .where(eq(trainingTemplates.id, input.id));
        
        return { success: true };
      } catch (error: any) {
        console.error("Error deleting template:", error);
        return { success: false, error: error.message };
      }
    }),


});
