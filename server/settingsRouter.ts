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
  // Splunk settings
  splunkHost: z.string().optional(),
  splunkPort: z.number().min(1).max(65535).optional(),
  splunkToken: z.string().optional(),
  splunkIndex: z.string().optional(),
  splunkSourceType: z.string().optional(),
  splunkSsl: z.boolean().optional(),
  splunkEnabled: z.boolean().optional(),
  splunkForwardMetrics: z.boolean().optional(),
  splunkForwardAlerts: z.boolean().optional(),
  splunkForwardContainers: z.boolean().optional(),
  splunkForwardInference: z.boolean().optional(),
  splunkInterval: z.number().min(10).max(300).optional(),
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
          // Splunk defaults
          splunkHost: "",
          splunkPort: 8088,
          splunkIndex: "main",
          splunkSourceType: "nemo_command_center",
          splunkSsl: true,
          splunkEnabled: false,
          splunkForwardMetrics: true,
          splunkForwardAlerts: true,
          splunkForwardContainers: false,
          splunkForwardInference: false,
          splunkInterval: 60,
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
          // Splunk defaults
          splunkHost: "",
          splunkPort: 8088,
          splunkIndex: "main",
          splunkSourceType: "nemo_command_center",
          splunkSsl: true,
          splunkEnabled: false,
          splunkForwardMetrics: true,
          splunkForwardAlerts: true,
          splunkForwardContainers: false,
          splunkForwardInference: false,
          splunkInterval: 60,
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
        // Splunk settings
        splunkHost: s.splunkHost || "",
        splunkPort: s.splunkPort || 8088,
        splunkIndex: s.splunkIndex || "main",
        splunkSourceType: s.splunkSourceType || "nemo_command_center",
        splunkSsl: s.splunkSsl ?? true,
        splunkEnabled: s.splunkEnabled ?? false,
        splunkForwardMetrics: s.splunkForwardMetrics ?? true,
        splunkForwardAlerts: s.splunkForwardAlerts ?? true,
        splunkForwardContainers: s.splunkForwardContainers ?? false,
        splunkForwardInference: s.splunkForwardInference ?? false,
        splunkInterval: s.splunkInterval || 60,
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
        // Splunk defaults
        splunkHost: "",
        splunkPort: 8088,
        splunkIndex: "main",
        splunkSourceType: "nemo_command_center",
        splunkSsl: true,
        splunkEnabled: false,
        splunkForwardMetrics: true,
        splunkForwardAlerts: true,
        splunkForwardContainers: false,
        splunkForwardInference: false,
        splunkInterval: 60,
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
          // Splunk settings
          splunkHost: input.splunkHost,
          splunkPort: input.splunkPort,
          splunkToken: input.splunkToken,
          splunkIndex: input.splunkIndex,
          splunkSourceType: input.splunkSourceType,
          splunkSsl: input.splunkSsl ? 1 : 0,
          splunkEnabled: input.splunkEnabled ? 1 : 0,
          splunkForwardMetrics: input.splunkForwardMetrics ? 1 : 0,
          splunkForwardAlerts: input.splunkForwardAlerts ? 1 : 0,
          splunkForwardContainers: input.splunkForwardContainers ? 1 : 0,
          splunkForwardInference: input.splunkForwardInference ? 1 : 0,
          splunkInterval: input.splunkInterval,
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

  // Test Splunk connection
  testSplunkConnection: publicProcedure
    .input(z.object({
      host: z.string(),
      port: z.number(),
      token: z.string(),
      ssl: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      try {
        const protocol = input.ssl ? "https" : "http";
        const url = `${protocol}://${input.host}:${input.port}/services/collector/health`;
        
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Authorization": `Splunk ${input.token}`,
          },
        });
        
        if (response.ok) {
          return { success: true, message: "Connected to Splunk HEC" };
        } else {
          const text = await response.text();
          return { success: false, error: `HTTP ${response.status}: ${text}` };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: message };
      }
    }),

  // Send event to Splunk
  sendToSplunk: publicProcedure
    .input(z.object({
      eventType: z.enum(["metric", "alert", "container", "inference"]),
      data: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          return { success: false, error: "Database not available" };
        }
        
        const settings = await db.select().from(systemSettings).limit(1);
        if (settings.length === 0 || !settings[0].splunkEnabled) {
          return { success: false, error: "Splunk not enabled" };
        }
        
        const s = settings[0];
        if (!s.splunkHost || !s.splunkToken) {
          return { success: false, error: "Splunk not configured" };
        }
        
        // Check if this event type should be forwarded
        const shouldForward = 
          (input.eventType === "metric" && s.splunkForwardMetrics) ||
          (input.eventType === "alert" && s.splunkForwardAlerts) ||
          (input.eventType === "container" && s.splunkForwardContainers) ||
          (input.eventType === "inference" && s.splunkForwardInference);
        
        if (!shouldForward) {
          return { success: false, error: `Event type ${input.eventType} not enabled for forwarding` };
        }
        
        const protocol = s.splunkSsl ? "https" : "http";
        const url = `${protocol}://${s.splunkHost}:${s.splunkPort}/services/collector/event`;
        
        const event = {
          time: Math.floor(Date.now() / 1000),
          host: "nemo-command-center",
          source: "dgx-spark",
          sourcetype: s.splunkSourceType || "nemo_command_center",
          index: s.splunkIndex || "main",
          event: {
            type: input.eventType,
            ...input.data,
          },
        };
        
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Splunk ${s.splunkToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        });
        
        if (response.ok) {
          return { success: true };
        } else {
          const text = await response.text();
          return { success: false, error: `HTTP ${response.status}: ${text}` };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, error: message };
      }
    }),
});
