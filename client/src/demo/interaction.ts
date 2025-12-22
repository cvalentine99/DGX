/**
 * Demo Data - Interaction
 * 
 * Mock system prompts and chat configurations for demo/development.
 * Only used when DEMO_MODE is enabled in config.ts
 */

export interface DemoSystemPrompt {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: "general" | "coding" | "analysis" | "creative";
}

export const DEMO_SYSTEM_PROMPTS: DemoSystemPrompt[] = [
  {
    id: "network-analyst",
    name: "Network Security Analyst",
    description: "Expert in network traffic analysis and threat detection",
    prompt: "You are an expert network security analyst specializing in ExtraHop wire data analysis. You help users investigate network anomalies, identify threats, and optimize application performance using L2-L7 metrics.",
    category: "analysis",
  },
  {
    id: "ml-engineer",
    name: "ML Engineer",
    description: "Specialist in machine learning and model training",
    prompt: "You are an ML engineer expert in NVIDIA NeMo framework, PyTorch, and large language model training. You help users configure training jobs, optimize hyperparameters, and debug model issues.",
    category: "coding",
  },
  {
    id: "devops",
    name: "DevOps Engineer",
    description: "Expert in containerization and infrastructure",
    prompt: "You are a DevOps engineer specializing in NVIDIA GPU infrastructure, Docker containers, and Kubernetes. You help users manage container deployments, optimize GPU utilization, and troubleshoot system issues.",
    category: "coding",
  },
  {
    id: "data-scientist",
    name: "Data Scientist",
    description: "Expert in data analysis and visualization",
    prompt: "You are a data scientist expert in analyzing large datasets, creating visualizations, and deriving insights. You help users explore data, build models, and communicate findings effectively.",
    category: "analysis",
  },
];

export interface DemoChatConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export const DEMO_DEFAULT_CONFIG: DemoChatConfig = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.95,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

export interface DemoChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export const DEMO_CHAT_HISTORY: DemoChatMessage[] = [
  {
    role: "system",
    content: "You are an expert network security analyst specializing in ExtraHop wire data analysis.",
    timestamp: "2024-12-20T10:00:00Z",
  },
  {
    role: "user",
    content: "Show me the top 5 devices by network traffic in the last hour.",
    timestamp: "2024-12-20T10:01:00Z",
  },
  {
    role: "assistant",
    content: "I'll query the ExtraHop API to get the top devices by traffic. Here are the results:\n\n1. **db-primary** - 2.4 GB\n2. **api-server-01** - 1.8 GB\n3. **web-frontend** - 1.2 GB\n4. **cache-01** - 890 MB\n5. **auth-service** - 650 MB",
    timestamp: "2024-12-20T10:01:15Z",
  },
];
