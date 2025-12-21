import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { systemSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Settings schema for validation
const settingsSchema = z.object({
  sshHost: z.string().optional(),
  sshPort: z.number().min(1).max(65535).optional(),
  sshUsername: z.string().optional(),
  sshPassword: z.string().optional(),
  vllmUrl: z.string().optional(),
  vllmApiKey: z.string().optional(),
  turnUrl: z.string().optional(),
  turnUsername: z.string().optional(),
  turnCredential: z.string().optional(),
  tempWarning: z.number().min(30).max(100).optional(),
  tempCritical: z.number().min(30).max(100).optional(),
  powerWarning: z.number().min(10).max(100).optional(),
  memoryWarning: z.number().min(10).max(100).optional(),
  alertsEnabled: z.boolean().optional(),
});

export const settingsRouter = router({
  // Get current settings
  getSettings: publicProcedure.query(async () => {
    try {
      // Get settings from database
      const db = await getDb();
      if (!db) {
        // Return defaults from environment
        return {
          sshHost: process.env.DGX_SSH_HOST || "",
          sshPort: parseInt(process.env.DGX_SSH_PORT || "22"),
          sshUsername: process.env.DGX_SSH_USERNAME || "",
          vllmUrl: process.env.VLLM_API_URL || "",
          turnUrl: process.env.TURN_SERVER_URL || "",
          turnUsername: process.env.TURN_SERVER_USERNAME || "",
          tempWarning: 65,
          tempCritical: 75,
          powerWarning: 80,
          memoryWarning: 90,
          alertsEnabled: true,
        };
      }
      const settings = await db.select().from(systemSettings).limit(1);
      
      if (settings.length === 0) {
        // Return defaults from environment
        return {
          sshHost: process.env.DGX_SSH_HOST || "",
          sshPort: parseInt(process.env.DGX_SSH_PORT || "22"),
          sshUsername: process.env.DGX_SSH_USERNAME || "",
          vllmUrl: process.env.VLLM_API_URL || "",
          turnUrl: process.env.TURN_SERVER_URL || "",
          turnUsername: process.env.TURN_SERVER_USERNAME || "",
          tempWarning: 65,
          tempCritical: 75,
          powerWarning: 80,
          memoryWarning: 90,
          alertsEnabled: true,
        };
      }
      
      const s = settings[0];
      return {
        sshHost: s.sshHost || process.env.DGX_SSH_HOST || "",
        sshPort: s.sshPort || parseInt(process.env.DGX_SSH_PORT || "22"),
        sshUsername: s.sshUsername || process.env.DGX_SSH_USERNAME || "",
        vllmUrl: s.vllmUrl || process.env.VLLM_API_URL || "",
        turnUrl: s.turnUrl || process.env.TURN_SERVER_URL || "",
        turnUsername: s.turnUsername || process.env.TURN_SERVER_USERNAME || "",
        tempWarning: s.tempWarning || 65,
        tempCritical: s.tempCritical || 75,
        powerWarning: s.powerWarning || 80,
        memoryWarning: s.memoryWarning || 90,
        alertsEnabled: s.alertsEnabled ?? true,
      };
    } catch (error) {
      console.error("[Settings] Error fetching settings:", error);
      // Return defaults on error
      return {
        sshHost: process.env.DGX_SSH_HOST || "",
        sshPort: parseInt(process.env.DGX_SSH_PORT || "22"),
        sshUsername: process.env.DGX_SSH_USERNAME || "",
        vllmUrl: process.env.VLLM_API_URL || "",
        turnUrl: process.env.TURN_SERVER_URL || "",
        turnUsername: process.env.TURN_SERVER_USERNAME || "",
        tempWarning: 65,
        tempCritical: 75,
        powerWarning: 80,
        memoryWarning: 90,
        alertsEnabled: true,
      };
    }
  }),

  // Update settings
  updateSettings: publicProcedure
    .input(settingsSchema)
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }
        // Check if settings exist
        const existing = await db.select().from(systemSettings).limit(1);
        
        const settingsData = {
          sshHost: input.sshHost,
          sshPort: input.sshPort,
          sshUsername: input.sshUsername,
          sshPassword: input.sshPassword,
          vllmUrl: input.vllmUrl,
          vllmApiKey: input.vllmApiKey,
          turnUrl: input.turnUrl,
          turnUsername: input.turnUsername,
          turnCredential: input.turnCredential,
          tempWarning: input.tempWarning,
          tempCritical: input.tempCritical,
          powerWarning: input.powerWarning,
          memoryWarning: input.memoryWarning,
          alertsEnabled: input.alertsEnabled ? 1 : 0,
          updatedAt: new Date(),
        };
        
        if (existing.length === 0) {
          // Insert new settings
          await db.insert(systemSettings).values({
            ...settingsData,
            createdAt: new Date(),
          });
        } else {
          // Update existing settings
          await db.update(systemSettings)
            .set(settingsData)
            .where(eq(systemSettings.id, existing[0].id));
        }
        
        // Update environment variables in memory for immediate effect
        if (input.sshHost) process.env.DGX_SSH_HOST = input.sshHost;
        if (input.sshPort) process.env.DGX_SSH_PORT = input.sshPort.toString();
        if (input.sshUsername) process.env.DGX_SSH_USERNAME = input.sshUsername;
        if (input.sshPassword) process.env.DGX_SSH_PASSWORD = input.sshPassword;
        if (input.vllmUrl) process.env.VLLM_API_URL = input.vllmUrl;
        if (input.vllmApiKey) process.env.VLLM_API_KEY = input.vllmApiKey;
        if (input.turnUrl) process.env.TURN_SERVER_URL = input.turnUrl;
        if (input.turnUsername) process.env.TURN_SERVER_USERNAME = input.turnUsername;
        if (input.turnCredential) process.env.TURN_SERVER_CREDENTIAL = input.turnCredential;
        
        console.log("[Settings] Settings updated successfully");
        return { success: true };
      } catch (error) {
        console.error("[Settings] Error updating settings:", error);
        throw new Error("Failed to update settings");
      }
    }),

  // Reset settings to defaults
  resetSettings: publicProcedure.mutation(async () => {
    try {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      await db.delete(systemSettings);
      console.log("[Settings] Settings reset to defaults");
      return { success: true };
    } catch (error) {
      console.error("[Settings] Error resetting settings:", error);
      throw new Error("Failed to reset settings");
    }
  }),
});
