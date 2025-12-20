import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getInferenceStats, getRecentAlerts, dismissAlert, createSystemAlert } from "./db";

export const statsRouter = router({
  // Get inference performance stats
  getInferenceStats: publicProcedure
    .input(z.object({
      timeRangeHours: z.number().default(24),
    }).optional())
    .query(async ({ input }) => {
      const timeRangeMs = (input?.timeRangeHours || 24) * 60 * 60 * 1000;
      const stats = await getInferenceStats(timeRangeMs);
      
      if (!stats) {
        return {
          totalRequests: 0,
          avgLatency: 0,
          totalTokens: 0,
          successRate: 100,
          hasData: false,
        };
      }
      
      const successRate = stats.totalRequests > 0 
        ? Math.round((stats.successCount / stats.totalRequests) * 100) 
        : 100;
      
      return {
        totalRequests: stats.totalRequests || 0,
        avgLatency: Math.round(stats.avgLatency || 0),
        totalTokens: stats.totalTokens || 0,
        successRate,
        hasData: stats.totalRequests > 0,
      };
    }),

  // Get recent system alerts
  getAlerts: publicProcedure
    .input(z.object({
      limit: z.number().default(10),
    }).optional())
    .query(async ({ input }) => {
      const alerts = await getRecentAlerts(input?.limit || 10);
      
      return alerts.map(alert => ({
        id: alert.id,
        type: alert.type,
        message: alert.message,
        hostId: alert.hostId,
        timestamp: alert.timestamp,
        timeAgo: getTimeAgo(alert.timestamp),
      }));
    }),

  // Dismiss an alert
  dismissAlert: publicProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ input }) => {
      await dismissAlert(input.id);
      return { success: true };
    }),

  // Create a new alert (for testing or manual alerts)
  createAlert: publicProcedure
    .input(z.object({
      type: z.enum(["success", "info", "warning", "error"]),
      message: z.string(),
      hostId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await createSystemAlert({
        type: input.type,
        message: input.message,
        hostId: input.hostId || null,
      });
      return { success: true, id };
    }),
});

// Helper to format time ago
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
