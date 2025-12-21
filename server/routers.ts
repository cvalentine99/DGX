import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { trainingDataRouter } from "./trainingDataRouter";
import { ragRouter } from "./ragRouter";
import { vllmRouter } from "./vllmRouter";
import { sshRouter } from "./sshRouter";
import { dcgmRouter } from "./dcgmRouter";
import { containerHistoryRouter } from "./containerHistoryRouter";
import { statsRouter } from "./statsRouter";
import { webrtcRouter } from "./webrtcRouter";
import { settingsRouter } from "./settingsRouter";
import { presetsRouter } from "./presetsRouter";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Training data generation for LLM fine-tuning
  trainingData: trainingDataRouter,

  // RAG system for document retrieval
  rag: ragRouter,

  // vLLM inference integration
  vllm: vllmRouter,

  // SSH integration for DGX Spark hosts
  ssh: sshRouter,

  // DCGM real-time GPU metrics
  dcgm: dcgmRouter,

  // Container pull history tracking
  containerHistory: containerHistoryRouter,

  // Performance stats and system alerts
  stats: statsRouter,

  // WebRTC streaming for camera preview
  webrtc: webrtcRouter,

  // Settings management
  settings: settingsRouter,

  // Container preset templates
  presets: presetsRouter,
});

export type AppRouter = typeof appRouter;
