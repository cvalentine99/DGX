/**
 * Demo Data - Training
 * 
 * Mock training recipes, job data, and loss history for demo/development.
 * Only used when DEMO_MODE is enabled in config.ts
 */

export interface DemoTrainingRecipe {
  id: string;
  name: string;
  description: string;
  baseModel: string;
  method: "sft" | "lora" | "dpo" | "peft";
}

export const DEMO_TRAINING_RECIPES: DemoTrainingRecipe[] = [
  { id: "sft-basic", name: "Basic SFT", description: "Supervised fine-tuning with full weights", baseModel: "llama-3.1-8b", method: "sft" },
  { id: "lora-efficient", name: "LoRA Efficient", description: "Low-rank adaptation for efficient training", baseModel: "mistral-7b", method: "lora" },
  { id: "dpo-alignment", name: "DPO Alignment", description: "Direct preference optimization", baseModel: "llama-3.1-8b", method: "dpo" },
  { id: "peft-adapter", name: "PEFT Adapter", description: "Parameter-efficient fine-tuning", baseModel: "codellama-13b", method: "peft" },
];

export interface DemoMoEParams {
  numExperts: number;
  topK: number;
  expertCapacity: number;
  routerType: string;
  loadBalancingLoss: number;
}

export const DEMO_MOE_PARAMS: DemoMoEParams = {
  numExperts: 8,
  topK: 2,
  expertCapacity: 1.25,
  routerType: "top-k",
  loadBalancingLoss: 0.01,
};

export interface DemoTrainingJob {
  id: string;
  name: string;
  status: "running" | "completed" | "failed" | "queued";
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
  currentStep: number;
  totalSteps: number;
  learningRate: number;
  loss: number;
  gpuUtilization: number;
  memoryUsage: number;
  startTime: string;
  estimatedCompletion: string;
}

export const DEMO_TRAINING_JOB: DemoTrainingJob = {
  id: "job-001",
  name: "nemotron-3-nano-finetune",
  status: "running",
  progress: 67.5,
  currentEpoch: 2,
  totalEpochs: 3,
  currentStep: 4500,
  totalSteps: 6667,
  learningRate: 0.0001,
  loss: 0.342,
  gpuUtilization: 94,
  memoryUsage: 78,
  startTime: "2024-12-20T10:30:00Z",
  estimatedCompletion: "2024-12-20T18:45:00Z",
};

export interface DemoLossPoint {
  step: number;
  loss: number;
  valLoss?: number;
}

export const DEMO_LOSS_HISTORY: DemoLossPoint[] = [
  { step: 0, loss: 2.8, valLoss: 2.9 },
  { step: 500, loss: 1.9, valLoss: 2.0 },
  { step: 1000, loss: 1.2, valLoss: 1.4 },
  { step: 1500, loss: 0.85, valLoss: 1.0 },
  { step: 2000, loss: 0.62, valLoss: 0.78 },
  { step: 2500, loss: 0.51, valLoss: 0.65 },
  { step: 3000, loss: 0.44, valLoss: 0.58 },
  { step: 3500, loss: 0.39, valLoss: 0.52 },
  { step: 4000, loss: 0.36, valLoss: 0.48 },
  { step: 4500, loss: 0.34, valLoss: 0.45 },
];

export interface DemoTrainingMetric {
  name: string;
  value: number;
  unit: string;
  trend: "up" | "down" | "stable";
}

export const DEMO_TRAINING_METRICS: DemoTrainingMetric[] = [
  { name: "Throughput", value: 1250, unit: "tokens/sec", trend: "stable" },
  { name: "GPU Memory", value: 78, unit: "%", trend: "stable" },
  { name: "Gradient Norm", value: 0.42, unit: "", trend: "down" },
  { name: "Learning Rate", value: 0.0001, unit: "", trend: "stable" },
];
