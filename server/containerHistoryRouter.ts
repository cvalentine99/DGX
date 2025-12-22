import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { 
  recordPullHistory, 
  updatePullHistoryStatus, 
  getPullHistory, 
  getPullHistoryByHost 
} from "./db";
import { DGX_HOSTS, HostId, getHost } from "./hostConfig";

export const containerHistoryRouter = router({
  // Record a new pull/update/remove action
  recordAction: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
      imageTag: z.string(),
      action: z.enum(["pull", "update", "remove"]),
      userName: z.string().optional(),
      userId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const host = getHost(input.hostId as HostId);
      
      // Use context user if available
      const userName = input.userName || ctx.user?.name || "System";
      const userId = input.userId || ctx.user?.id;
      
      const id = await recordPullHistory({
        hostId: input.hostId,
        hostName: host.name,
        hostIp: host.ip,
        imageTag: input.imageTag,
        action: input.action,
        status: "started",
        userName,
        userId,
      });
      
      return { success: true, id };
    }),

  // Update action status (completed/failed)
  updateStatus: publicProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["completed", "failed"]),
      errorMessage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await updatePullHistoryStatus(input.id, input.status, input.errorMessage);
      return { success: true };
    }),

  // Get all pull history
  getHistory: publicProcedure
    .input(z.object({
      limit: z.number().optional().default(50),
    }))
    .query(async ({ input }) => {
      const history = await getPullHistory(input.limit);
      return { history };
    }),

  // Get pull history for a specific host
  getHistoryByHost: publicProcedure
    .input(z.object({
      hostId: z.enum(["alpha", "beta"]),
      limit: z.number().optional().default(20),
    }))
    .query(async ({ input }) => {
      const history = await getPullHistoryByHost(input.hostId, input.limit);
      return { history };
    }),
});
