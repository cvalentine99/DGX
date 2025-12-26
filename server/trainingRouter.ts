import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { trainingJobs } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { TrainingJob } from "../drizzle/schema";
import { executeOnHost, executeOnHostFull, type HostId } from "./hostConfig";
import { CreateTrainingJobSchema, UpdateTrainingJobSchema, JobStatusSchema } from "../shared/schemas";

// NeMo training script generator
function generateNeMoTrainingScript(job: TrainingJob): string {
  const outputDir = job.outputPath || `/workspace/outputs/${job.name.toLowerCase().replace(/\s+/g, '-')}`;
  const logFile = `${outputDir}/training.log`;

  // Base NeMo training command for different training types
  let trainCommand = "";

  switch (job.trainingType) {
    case "lora":
    case "qlora":
      trainCommand = `
python -m nemo.collections.llm.recipes.finetune \\
  --model-path="${job.modelPath || `/models/${job.baseModel}`}" \\
  --data-path="${job.datasetPath}" \\
  --output-dir="${outputDir}" \\
  --num-epochs=${job.epochs || 3} \\
  --batch-size=${job.batchSize || 4} \\
  --learning-rate=${job.learningRate || "2e-5"} \\
  --max-seq-length=${job.maxSeqLength || 2048} \\
  --gradient-accumulation-steps=${job.gradientAccumulation || 1} \\
  --warmup-steps=${job.warmupSteps || 100} \\
  --peft-method="${job.trainingType}" \\
  --lora-rank=${job.loraRank || 16} \\
  --lora-alpha=${job.loraAlpha || 32} \\
  --lora-dropout=${job.loraDropout || "0.05"} \\
  --num-gpus=${job.gpuCount || 1}`;
      break;
    case "sft":
      trainCommand = `
python -m nemo.collections.llm.recipes.sft \\
  --model-path="${job.modelPath || `/models/${job.baseModel}`}" \\
  --data-path="${job.datasetPath}" \\
  --output-dir="${outputDir}" \\
  --num-epochs=${job.epochs || 3} \\
  --batch-size=${job.batchSize || 4} \\
  --learning-rate=${job.learningRate || "2e-5"} \\
  --max-seq-length=${job.maxSeqLength || 2048} \\
  --gradient-accumulation-steps=${job.gradientAccumulation || 1} \\
  --warmup-steps=${job.warmupSteps || 100} \\
  --num-gpus=${job.gpuCount || 1}`;
      break;
    case "full":
      trainCommand = `
python -m nemo.collections.llm.recipes.full_finetune \\
  --model-path="${job.modelPath || `/models/${job.baseModel}`}" \\
  --data-path="${job.datasetPath}" \\
  --output-dir="${outputDir}" \\
  --num-epochs=${job.epochs || 3} \\
  --batch-size=${job.batchSize || 4} \\
  --learning-rate=${job.learningRate || "2e-5"} \\
  --max-seq-length=${job.maxSeqLength || 2048} \\
  --gradient-accumulation-steps=${job.gradientAccumulation || 1} \\
  --warmup-steps=${job.warmupSteps || 100} \\
  --num-gpus=${job.gpuCount || 1}`;
      break;
    default:
      trainCommand = `echo "Unknown training type: ${job.trainingType}"`;
  }

  // Wrap in nohup with logging and PID tracking
  return `
mkdir -p "${outputDir}" && \\
echo "${job.id}" > "${outputDir}/.job_id" && \\
nohup bash -c '${trainCommand.replace(/'/g, "'\\''")}' > "${logFile}" 2>&1 &
echo $! > "${outputDir}/.pid"
echo "Training started with PID: $(cat ${outputDir}/.pid)"
`;
}

// Parse training progress from log file
function parseTrainingProgress(logContent: string): {
  progress: number;
  currentStep: number;
  totalSteps: number;
  currentEpoch: number;
  trainLoss: string | null;
  evalLoss: string | null;
} {
  const lines = logContent.split('\n').filter(l => l.trim());
  let progress = 0;
  let currentStep = 0;
  let totalSteps = 0;
  let currentEpoch = 0;
  let trainLoss: string | null = null;
  let evalLoss: string | null = null;

  for (const line of lines) {
    // Parse step progress: "Step 50/1000"
    const stepMatch = line.match(/Step\s+(\d+)\/(\d+)/i);
    if (stepMatch) {
      currentStep = parseInt(stepMatch[1]);
      totalSteps = parseInt(stepMatch[2]);
      progress = Math.round((currentStep / totalSteps) * 100);
    }

    // Parse epoch: "Epoch 1/3"
    const epochMatch = line.match(/Epoch\s+(\d+)/i);
    if (epochMatch) {
      currentEpoch = parseInt(epochMatch[1]);
    }

    // Parse training loss: "train_loss: 0.1234" or "loss=0.1234"
    const lossMatch = line.match(/(?:train_loss|loss)[=:]\s*([\d.]+)/i);
    if (lossMatch) {
      trainLoss = lossMatch[1];
    }

    // Parse eval loss: "eval_loss: 0.1234"
    const evalMatch = line.match(/eval_loss[=:]\s*([\d.]+)/i);
    if (evalMatch) {
      evalLoss = evalMatch[1];
    }
  }

  return { progress, currentStep, totalSteps, currentEpoch, trainLoss, evalLoss };
}

