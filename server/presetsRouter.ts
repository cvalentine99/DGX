import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { containerPresets, ContainerPreset } from "../drizzle/schema";
import { eq, and, or, desc } from "drizzle-orm";

export const presetsRouter = router({
  // Get all presets (user's own + public presets)
  getPresets: publicProcedure
    .input(z.object({
      userId: z.number().optional(),
      category: z.string().optional(),
      includePublic: z.boolean().optional().default(true),
    }))
    .query(async ({ input }) => {
      try {
        let conditions = [];
        
        if (input.userId) {
          conditions.push(eq(containerPresets.userId, input.userId));
        }
        
        if (input.includePublic) {
          conditions.push(eq(containerPresets.isPublic, 1));
        }
        
        const db = await getDb();
        const presets = await db!
          .select()
          .from(containerPresets)
          .where(conditions.length > 0 ? or(...conditions) : undefined)
          .orderBy(desc(containerPresets.createdAt));
        
        // Filter by category if specified
        const filteredPresets = input.category 
          ? presets.filter(p => p.category === input.category)
          : presets;
        
        return {
          success: true,
          presets: filteredPresets.map((p: ContainerPreset) => ({
            ...p,
            envVars: p.envVars ? JSON.parse(p.envVars) : {},
            volumes: p.volumes ? JSON.parse(p.volumes) : [],
            gpuRequired: p.gpuRequired === 1,
            isPublic: p.isPublic === 1,
          })),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          presets: [],
        };
      }
    }),

  // Get a single preset by ID
  getPreset: publicProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        const [preset] = await db!
          .select()
          .from(containerPresets)
          .where(eq(containerPresets.id, input.id))
          .limit(1);
        
        if (!preset) {
          return {
            success: false,
            error: "Preset not found",
            preset: null,
          };
        }
        
        return {
          success: true,
          preset: {
            ...preset,
            envVars: preset.envVars ? JSON.parse(preset.envVars) : {},
            volumes: preset.volumes ? JSON.parse(preset.volumes) : [],
            gpuRequired: preset.gpuRequired === 1,
            isPublic: preset.isPublic === 1,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          preset: null,
        };
      }
    }),

  // Create a new preset
  createPreset: publicProcedure
    .input(z.object({
      userId: z.number().optional(),
      name: z.string().min(1).max(128),
      description: z.string().optional(),
      category: z.string().default("Custom"),
      icon: z.string().default("box"),
      image: z.string().min(1),
      defaultPort: z.number().default(8080),
      gpuRequired: z.boolean().default(false),
      command: z.string().optional(),
      envVars: z.record(z.string(), z.string()).optional(),
      volumes: z.array(z.string()).optional(),
      networkMode: z.string().default("bridge"),
      restartPolicy: z.string().default("no"),
      isPublic: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        const [newPreset] = await db!
          .insert(containerPresets)
          .values({
            userId: input.userId || null,
            name: input.name,
            description: input.description || null,
            category: input.category,
            icon: input.icon,
            image: input.image,
            defaultPort: input.defaultPort,
            gpuRequired: input.gpuRequired ? 1 : 0,
            command: input.command || null,
            envVars: input.envVars ? JSON.stringify(input.envVars) : null,
            volumes: input.volumes ? JSON.stringify(input.volumes) : null,
            networkMode: input.networkMode,
            restartPolicy: input.restartPolicy,
            isPublic: input.isPublic ? 1 : 0,
          })
          .$returningId();
        
        return {
          success: true,
          presetId: newPreset.id,
          message: "Preset created successfully",
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          presetId: null,
        };
      }
    }),

  // Update an existing preset
  updatePreset: publicProcedure
    .input(z.object({
      id: z.number(),
      userId: z.number().optional(), // For authorization check
      name: z.string().min(1).max(128).optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      icon: z.string().optional(),
      image: z.string().optional(),
      defaultPort: z.number().optional(),
      gpuRequired: z.boolean().optional(),
      command: z.string().optional(),
      envVars: z.record(z.string(), z.string()).optional(),
      volumes: z.array(z.string()).optional(),
      networkMode: z.string().optional(),
      restartPolicy: z.string().optional(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        // Build update object with only provided fields
        const updateData: any = {};
        
        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.icon !== undefined) updateData.icon = input.icon;
        if (input.image !== undefined) updateData.image = input.image;
        if (input.defaultPort !== undefined) updateData.defaultPort = input.defaultPort;
        if (input.gpuRequired !== undefined) updateData.gpuRequired = input.gpuRequired ? 1 : 0;
        if (input.command !== undefined) updateData.command = input.command;
        if (input.envVars !== undefined) updateData.envVars = JSON.stringify(input.envVars);
        if (input.volumes !== undefined) updateData.volumes = JSON.stringify(input.volumes);
        if (input.networkMode !== undefined) updateData.networkMode = input.networkMode;
        if (input.restartPolicy !== undefined) updateData.restartPolicy = input.restartPolicy;
        if (input.isPublic !== undefined) updateData.isPublic = input.isPublic ? 1 : 0;
        
        const db = await getDb();
        await db!
          .update(containerPresets)
          .set(updateData)
          .where(eq(containerPresets.id, input.id));
        
        return {
          success: true,
          message: "Preset updated successfully",
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    }),

  // Delete a preset
  deletePreset: publicProcedure
    .input(z.object({
      id: z.number(),
      userId: z.number().optional(), // For authorization check
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        await db!
          .delete(containerPresets)
          .where(eq(containerPresets.id, input.id));
        
        return {
          success: true,
          message: "Preset deleted successfully",
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    }),

  // Export presets as JSON
  exportPresets: publicProcedure
    .input(z.object({
      userId: z.number().optional(),
      presetIds: z.array(z.number()).optional(), // Export specific presets or all
    }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        let query = db!.select().from(containerPresets);
        
        if (input.presetIds && input.presetIds.length > 0) {
          // Export specific presets
          const presets = await query;
          const filtered = presets.filter((p: ContainerPreset) => input.presetIds!.includes(p.id));
          
          return {
            success: true,
            exportData: JSON.stringify({
              version: "1.0",
              exportedAt: new Date().toISOString(),
              presets: filtered.map((p: ContainerPreset) => ({
                name: p.name,
                description: p.description,
                category: p.category,
                icon: p.icon,
                image: p.image,
                defaultPort: p.defaultPort,
                gpuRequired: p.gpuRequired === 1,
                command: p.command,
                envVars: p.envVars ? JSON.parse(p.envVars) : {},
                volumes: p.volumes ? JSON.parse(p.volumes) : [],
                networkMode: p.networkMode,
                restartPolicy: p.restartPolicy,
              })),
            }, null, 2),
          };
        } else if (input.userId) {
          // Export all user's presets
          const presets = await query.where(eq(containerPresets.userId, input.userId));
          
          return {
            success: true,
            exportData: JSON.stringify({
              version: "1.0",
              exportedAt: new Date().toISOString(),
              presets: presets.map((p: ContainerPreset) => ({
                name: p.name,
                description: p.description,
                category: p.category,
                icon: p.icon,
                image: p.image,
                defaultPort: p.defaultPort,
                gpuRequired: p.gpuRequired === 1,
                command: p.command,
                envVars: p.envVars ? JSON.parse(p.envVars) : {},
                volumes: p.volumes ? JSON.parse(p.volumes) : [],
                networkMode: p.networkMode,
                restartPolicy: p.restartPolicy,
              })),
            }, null, 2),
          };
        }
        
        return {
          success: false,
          error: "No presets specified for export",
          exportData: null,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          exportData: null,
        };
      }
    }),

  // Import presets from JSON
  importPresets: publicProcedure
    .input(z.object({
      userId: z.number().optional(),
      jsonData: z.string(),
      overwriteExisting: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      try {
        const data = JSON.parse(input.jsonData);
        
        if (!data.presets || !Array.isArray(data.presets)) {
          return {
            success: false,
            error: "Invalid import format: missing presets array",
            imported: 0,
          };
        }
        
        let imported = 0;
        const db = await getDb();
        
        for (const preset of data.presets) {
          await db!.insert(containerPresets).values({
            userId: input.userId || null,
            name: preset.name,
            description: preset.description || null,
            category: preset.category || "Imported",
            icon: preset.icon || "box",
            image: preset.image,
            defaultPort: preset.defaultPort || 8080,
            gpuRequired: preset.gpuRequired ? 1 : 0,
            command: preset.command || null,
            envVars: preset.envVars ? JSON.stringify(preset.envVars) : null,
            volumes: preset.volumes ? JSON.stringify(preset.volumes) : null,
            networkMode: preset.networkMode || "bridge",
            restartPolicy: preset.restartPolicy || "no",
            isPublic: 0,
          });
          imported++;
        }
        
        return {
          success: true,
          message: `Successfully imported ${imported} presets`,
          imported,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          imported: 0,
        };
      }
    }),

  // Get available categories
  getCategories: publicProcedure.query(async () => {
    try {
      const db = await getDb();
      const presets = await db!.select({ category: containerPresets.category }).from(containerPresets);
      const categorySet = new Set<string>();
      presets.forEach((p: { category: string }) => {
        if (p.category) categorySet.add(p.category);
      });
      
      // Add default categories
      const defaultCategories = ["Development", "Monitoring", "Training", "Inference", "Custom"];
      defaultCategories.forEach(c => categorySet.add(c));
      const allCategories = Array.from(categorySet);
      
      return {
        success: true,
        categories: allCategories,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        categories: ["Development", "Monitoring", "Training", "Inference", "Custom"],
      };
    }
  }),

  // Duplicate a preset
  duplicatePreset: publicProcedure
    .input(z.object({
      id: z.number(),
      userId: z.number().optional(),
      newName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        // Get the original preset
        const db = await getDb();
        const [original] = await db!
          .select()
          .from(containerPresets)
          .where(eq(containerPresets.id, input.id))
          .limit(1);
        
        if (!original) {
          return {
            success: false,
            error: "Original preset not found",
            presetId: null,
          };
        }
        
        // Create a copy
        const [newPreset] = await db!
          .insert(containerPresets)
          .values({
            userId: input.userId || original.userId,
            name: input.newName || `${original.name} (Copy)`,
            description: original.description,
            category: original.category,
            icon: original.icon,
            image: original.image,
            defaultPort: original.defaultPort,
            gpuRequired: original.gpuRequired,
            command: original.command,
            envVars: original.envVars,
            volumes: original.volumes,
            networkMode: original.networkMode,
            restartPolicy: original.restartPolicy,
            isPublic: 0, // Copies are private by default
          })
          .$returningId();
        
        return {
          success: true,
          presetId: newPreset.id,
          message: "Preset duplicated successfully",
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          presetId: null,
        };
      }
    }),
});