// Use shared schemas for input validation (ensures frontend/backend consistency)
const createJobSchema = CreateTrainingJobSchema;
const updateJobSchema = UpdateTrainingJobSchema;

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

  // Start a training job with real SSH execution
  startJob: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the job details
      const [job] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, input.id));
      if (!job) throw new Error("Job not found");

      // Update status to preparing
      await db.update(trainingJobs).set({
        status: "preparing",
        startedAt: new Date(),
      }).where(eq(trainingJobs.id, input.id));

      try {
        const hostId = (job.hostId as HostId) || "alpha";

        // Generate the NeMo training script
        const trainScript = generateNeMoTrainingScript(job);
        console.log(`[Training] Starting job ${job.id} on ${hostId}`);
        console.log(`[Training] Script: ${trainScript.substring(0, 200)}...`);

        // Execute the training script via SSH
        const result = await executeOnHostFull(hostId, trainScript);

        if (result.code !== 0) {
          // Training failed to start
          await db.update(trainingJobs).set({
            status: "failed",
            errorMessage: result.stderr || "Failed to start training",
            completedAt: new Date(),
          }).where(eq(trainingJobs.id, input.id));

          return {
            success: false,
            error: result.stderr || "Failed to start training",
          };
        }

        // Extract PID from output
        const pidMatch = result.stdout.match(/PID:\s*(\d+)/);
        const pid = pidMatch ? pidMatch[1] : null;

        // Update status to running
        await db.update(trainingJobs).set({
          status: "running",
          errorMessage: pid ? `PID: ${pid}` : null,
        }).where(eq(trainingJobs.id, input.id));

        console.log(`[Training] Job ${job.id} started successfully${pid ? ` with PID ${pid}` : ''}`);

        return {
          success: true,
          message: `Training started${pid ? ` (PID: ${pid})` : ''}`,
          pid,
        };
      } catch (error: any) {
        console.error(`[Training] Error starting job ${job.id}:`, error);

        // Update status to failed
        await db.update(trainingJobs).set({
          status: "failed",
          errorMessage: error.message || "Unknown error",
          completedAt: new Date(),
        }).where(eq(trainingJobs.id, input.id));

        return {
          success: false,
          error: error.message || "Failed to start training",
        };
      }
    }),

  // Cancel a training job with real process termination
  cancelJob: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the job details
      const [job] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, input.id));
      if (!job) throw new Error("Job not found");

      try {
        const hostId = (job.hostId as HostId) || "alpha";
        const outputDir = job.outputPath || `/workspace/outputs/${job.name.toLowerCase().replace(/\s+/g, '-')}`;

        // Try to kill the training process via PID file
        const killCommand = `
          if [ -f "${outputDir}/.pid" ]; then
            PID=$(cat "${outputDir}/.pid")
            if kill -0 $PID 2>/dev/null; then
              kill -SIGTERM $PID
              sleep 2
              kill -SIGKILL $PID 2>/dev/null || true
              echo "Killed process $PID"
            else
              echo "Process not running"
            fi
            rm -f "${outputDir}/.pid"
          else
            echo "No PID file found"
          fi
        `;

        const result = await executeOnHostFull(hostId, killCommand);
        console.log(`[Training] Cancel job ${job.id}: ${result.stdout}`);

        // Update status
        await db.update(trainingJobs).set({
          status: "cancelled",
          completedAt: new Date(),
        }).where(eq(trainingJobs.id, input.id));

        return { success: true, message: "Job cancelled" };
      } catch (error: any) {
        console.error(`[Training] Error cancelling job ${job.id}:`, error);

        // Still mark as cancelled in DB even if SSH fails
        await db.update(trainingJobs).set({
          status: "cancelled",
          completedAt: new Date(),
          errorMessage: `Cancelled (cleanup may have failed: ${error.message})`,
        }).where(eq(trainingJobs.id, input.id));

        return { success: true, message: "Job cancelled (cleanup may have failed)" };
      }
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

  // Stream training logs from the job
  streamLogs: publicProcedure
    .input(z.object({
      id: z.number(),
      fromLine: z.number().default(0),
      maxLines: z.number().default(100),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available", logs: [], totalLines: 0 };

      // Get the job details
      const [job] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, input.id));
      if (!job) return { success: false, error: "Job not found", logs: [], totalLines: 0 };

      try {
        const hostId = (job.hostId as HostId) || "alpha";
        const outputDir = job.outputPath || `/workspace/outputs/${job.name.toLowerCase().replace(/\s+/g, '-')}`;
        const logFile = `${outputDir}/training.log`;

        // Read log file with tail and line count
        const logCommand = `
          if [ -f "${logFile}" ]; then
            TOTAL=$(wc -l < "${logFile}")
            tail -n +${input.fromLine + 1} "${logFile}" | head -n ${input.maxLines}
            echo "---TOTAL_LINES:$TOTAL---"
          else
            echo "Log file not found"
            echo "---TOTAL_LINES:0---"
          fi
        `;

        const result = await executeOnHost(hostId, logCommand);
        const lines = result.split('\n');

        // Extract total lines count
        const totalLineMatch = lines.find(l => l.includes('---TOTAL_LINES:'));
        const totalLines = totalLineMatch
          ? parseInt(totalLineMatch.match(/TOTAL_LINES:(\d+)/)?.[1] || '0')
          : 0;

        // Remove the total lines marker from output
        const logLines = lines.filter(l => !l.includes('---TOTAL_LINES:'));

        return {
          success: true,
          logs: logLines,
          totalLines,
          fromLine: input.fromLine,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          logs: [],
          totalLines: 0,
        };
      }
    }),

  // Check job status and update progress from remote logs
  syncJobStatus: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Database not available" };

      // Get the job details
      const [job] = await db.select().from(trainingJobs).where(eq(trainingJobs.id, input.id));
      if (!job) return { success: false, error: "Job not found" };

      // Only sync running jobs
      if (job.status !== "running" && job.status !== "preparing") {
        return { success: true, status: job.status, message: "Job not running" };
      }

      try {
        const hostId = (job.hostId as HostId) || "alpha";
        const outputDir = job.outputPath || `/workspace/outputs/${job.name.toLowerCase().replace(/\s+/g, '-')}`;
        const logFile = `${outputDir}/training.log`;
        const pidFile = `${outputDir}/.pid`;

        // Check if process is still running and get log tail
        const checkCommand = `
          RUNNING=0
          if [ -f "${pidFile}" ]; then
            PID=$(cat "${pidFile}")
            if kill -0 $PID 2>/dev/null; then
              RUNNING=1
            fi
          fi
          echo "RUNNING:$RUNNING"

          if [ -f "${logFile}" ]; then
            tail -n 50 "${logFile}"
          fi
        `;

        const result = await executeOnHost(hostId, checkCommand);
        const isRunning = result.includes("RUNNING:1");
        const logContent = result.replace(/RUNNING:\d\n?/, '');

        // Parse progress from logs
        const progress = parseTrainingProgress(logContent);

        // Update job with progress
        const updates: Record<string, unknown> = {};

        if (progress.progress > 0) updates.progress = progress.progress;
        if (progress.currentStep > 0) updates.currentStep = progress.currentStep;
        if (progress.totalSteps > 0) updates.totalSteps = progress.totalSteps;
        if (progress.currentEpoch > 0) updates.currentEpoch = progress.currentEpoch;
        if (progress.trainLoss) updates.trainLoss = progress.trainLoss;
        if (progress.evalLoss) updates.evalLoss = progress.evalLoss;

        // Check for completion or failure
        if (!isRunning) {
          // Process ended - check if completed or failed
          if (progress.progress >= 100 || logContent.includes("Training completed") || logContent.includes("Finished training")) {
            updates.status = "completed";
            updates.completedAt = new Date();
            updates.progress = 100;
          } else if (logContent.includes("Error") || logContent.includes("Exception") || logContent.includes("FAILED")) {
            updates.status = "failed";
            updates.completedAt = new Date();
            // Extract error message
            const errorMatch = logContent.match(/(?:Error|Exception|FAILED)[:\s]*(.+)/i);
            if (errorMatch) {
              updates.errorMessage = errorMatch[1].substring(0, 500);
            }
          } else {
            // Process ended but unclear why - could be success or failure
            updates.status = progress.progress > 90 ? "completed" : "failed";
            updates.completedAt = new Date();
          }
        }

        if (Object.keys(updates).length > 0) {
          await db.update(trainingJobs).set(updates).where(eq(trainingJobs.id, input.id));
        }

        return {
          success: true,
          isRunning,
          progress: progress.progress,
          currentStep: progress.currentStep,
          totalSteps: progress.totalSteps,
          status: updates.status || job.status,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    }),
});
